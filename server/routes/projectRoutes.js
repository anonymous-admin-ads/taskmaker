import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { requirePermission } from '../services/permissionService.js';
import { logAudit } from '../services/auditService.js';
import { notifyChange } from '../services/eventService.js';

const router = express.Router();

router.use(authenticate);

// Helper: validate HTTPS URL
function isValidHttpsUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDatabase();
  const statusFilter = req.query.status || 'Active';

  let query = `
    SELECT p.*, u.name as owner_name, u.avatar as owner_avatar,
           (SELECT count(*) FROM tickets t WHERE t.project_id = p.id) as ticket_count,
           (SELECT count(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
  `;

  if (statusFilter !== 'all') {
    query += ` WHERE p.status = ?`;
  }
  query += ` ORDER BY p.id ASC`;

  const projects = statusFilter !== 'all'
    ? db.prepare(query).all(statusFilter)
    : db.prepare(query).all();

  // Attach members avatars for each project
  const memberStmt = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    LIMIT 6
  `);

  const enriched = projects.map(p => ({
    ...p,
    members: memberStmt.all(p.id)
  }));

  res.json({ projects: enriched });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email, u.avatar as owner_avatar
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar, u.role, pm.role as project_role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  const repositories = db.prepare(`
    SELECT * FROM repositories WHERE project_id = ? ORDER BY is_primary DESC, id ASC
  `).all(req.params.id);

  const stats = db.prepare(`
    SELECT 
      count(*) as total_tickets,
      sum(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done_tickets,
      sum(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tickets,
      sum(CASE WHEN status = 'Hold Box' THEN 1 ELSE 0 END) as hold_tickets,
      sum(CASE WHEN status = 'Blocked Box' THEN 1 ELSE 0 END) as blocked_tickets
    FROM tickets WHERE project_id = ?
  `).get(req.params.id);

  res.json({
    project: {
      ...project,
      members,
      repositories,
      stats
    }
  });
});

// POST /api/projects
router.post('/', requirePermission('projects', 'create'), (req, res) => {
  const { name, key, description, startDate, targetDate } = req.body;
  if (!name || !key) {
    return res.status(400).json({ error: 'Project name and unique key are mandatory' });
  }

  const cleanKey = key.trim().toUpperCase();
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM projects WHERE UPPER(key) = ?').get(cleanKey);
  if (existing) {
    return res.status(409).json({ error: `Project key '${cleanKey}' is already in use` });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO projects (name, key, description, owner_id, status, start_date, target_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Active', ?, ?, ?, ?)
  `).run(name.trim(), cleanKey, description || '', req.user.id, startDate || null, targetDate || null, now, now);

  const projectId = Number(result.lastInsertRowid);

  // Add creator as member
  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, 'Lead')
  `).run(projectId, req.user.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_CREATED',
    targetResource: 'PROJECT',
    targetId: cleanKey,
    details: { name, key: cleanKey, description }
  });

  notifyChange('projects', { action: 'created', projectId });

  res.status(201).json({
    project: {
      id: projectId,
      name,
      key: cleanKey,
      description,
      owner_id: req.user.id,
      status: 'Active'
    }
  });
});

// PUT /api/projects/:id
router.put('/:id', requirePermission('projects', 'edit'), (req, res) => {
  const { name, key, description, status, startDate, targetDate } = req.body;
  const db = getDatabase();

  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let newKey = current.key;
  if (key && key.trim().toUpperCase() !== current.key) {
    newKey = key.trim().toUpperCase();
    const existing = db.prepare('SELECT id FROM projects WHERE UPPER(key) = ? AND id != ?').get(newKey, req.params.id);
    if (existing) {
      return res.status(409).json({ error: `Project key '${newKey}' is already in use by another project` });
    }
  }

  const finalName = name !== undefined && name !== null ? name.trim() : null;
  const finalKey = newKey !== undefined && newKey !== null ? newKey : null;
  const finalDesc = description !== undefined && description !== null ? description : null;
  const finalStatus = status !== undefined && status !== null ? status : null;
  const finalStartDate = startDate !== undefined && startDate !== null ? startDate : null;
  const finalTargetDate = targetDate !== undefined && targetDate !== null ? targetDate : null;

  db.prepare(`
    UPDATE projects
    SET name = COALESCE(?, name),
        key = COALESCE(?, key),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        start_date = COALESCE(?, start_date),
        target_date = COALESCE(?, target_date),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(finalName, finalKey, finalDesc, finalStatus, finalStartDate, finalTargetDate, req.params.id);

  const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_UPDATED',
    targetResource: 'PROJECT',
    targetId: current.key,
    details: { before: current, updated: { name, key: newKey, description, status, startDate, targetDate } }
  });

  notifyChange('projects', { action: 'updated', projectId: req.params.id });

  res.json({ success: true, message: 'Project updated successfully', project: updatedProject });
});

// DELETE /api/projects/:id (Archive or Permanent Delete)
router.delete('/:id', requirePermission('projects', 'delete'), (req, res) => {
  const db = getDatabase();
  const projectId = req.params.id;
  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!current) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;

  if (isPermanent) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const tickets = db.prepare('SELECT id FROM tickets WHERE project_id = ?').all(projectId);
      const ticketIds = tickets.map(t => t.id);

      if (ticketIds.length > 0) {
        const placeholders = ticketIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM hold_box_records WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
        db.prepare(`DELETE FROM blocked_box_records WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
        db.prepare(`DELETE FROM workflow_rule_executions WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
        db.prepare(`DELETE FROM ticket_comments WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
        db.prepare(`DELETE FROM ticket_links WHERE source_ticket_id IN (${placeholders}) OR target_ticket_id IN (${placeholders})`).run(...ticketIds, ...ticketIds);
        db.prepare(`DELETE FROM ticket_reviews_qa WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
        db.prepare(`DELETE FROM tickets WHERE project_id = ?`).run(projectId);
      }

      db.prepare('DELETE FROM sprints WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM repositories WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM workflow_config WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      db.exec('COMMIT;');

      logAudit({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'PROJECT_DELETED_PERMANENT',
        targetResource: 'PROJECT',
        targetId: current.key,
        details: { projectId, name: current.name, key: current.key }
      });

      notifyChange('projects', { action: 'deleted', projectId });
      notifyChange('tickets', { action: 'cleanup', projectId });

      return res.json({ success: true, message: `Project ${current.name} (${current.key}) permanently deleted` });
    } catch (err) {
      db.exec('ROLLBACK;');
      return res.status(500).json({ error: `Failed to permanently delete project: ${err.message}` });
    }
  }

  // Soft Archive
  db.prepare(`UPDATE projects SET status = 'Archived', updated_at = datetime('now') WHERE id = ?`).run(projectId);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_ARCHIVED',
    targetResource: 'PROJECT',
    targetId: current.key,
    details: { projectId }
  });

  notifyChange('projects', { action: 'archived', projectId });

  res.json({ success: true, message: 'Project archived successfully' });
});

// GET /api/projects/:id/repositories
router.get('/:id/repositories', (req, res) => {
  const db = getDatabase();
  const repos = db.prepare(`
    SELECT * FROM repositories WHERE project_id = ? ORDER BY is_primary DESC, id ASC
  `).all(req.params.id);
  res.json({ repositories: repos });
});

// POST /api/projects/:id/repositories
router.post('/:id/repositories', requirePermission('repositories', 'create'), (req, res) => {
  const { name, url, description, isPrimary } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Repository name and URL are required' });
  }

  // Validate HTTPS URL
  if (!isValidHttpsUrl(url)) {
    return res.status(400).json({ error: 'Unsafe URL: Only secure HTTPS repository URLs are permitted' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  if (isPrimary) {
    // Unset current primary
    db.prepare('UPDATE repositories SET is_primary = 0 WHERE project_id = ?').run(req.params.id);
  }

  const result = db.prepare(`
    INSERT INTO repositories (project_id, name, url, description, is_primary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name.trim(), url.trim(), description || '', isPrimary ? 1 : 0, now, now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'REPOSITORY_ADDED',
    targetResource: 'REPOSITORY',
    targetId: String(result.lastInsertRowid),
    details: { projectId: req.params.id, name, url }
  });

  res.status(201).json({
    repository: {
      id: Number(result.lastInsertRowid),
      project_id: Number(req.params.id),
      name,
      url,
      description,
      is_primary: isPrimary ? 1 : 0
    }
  });
});

// DELETE /api/projects/:id/repositories/:repoId
router.delete('/:id/repositories/:repoId', requirePermission('repositories', 'delete'), (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM repositories WHERE id = ? AND project_id = ?').run(req.params.repoId, req.params.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'REPOSITORY_DELETED',
    targetResource: 'REPOSITORY',
    targetId: req.params.repoId,
    details: { projectId: req.params.id }
  });

  res.json({ success: true, message: 'Repository link removed' });
});

// GET /api/projects/:id/members
router.get('/:id/members', (req, res) => {
  const db = getDatabase();
  const members = db.prepare(`
    SELECT u.id, u.user_id, u.name, u.email, u.avatar, u.role as workspace_role, pm.role as project_role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY u.name ASC
  `).all(req.params.id);
  res.json({ members });
});

// POST /api/projects/:id/members (Add member to project)
router.post('/:id/members', (req, res) => {
  const { userId, role } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const db = getDatabase();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const existing = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, userId);
  const memberRole = role || 'Member';

  if (existing) {
    db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(memberRole, req.params.id, userId);
  } else {
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, userId, memberRole);
  }

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_MEMBER_ADDED',
    targetResource: 'PROJECT',
    targetId: project.key,
    details: { projectId: req.params.id, addedUserId: userId, userName: user.name, role: memberRole }
  });

  notifyChange('projects', { action: 'members_updated', projectId: req.params.id });

  const members = db.prepare(`
    SELECT u.id, u.user_id, u.name, u.email, u.avatar, u.role as workspace_role, pm.role as project_role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.status(201).json({ success: true, message: `${user.name} added to project`, members });
});

// PUT /api/projects/:id/members/:userId (Update project member's role)
router.put('/:id/members/:userId', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const db = getDatabase();
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, req.params.id, req.params.userId);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_MEMBER_ROLE_UPDATED',
    targetResource: 'PROJECT',
    targetId: String(req.params.id),
    details: { projectId: req.params.id, targetUserId: req.params.userId, newRole: role }
  });

  notifyChange('projects', { action: 'members_updated', projectId: req.params.id });

  res.json({ success: true, message: 'Member role updated' });
});

// DELETE /api/projects/:id/members/:userId (Remove member from project)
router.delete('/:id/members/:userId', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PROJECT_MEMBER_REMOVED',
    targetResource: 'PROJECT',
    targetId: String(req.params.id),
    details: { projectId: req.params.id, removedUserId: req.params.userId }
  });

  notifyChange('projects', { action: 'members_updated', projectId: req.params.id });

  res.json({ success: true, message: 'Member removed from project' });
});

export default router;


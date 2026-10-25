import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { requirePermission } from '../services/permissionService.js';
import { transitionTicket, evaluateWorkflowRules } from '../services/workflowEngine.js';
import { logAudit } from '../services/auditService.js';
import { notifyChange } from '../services/eventService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/tickets
router.get('/', (req, res) => {
  const db = getDatabase();
  const { projectId, status, priority, type, sprintId, assigneeId, search } = req.query;

  let query = `
    SELECT t.*, p.name as project_name, p.key as project_key,
           u.name as assignee_name, u.avatar as assignee_avatar,
           c.name as creator_name,
           s.name as sprint_name,
           h.hold_reason, h.responsible_owner_name as hold_owner, h.expected_release_date as hold_release_date,
           b.blocker_description, b.category as blocker_category, b.responsible_name as blocker_responsible,
           b.severity as blocker_severity, b.expected_resolution_date as blocker_resolution_date
    FROM tickets t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    LEFT JOIN hold_box_records h ON t.id = h.ticket_id AND h.is_active = 1
    LEFT JOIN blocked_box_records b ON t.id = b.ticket_id AND b.is_active = 1
    WHERE 1=1
  `;
  const params = [];

  if (projectId) {
    query += ' AND t.project_id = ?';
    params.push(projectId);
  }
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }
  if (sprintId) {
    query += ' AND t.sprint_id = ?';
    params.push(sprintId);
  }
  if (assigneeId) {
    query += ' AND t.assignee_id = ?';
    params.push(assigneeId);
  }
  if (search) {
    query += ' AND (t.title LIKE ? OR t.key LIKE ? OR t.description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY t.id DESC';

  const tickets = db.prepare(query).all(...params);
  res.json({ tickets });
});

// GET /api/tickets/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const ticket = db.prepare(`
    SELECT t.*, p.name as project_name, p.key as project_key,
           u.name as assignee_name, u.email as assignee_email, u.avatar as assignee_avatar,
           c.name as creator_name, c.avatar as creator_avatar,
           s.name as sprint_name
    FROM tickets t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    WHERE t.id = ? OR t.key = ?
  `).get(req.params.id, req.params.id);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Active Hold details
  const activeHold = db.prepare(`
    SELECT * FROM hold_box_records WHERE ticket_id = ? AND is_active = 1
  `).get(ticket.id);

  // Active Blocker details
  const activeBlocker = db.prepare(`
    SELECT b.*, t.key as linked_ticket_key, t.title as linked_ticket_title
    FROM blocked_box_records b
    LEFT JOIN tickets t ON b.linked_ticket_id = t.id
    WHERE b.ticket_id = ? AND b.is_active = 1
  `).get(ticket.id);

  // Hold and Blocker History
  const holdHistory = db.prepare(`
    SELECT h.*, u.name as entered_by_name, r.name as released_by_name
    FROM hold_box_records h
    LEFT JOIN users u ON h.entered_by_user_id = u.id
    LEFT JOIN users r ON h.released_by_user_id = r.id
    WHERE h.ticket_id = ?
    ORDER BY h.id DESC
  `).all(ticket.id);

  const blockerHistory = db.prepare(`
    SELECT b.*, u.name as entered_by_name, r.name as resolved_by_name
    FROM blocked_box_records b
    LEFT JOIN users u ON b.entered_by_user_id = u.id
    LEFT JOIN users r ON b.resolved_by_user_id = r.id
    WHERE b.ticket_id = ?
    ORDER BY b.id DESC
  `).all(ticket.id);

  // Comments
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role
    FROM ticket_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ?
    ORDER BY c.id ASC
  `).all(ticket.id);

  // Linked Work Items
  const links = db.prepare(`
    SELECT tl.*, t.key as target_key, t.title as target_title, t.status as target_status, t.priority as target_priority
    FROM ticket_links tl
    JOIN tickets t ON tl.target_ticket_id = t.id
    WHERE tl.source_ticket_id = ?
  `).all(ticket.id);

  // Reviews & QA
  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name, u.avatar as reviewer_avatar
    FROM ticket_reviews_qa r
    LEFT JOIN users u ON r.reviewer_id = u.id
    WHERE r.ticket_id = ?
    ORDER BY r.id DESC
  `).all(ticket.id);

  // Activity History from Audit Logs
  const activity = db.prepare(`
    SELECT * FROM audit_logs
    WHERE target_resource = 'TICKET' AND target_id = ?
    ORDER BY id DESC LIMIT 50
  `).all(ticket.key);

  res.json({
    ticket: {
      ...ticket,
      activeHold: activeHold || null,
      activeBlocker: activeBlocker || null,
      holdHistory,
      blockerHistory,
      comments,
      links,
      reviews,
      activity
    }
  });
});

// POST /api/tickets (Create Ticket)
router.post('/', requirePermission('tickets', 'create'), (req, res) => {
  const {
    projectId, sprintId, title, description, type, priority,
    assigneeId, assignmentType, teamId, storyPoints, estimatedHours, dueDate
  } = req.body;

  if (!projectId || !title || !type || !priority) {
    return res.status(400).json({ error: 'Project, Title, Type and Priority are mandatory fields' });
  }

  const db = getDatabase();
  const project = db.prepare('SELECT id, key FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Selected project does not exist' });
  }

  // Safe collision-free ticket key generation
  db.exec('BEGIN IMMEDIATE;');

  try {
    const countRow = db.prepare('SELECT count(*) as count FROM tickets WHERE project_id = ?').get(projectId);
    const nextSeq = countRow.count + 1;
    let ticketKey = `${project.key}-${nextSeq}`;

    // Ensure unique if any historical records existed
    let exists = db.prepare('SELECT id FROM tickets WHERE key = ?').get(ticketKey);
    let offset = nextSeq;
    while (exists) {
      offset++;
      ticketKey = `${project.key}-${offset}`;
      exists = db.prepare('SELECT id FROM tickets WHERE key = ?').get(ticketKey);
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO tickets (
        key, project_id, sprint_id, title, description, type, priority, status,
        assignee_id, assignment_type, team_id, creator_id, story_points,
        estimated_hours, due_date, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'To Do', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      ticketKey,
      projectId,
      sprintId || null,
      title.trim(),
      description || '',
      type,
      priority,
      assigneeId || null,
      assignmentType || 'Individual',
      teamId || null,
      req.user.id,
      storyPoints ? Number(storyPoints) : null,
      estimatedHours ? Number(estimatedHours) : null,
      dueDate || null,
      now,
      now
    );

    const ticketId = Number(result.lastInsertRowid);

    logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'TICKET_CREATED',
      targetResource: 'TICKET',
      targetId: ticketKey,
      details: { ticketId, title, type, priority, projectId }
    });

    db.exec('COMMIT;');

    const created = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    notifyChange('tickets', { action: 'created', ticketId });
    res.status(201).json({ ticket: created });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/transition (Move to Hold Box, Blocked Box, Release, or other Stage)
router.post('/:id/transition', (req, res) => {
  const { targetStatus, holdData, blockedData, releaseData, expectedVersion } = req.body;
  if (!targetStatus) {
    return res.status(400).json({ error: 'Target status is required' });
  }

  try {
    const outcome = transitionTicket({
      ticketId: Number(req.params.id),
      targetStatus,
      user: req.user,
      holdData,
      blockedData,
      releaseData,
      expectedVersion: expectedVersion !== undefined ? Number(expectedVersion) : null,
      isOverride: false
    });

    // Check if any automated rules should trigger from this event
    evaluateWorkflowRules(Number(req.params.id), 'on_status_change', req.user, {
      fromStatus: outcome.previousStatus,
      targetStatus
    });

    notifyChange('tickets', { action: 'transition', ticketId: Number(req.params.id), targetStatus });

    res.json({
      success: true,
      ticket: outcome.ticket,
      message: `Status transitioned to '${targetStatus}'`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tickets/:id/override (Explicit Override Action)
router.post('/:id/override', (req, res) => {
  const {
    targetStatus,
    assigneeId,
    priority,
    overrideReason,
    expectedVersion
  } = req.body;

  if (!overrideReason || overrideReason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid reason (minimum 5 characters) is required to override this task' });
  }

  const db = getDatabase();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Check version
  if (expectedVersion !== undefined && ticket.version !== Number(expectedVersion)) {
    return res.status(409).json({
      error: `Concurrency Conflict: Ticket ${ticket.key} was modified by another user (expected v${expectedVersion}, current v${ticket.version}).`
    });
  }

  // Permission check
  const isSuperOrAdmin = ['super_admin', 'admin'].includes(req.user.role);
  if (!isSuperOrAdmin && req.user.role !== 'project_manager') {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to override tasks' });
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    const now = new Date().toISOString();
    const newStatus = targetStatus || ticket.status;
    const newAssigneeId = assigneeId !== undefined ? assigneeId : ticket.assignee_id;
    const newPriority = priority || ticket.priority;

    db.prepare(`
      UPDATE tickets
      SET status = ?, assignee_id = ?, priority = ?, version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(newStatus, newAssigneeId, newPriority, now, ticket.id);

    logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'TICKET_OVERRIDE',
      targetResource: 'TICKET',
      targetId: ticket.key,
      details: {
        ticketId: ticket.id,
        reason: overrideReason,
        before: { status: ticket.status, assignee_id: ticket.assignee_id, priority: ticket.priority },
        after: { status: newStatus, assignee_id: newAssigneeId, priority: newPriority }
      }
    });

    db.exec('COMMIT;');

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
    notifyChange('tickets', { action: 'override', ticketId: ticket.id });
    res.json({ success: true, ticket: updated, message: 'Ticket overridden successfully' });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', (req, res) => {
  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  const db = getDatabase();
  const ticket = db.prepare('SELECT key FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO ticket_comments (ticket_id, user_id, content, created_at)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.user.id, content.trim(), now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'COMMENT_ADDED',
    targetResource: 'TICKET',
    targetId: ticket.key,
    details: { commentId: result.lastInsertRowid }
  });

  notifyChange('tickets', { action: 'comment', ticketId: Number(req.params.id) });

  res.status(201).json({
    comment: {
      id: Number(result.lastInsertRowid),
      ticket_id: Number(req.params.id),
      user_id: req.user.id,
      user_name: req.user.name,
      user_avatar: req.user.avatar,
      user_role: req.user.role,
      content: content.trim(),
      created_at: now
    }
  });
});

// POST /api/tickets/:id/links
router.post('/:id/links', (req, res) => {
  const { targetTicketKey, linkType } = req.body;
  if (!targetTicketKey || !linkType) {
    return res.status(400).json({ error: 'Target ticket key and link type are required' });
  }

  const db = getDatabase();
  const source = db.prepare('SELECT id, key FROM tickets WHERE id = ?').get(req.params.id);
  const target = db.prepare('SELECT id, key FROM tickets WHERE key = ?').get(targetTicketKey.trim());

  if (!source || !target) {
    return res.status(404).json({ error: 'Source or target ticket not found' });
  }
  if (source.id === target.id) {
    return res.status(400).json({ error: 'A ticket cannot link to itself' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO ticket_links (source_ticket_id, target_ticket_id, link_type, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(source.id, target.id, linkType);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'TICKET_LINKED',
    targetResource: 'TICKET',
    targetId: source.key,
    details: { targetKey: target.key, linkType }
  });

  notifyChange('tickets', { action: 'link', ticketId: source.id });

  res.json({ success: true, message: `Linked ${source.key} to ${target.key} as '${linkType}'` });
});

// POST /api/tickets/:id/reviews
router.post('/:id/reviews', (req, res) => {
  const { stage, decision, comments, testOutcomes } = req.body;
  if (!stage || !decision) {
    return res.status(400).json({ error: 'Stage and decision are mandatory' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO ticket_reviews_qa (ticket_id, stage, reviewer_id, decision, comments, test_outcomes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, stage, req.user.id, decision, comments || '', testOutcomes || null, now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'REVIEW_RECORDED',
    targetResource: 'TICKET',
    targetId: req.params.id,
    details: { stage, decision, comments }
  });

  notifyChange('tickets', { action: 'review', ticketId: Number(req.params.id) });

  res.json({ success: true, message: 'Review outcome recorded successfully' });
});

export default router;


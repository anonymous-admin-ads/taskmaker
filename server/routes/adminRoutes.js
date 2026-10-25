import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate, hashPassword, revokeAllUserSessions } from '../services/authService.js';
import { requireAdmin } from '../services/permissionService.js';
import { logAudit, logSecurityEvent } from '../services/auditService.js';
import { notifyChange } from '../services/eventService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDatabase();

  const userStats = db.prepare(`
    SELECT
      count(*) as total_users,
      sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
      sum(CASE WHEN status != 'active' THEN 1 ELSE 0 END) as disabled_users
    FROM users
  `).get();

  const projStats = db.prepare(`
    SELECT count(*) as active_projects FROM projects WHERE status = 'Active'
  `).get();

  const ticketStats = db.prepare(`
    SELECT
      count(*) as total_tickets,
      sum(CASE WHEN status NOT IN ('Done', 'Cancelled') THEN 1 ELSE 0 END) as open_tickets,
      sum(CASE WHEN status IN ('Dev Review', 'QA Review') THEN 1 ELSE 0 END) as review_tickets,
      sum(CASE WHEN status = 'Hold Box' THEN 1 ELSE 0 END) as hold_tickets,
      sum(CASE WHEN status = 'Blocked Box' THEN 1 ELSE 0 END) as blocked_tickets
    FROM tickets
  `).get();

  const recentAudit = db.prepare(`
    SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10
  `).all();

  const securityAlerts = db.prepare(`
    SELECT * FROM security_events WHERE severity IN ('WARN', 'CRITICAL') ORDER BY id DESC LIMIT 10
  `).all();

  res.json({
    stats: {
      ...userStats,
      ...projStats,
      ...ticketStats
    },
    recentAudit,
    securityAlerts
  });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDatabase();
  const { search, role, status } = req.query;

  let query = `
    SELECT u.id, u.user_id, u.name, u.email, u.role, u.status, u.avatar,
           u.created_at, u.last_login_at,
           (SELECT count(*) FROM project_members pm WHERE pm.user_id = u.id) as project_count,
           (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.is_revoked = 0 AND s.expires_at > datetime('now')) as active_sessions
    FROM users u
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (role) {
    query += ' AND u.role = ?';
    params.push(role);
  }
  if (status) {
    query += ' AND u.status = ?';
    params.push(status);
  }

  query += ' ORDER BY u.id ASC';

  const users = db.prepare(query).all(...params);
  res.json({ users });
});

// POST /api/admin/users (Create User)
router.post('/users', (req, res) => {
  const { userId, name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }

  const db = getDatabase();
  const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existingEmail) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  const assignedUserId = userId?.trim() || `USR-${100 + userCount + 1}`;

  const existingId = db.prepare('SELECT id FROM users WHERE LOWER(user_id) = LOWER(?)').get(assignedUserId);
  if (existingId) {
    return res.status(409).json({ error: 'User ID is already in use' });
  }

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const result = db.prepare(`
    INSERT INTO users (user_id, name, email, password_hash, role, status, avatar, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(assignedUserId, name.trim(), email.trim(), passwordHash, role, avatar, now, now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'ADMIN_USER_CREATED',
    targetResource: 'USER',
    targetId: assignedUserId,
    details: { name, email, role }
  });

  res.status(201).json({
    user: {
      id: Number(result.lastInsertRowid),
      user_id: assignedUserId,
      name,
      email,
      role,
      status: 'active',
      avatar
    }
  });

  notifyChange('users', { action: 'created', userId: assignedUserId });
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const { role, status, name } = req.body;
  const db = getDatabase();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent demoting the last active Super Admin
  if (user.role === 'super_admin' && (role !== 'super_admin' || status !== 'active')) {
    const superAdminCount = db.prepare(`
      SELECT count(*) as count FROM users WHERE role = 'super_admin' AND status = 'active'
    `).get().count;
    if (superAdminCount <= 1) {
      return res.status(400).json({ error: 'Security Protection: Cannot demote or disable the last active Super Administrator' });
    }
  }

  db.prepare(`
    UPDATE users
    SET role = COALESCE(?, role),
        status = COALESCE(?, status),
        name = COALESCE(?, name),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(role, status, name, req.params.id);

  // If status set to inactive, revoke all sessions
  if (status && status !== 'active') {
    revokeAllUserSessions(user.id);
    logSecurityEvent({
      eventType: 'ACCOUNT_DISABLED',
      actorId: req.user.id,
      severity: 'WARN',
      details: { targetUserId: user.user_id, targetName: user.name }
    });
  }

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'ADMIN_USER_UPDATED',
    targetResource: 'USER',
    targetId: user.user_id,
    details: { before: { role: user.role, status: user.status }, after: { role, status, name } }
  });

  notifyChange('users', { action: 'updated', userId: user.id });

  res.json({ success: true, message: 'User updated successfully' });
});

// DELETE /api/admin/users/:id (Delete User)
router.delete('/users/:id', (req, res) => {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Security Guards: Developer Console root cannot be deleted
  if (user.user_id === 'DEV-CONSOLE-ROOT' || user.email === 'devconsole@system.local') {
    return res.status(403).json({ error: 'Security Violation: The dedicated Developer Console Root account cannot be deleted' });
  }

  if (Number(user.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own active administrative account' });
  }

  if (user.role === 'super_admin') {
    const superAdminCount = db.prepare(`SELECT count(*) as count FROM users WHERE role = 'super_admin' AND id != ?`).get(user.id).count;
    if (superAdminCount < 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining Super Administrator account' });
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    // 1. Invalidate and delete all user sessions
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    // 2. Clear user assignments from tickets (keep tickets intact, unassign or reassign creator)
    db.prepare('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ?').run(user.id);
    db.prepare('UPDATE tickets SET creator_id = ? WHERE creator_id = ?').run(req.user.id, user.id);

    // 3. Clear project ownership if owner, or reassign to current admin
    db.prepare('UPDATE projects SET owner_id = ? WHERE owner_id = ?').run(req.user.id, user.id);

    // 4. Clear team leadership if lead
    db.prepare('UPDATE teams SET lead_id = ? WHERE lead_id = ?').run(req.user.id, user.id);

    // 5. Remove team members and project memberships
    db.prepare('DELETE FROM team_members WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM project_members WHERE user_id = ?').run(user.id);

    // 6. Clear hold/blocked box record references
    try {
      db.prepare('UPDATE hold_box_records SET responsible_owner_id = NULL WHERE responsible_owner_id = ?').run(user.id);
      db.prepare('UPDATE hold_box_records SET entered_by_user_id = NULL WHERE entered_by_user_id = ?').run(user.id);
      db.prepare('UPDATE blocked_box_records SET responsible_user_id = NULL WHERE responsible_user_id = ?').run(user.id);
      db.prepare('UPDATE blocked_box_records SET entered_by_user_id = NULL WHERE entered_by_user_id = ?').run(user.id);
    } catch (e) {}

    // 7. Remove user overrides and page visibility
    db.prepare('DELETE FROM user_permission_overrides WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM user_page_visibility WHERE user_id = ?').run(user.id);

    // 8. Delete user notifications
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(user.id);

    // 9. Delete user record
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    db.exec('COMMIT;');

    logSecurityEvent({
      eventType: 'USER_DELETED',
      actorId: req.user.id,
      severity: 'WARN',
      details: { deletedUserId: user.user_id, deletedEmail: user.email, deletedName: user.name }
    });

    logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'ADMIN_USER_DELETED',
      targetResource: 'USER',
      targetId: user.user_id,
      details: { deletedUserId: user.user_id, email: user.email, name: user.name }
    });

    notifyChange('users', { action: 'deleted', userId: user.id });

    res.json({ success: true, message: `User ${user.name} (${user.user_id}) has been permanently deleted` });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: `Failed to delete user: ${err.message}` });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newHash = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, user.id);
  revokeAllUserSessions(user.id);

  logSecurityEvent({
    eventType: 'PASSWORD_RESET',
    actorId: req.user.id,
    severity: 'INFO',
    details: { targetUserId: user.user_id, targetName: user.name }
  });

  res.json({ success: true, message: `Password reset successfully for user ${user.name}` });
});

// GET /api/admin/sessions
router.get('/sessions', (req, res) => {
  const db = getDatabase();
  const sessions = db.prepare(`
    SELECT s.id, s.user_id, s.session_type, s.created_at, s.expires_at, s.is_revoked, s.ip_address, s.user_agent,
           u.name as user_name, u.email as user_email, u.role as user_role, u.user_id as user_code
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > datetime('now') AND s.is_revoked = 0
    ORDER BY s.created_at DESC
  `).all();
  res.json({ sessions });
});

// DELETE /api/admin/sessions/:sessionId
router.delete('/sessions/:sessionId', (req, res) => {
  const db = getDatabase();
  db.prepare("UPDATE sessions SET is_revoked = 1 WHERE id = ?").run(req.params.sessionId);
  res.json({ success: true, message: 'Session terminated' });
});

// POST /api/admin/database/diagnostics
router.post('/database/diagnostics', (req, res) => {
  const db = getDatabase();
  try {
    const integrity = db.prepare('PRAGMA integrity_check;').all();
    const tableStats = db.prepare(`
      SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name
    `).all();

    const counts = {
      users: db.prepare('SELECT count(*) as c FROM users').get().c,
      projects: db.prepare('SELECT count(*) as c FROM projects').get().c,
      tickets: db.prepare('SELECT count(*) as c FROM tickets').get().c,
      comments: db.prepare('SELECT count(*) as c FROM ticket_comments').get().c,
      audit_logs: db.prepare('SELECT count(*) as c FROM audit_logs').get().c,
      backups: db.prepare('SELECT count(*) as c FROM backup_records').get().c,
      active_sessions: db.prepare("SELECT count(*) as c FROM sessions WHERE is_revoked = 0 AND expires_at > datetime('now')").get().c,
    };

    res.json({
      success: true,
      integrity: integrity.map(r => r.integrity_check || 'ok'),
      tableCount: tableStats.filter(t => t.type === 'table').length,
      indexCount: tableStats.filter(t => t.type === 'index').length,
      counts,
      walMode: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/database/vacuum
router.post('/database/vacuum', (req, res) => {
  const db = getDatabase();
  try {
    const opt = db.prepare('PRAGMA optimize;').all();
    res.json({ success: true, message: 'Database optimized successfully (PRAGMA optimize completed)', details: opt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sql-inspector
router.post('/sql-inspector', (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'SQL query string required' });
  }

  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();
  const allowedPrefixes = ['SELECT', 'PRAGMA', 'EXPLAIN', 'WITH'];
  const isAllowed = allowedPrefixes.some(p => upper.startsWith(p));
  if (!isAllowed) {
    return res.status(403).json({ error: 'SQL Inspector only allows read queries (SELECT, PRAGMA, EXPLAIN, WITH)' });
  }

  const db = getDatabase();
  const startTime = Date.now();
  try {
    const rows = db.prepare(trimmed).all();
    const duration = Date.now() - startTime;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({
      success: true,
      rows: rows.slice(0, 100),
      totalRows: rows.length,
      columns,
      durationMs: duration
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/revoke-sessions
router.post('/users/:id/revoke-sessions', (req, res) => {
  revokeAllUserSessions(req.params.id);
  logSecurityEvent({
    eventType: 'SESSION_REVOKED',
    actorId: req.user.id,
    severity: 'INFO',
    details: { targetUserId: req.params.id, message: 'Administrator manually revoked all sessions' }
  });
  res.json({ success: true, message: 'All active sessions for this user have been terminated' });
});

// GET /api/admin/roles
router.get('/roles', (req, res) => {
  const db = getDatabase();
  const roles = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, id ASC').all();
  const permissions = db.prepare('SELECT * FROM role_permissions').all();

  res.json({ roles, permissions });
});

// PUT /api/admin/roles/:roleId/permissions
router.put('/roles/:roleId/permissions', (req, res) => {
  const { permissions } = req.body; // array of { resource, action }
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }

  const roleId = req.params.roleId;
  const db = getDatabase();

  if (roleId === 'super_admin') {
    return res.status(400).json({ error: 'Super Administrator permissions cannot be modified' });
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const insert = db.prepare('INSERT INTO role_permissions (role_id, resource, action) VALUES (?, ?, ?)');
    for (const p of permissions) {
      insert.run(roleId, p.resource, p.action);
    }
    db.exec('COMMIT;');

    logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'ROLE_PERMISSIONS_UPDATED',
      targetResource: 'ROLE',
      targetId: roleId,
      details: { count: permissions.length }
    });

    res.json({ success: true, message: 'Permissions matrix updated' });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/:id/access
router.get('/users/:id/access', (req, res) => {
  const db = getDatabase();
  const overrides = db.prepare('SELECT * FROM user_permission_overrides WHERE user_id = ?').all(req.params.id);
  const visibility = db.prepare('SELECT * FROM user_page_visibility WHERE user_id = ?').all(req.params.id);
  res.json({ overrides, visibility });
});

// PUT /api/admin/users/:id/access
router.put('/users/:id/access', (req, res) => {
  const { overrides, visibility } = req.body;
  const userId = req.params.id;
  const db = getDatabase();

  db.exec('BEGIN IMMEDIATE;');
  try {
    if (Array.isArray(overrides)) {
      db.prepare('DELETE FROM user_permission_overrides WHERE user_id = ?').run(userId);
      const insertOverride = db.prepare(`
        INSERT INTO user_permission_overrides (user_id, resource, action, is_granted, scope_project_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const o of overrides) {
        insertOverride.run(userId, o.resource, o.action, o.is_granted ? 1 : 0, o.scope_project_id || null, o.notes || '');
      }
    }

    if (Array.isArray(visibility)) {
      db.prepare('DELETE FROM user_page_visibility WHERE user_id = ?').run(userId);
      const insertVis = db.prepare('INSERT INTO user_page_visibility (user_id, page_key, is_visible) VALUES (?, ?, ?)');
      for (const v of visibility) {
        insertVis.run(userId, v.page_key, v.is_visible ? 1 : 0);
      }
    }

    db.exec('COMMIT;');

    logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'USER_ACCESS_CONFIGURED',
      targetResource: 'USER',
      targetId: userId,
      details: { overrideCount: overrides?.length || 0, visibilityCount: visibility?.length || 0 }
    });

    res.json({ success: true, message: 'User access controls saved' });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/feature-flags
router.get('/feature-flags', (req, res) => {
  const db = getDatabase();
  const flags = db.prepare('SELECT * FROM feature_flags ORDER BY key ASC').all();
  res.json({ flags });
});

// PUT /api/admin/feature-flags/:key
router.put('/feature-flags/:key', (req, res) => {
  const { enabled } = req.body;
  const db = getDatabase();

  db.prepare('UPDATE feature_flags SET enabled = ? WHERE key = ?').run(enabled ? 1 : 0, req.params.key);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'FEATURE_FLAG_TOGGLED',
    targetResource: 'FEATURE_FLAG',
    targetId: req.params.key,
    details: { enabled: !!enabled }
  });

  res.json({ success: true, message: `Feature flag ${req.params.key} set to ${enabled}` });
});

// GET /api/admin/security-events
router.get('/security-events', (req, res) => {
  const db = getDatabase();
  const events = db.prepare(`
    SELECT s.*, u.name as actor_name, u.email as actor_email
    FROM security_events s
    LEFT JOIN users u ON s.actor_id = u.id
    ORDER BY s.id DESC
    LIMIT 100
  `).all();
  res.json({ events });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  const db = getDatabase();
  const logs = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT 150
  `).all();
  res.json({ logs });
});

export default router;


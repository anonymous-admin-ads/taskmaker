import { getDatabase } from '../db/database.js';

export function logAudit({
  actorId = null,
  actorName = 'System',
  action,
  targetResource,
  targetId = null,
  details = null,
  ipAddress = null
}) {
  try {
    const db = getDatabase();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_name, action, target_resource, target_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(actorId, actorName, action, targetResource, targetId ? String(targetId) : null, detailsStr, ipAddress);
  } catch (err) {
    console.error('[AuditService] Failed to write audit log:', err.message);
  }
}

export function logSecurityEvent({
  eventType,
  actorId = null,
  ipAddress = '127.0.0.1',
  userAgent = '',
  severity = 'INFO',
  details = null
}) {
  try {
    const db = getDatabase();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    db.prepare(`
      INSERT INTO security_events (event_type, actor_id, ip_address, user_agent, severity, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(eventType, actorId, ipAddress, userAgent, severity, detailsStr);
  } catch (err) {
    console.error('[SecurityEvent] Failed to write security event:', err.message);
  }
}


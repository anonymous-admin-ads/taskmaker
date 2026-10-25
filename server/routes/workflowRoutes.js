import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { requirePermission } from '../services/permissionService.js';
import { getWorkflowConfig } from '../services/workflowEngine.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/workflow/config
router.get('/config', (req, res) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : null;
  const config = getWorkflowConfig(projectId);
  res.json({ config });
});

// PUT /api/workflow/config
router.put('/config', requirePermission('workflow', 'edit'), (req, res) => {
  const {
    projectId,
    holdBoxEnabled,
    blockedBoxEnabled,
    allowedTransitions,
    holdCategories,
    blockerCategories,
    permittedRolesRelease,
    permittedRolesOverride
  } = req.body;

  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM workflow_config WHERE project_id IS ?').get(projectId || null);

  if (existing) {
    db.prepare(`
      UPDATE workflow_config
      SET hold_box_enabled = ?,
          blocked_box_enabled = ?,
          allowed_transitions = ?,
          hold_categories = ?,
          blocker_categories = ?,
          permitted_roles_release = ?,
          permitted_roles_override = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      holdBoxEnabled ? 1 : 0,
      blockedBoxEnabled ? 1 : 0,
      JSON.stringify(allowedTransitions || {}),
      JSON.stringify(holdCategories || []),
      JSON.stringify(blockerCategories || []),
      JSON.stringify(permittedRolesRelease || []),
      JSON.stringify(permittedRolesOverride || []),
      now,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO workflow_config (
        project_id, hold_box_enabled, blocked_box_enabled,
        allowed_transitions, hold_categories, blocker_categories,
        permitted_roles_release, permitted_roles_override, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId || null,
      holdBoxEnabled ? 1 : 0,
      blockedBoxEnabled ? 1 : 0,
      JSON.stringify(allowedTransitions || {}),
      JSON.stringify(holdCategories || []),
      JSON.stringify(blockerCategories || []),
      JSON.stringify(permittedRolesRelease || []),
      JSON.stringify(permittedRolesOverride || []),
      now
    );
  }

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'WORKFLOW_CONFIG_UPDATED',
    targetResource: 'WORKFLOW',
    targetId: projectId ? `Project_${projectId}` : 'Global',
    details: { holdBoxEnabled, blockedBoxEnabled }
  });

  res.json({ success: true, message: 'Workflow configuration updated successfully' });
});

// GET /api/workflow/rules
router.get('/rules', (req, res) => {
  const db = getDatabase();
  const projectId = req.query.projectId ? Number(req.query.projectId) : null;

  let query = 'SELECT * FROM workflow_rules WHERE 1=1';
  const params = [];

  if (projectId) {
    query += ' AND (project_id = ? OR project_id IS NULL)';
    params.push(projectId);
  }
  query += ' ORDER BY priority ASC, id ASC';

  const rules = db.prepare(query).all(...params);
  res.json({ rules });
});

// POST /api/workflow/rules
router.post('/rules', requirePermission('workflow', 'create'), (req, res) => {
  const { projectId, name, triggerEvent, conditionType, targetStatus, priority, description } = req.body;
  if (!name || !triggerEvent || !conditionType || !targetStatus) {
    return res.status(400).json({ error: 'Name, Trigger Event, Condition Type and Target Status are mandatory' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO workflow_rules (
      project_id, name, trigger_event, condition_type, target_status,
      priority, is_enabled, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    projectId || null,
    name.trim(),
    triggerEvent,
    conditionType,
    targetStatus,
    priority ? Number(priority) : 10,
    description || '',
    now,
    now
  );

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'WORKFLOW_RULE_CREATED',
    targetResource: 'WORKFLOW_RULE',
    targetId: String(result.lastInsertRowid),
    details: { name, triggerEvent, conditionType, targetStatus, priority }
  });

  res.status(201).json({
    rule: {
      id: Number(result.lastInsertRowid),
      name,
      trigger_event: triggerEvent,
      condition_type: conditionType,
      target_status: targetStatus,
      priority: priority || 10,
      is_enabled: 1
    }
  });
});

// PUT /api/workflow/rules/:id
router.put('/rules/:id', requirePermission('workflow', 'edit'), (req, res) => {
  const { name, isEnabled, priority, description, conditionType, targetStatus } = req.body;
  const db = getDatabase();

  db.prepare(`
    UPDATE workflow_rules
    SET name = COALESCE(?, name),
        is_enabled = COALESCE(?, is_enabled),
        priority = COALESCE(?, priority),
        description = COALESCE(?, description),
        condition_type = COALESCE(?, condition_type),
        target_status = COALESCE(?, target_status),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(name, isEnabled !== undefined ? (isEnabled ? 1 : 0) : null, priority, description, conditionType, targetStatus, req.params.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'WORKFLOW_RULE_UPDATED',
    targetResource: 'WORKFLOW_RULE',
    targetId: req.params.id,
    details: { name, isEnabled, priority }
  });

  res.json({ success: true, message: 'Workflow rule updated successfully' });
});

// DELETE /api/workflow/rules/:id
router.delete('/rules/:id', requirePermission('workflow', 'delete'), (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM workflow_rules WHERE id = ?').run(req.params.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'WORKFLOW_RULE_DELETED',
    targetResource: 'WORKFLOW_RULE',
    targetId: req.params.id
  });

  res.json({ success: true, message: 'Rule removed' });
});

// GET /api/workflow/executions
router.get('/executions', (req, res) => {
  const db = getDatabase();
  const history = db.prepare(`
    SELECT e.*, r.name as rule_name, t.key as ticket_key, t.title as ticket_title, u.name as user_name
    FROM workflow_rule_executions e
    LEFT JOIN workflow_rules r ON e.rule_id = r.id
    LEFT JOIN tickets t ON e.ticket_id = t.id
    LEFT JOIN users u ON e.triggered_by_user_id = u.id
    ORDER BY e.id DESC
    LIMIT 100
  `).all();

  res.json({ executions: history });
});

export default router;


import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { requireAdmin } from '../services/permissionService.js';
import { logAudit } from '../services/auditService.js';
import { notifyChange } from '../services/eventService.js';

const router = express.Router();

// GET /api/ui-controls (Public / Authenticated - used by normal website to enforce UI rules)
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const controls = db.prepare('SELECT element_id, element_type, name, is_enabled FROM ui_element_controls').all();
    const map = {};
    for (const c of controls) {
      map[c.element_id] = c.is_enabled === 1;
    }
    res.json({ controls, map });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only routes below
router.use(authenticate);
router.use(requireAdmin);

// GET /api/ui-controls/admin (Detailed view for Developer Console)
router.get('/admin', (req, res) => {
  const db = getDatabase();
  try {
    const controls = db.prepare(`
      SELECT c.*, u.name as updated_by_name
      FROM ui_element_controls c
      LEFT JOIN users u ON c.updated_by_id = u.id
      ORDER BY c.element_type ASC, c.element_id ASC
    `).all();

    const map = {};
    for (const c of controls) {
      map[c.element_id] = c.is_enabled === 1;
    }

    res.json({ controls, map });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ui-controls/:elementId (Toggle element visibility or register new detailing option on-the-fly)
router.put('/:elementId', (req, res) => {
  const { is_enabled, name, element_type, description, target_location } = req.body;
  const elementId = req.params.elementId;
  const db = getDatabase();

  let element = db.prepare('SELECT * FROM ui_element_controls WHERE element_id = ?').get(elementId);
  const newState = is_enabled ? 1 : 0;
  const now = new Date().toISOString();

  if (!element) {
    // Dynamic Registration on-the-fly (e.g., from Developer Right-Click Context Menu)
    const friendlyName = name || elementId.replace(/^(btn_|page_|icon_|widget_)/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const elType = element_type || (elementId.startsWith('page_') ? 'page' : elementId.startsWith('icon_') ? 'icon' : elementId.startsWith('widget_') ? 'widget' : 'button');
    const elLocation = target_location || 'Live Workspace App';
    const elDesc = description || `UI detailing option for ${friendlyName}`;

    db.prepare(`
      INSERT INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_by_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(elementId, elType, friendlyName, elDesc, elLocation, newState, req.user.id, now);

    element = db.prepare('SELECT * FROM ui_element_controls WHERE element_id = ?').get(elementId);
  } else {
    db.prepare(`
      UPDATE ui_element_controls
      SET is_enabled = ?, updated_by_id = ?, updated_at = ?
      WHERE element_id = ?
    `).run(newState, req.user.id, now, elementId);
  }

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'UI_ELEMENT_CONTROL_TOGGLED',
    targetResource: 'UI_CONTROL',
    targetId: elementId,
    details: {
      elementName: element.name,
      elementType: element.element_type,
      before: element.is_enabled === 1,
      after: newState === 1,
      mode: newState === 1 ? 'ALL_USERS' : 'DEV_CONSOLE_ONLY'
    }
  });

  const controls = db.prepare('SELECT element_id, element_type, name, is_enabled FROM ui_element_controls').all();
  const map = {};
  for (const c of controls) {
    map[c.element_id] = c.is_enabled === 1;
  }

  notifyChange('ui_controls', { elementId, is_enabled: newState === 1, mode: newState === 1 ? 'ALL_USERS' : 'DEV_CONSOLE_ONLY' });

  res.json({
    success: true,
    message: newState === 1
      ? `UI Element '${element.name}' turned ON for Normal Website & All Users`
      : `UI Element '${element.name}' turned ON ONLY for Developer Console (Hidden from Normal Website)`,
    elementId,
    is_enabled: newState === 1,
    mode: newState === 1 ? 'ALL_USERS' : 'DEV_CONSOLE_ONLY',
    map
  });
});

// POST /api/ui-controls/bulk-set (Batch set all controls to enabled or dev-console-only)
router.post('/bulk-set', (req, res) => {
  const { is_enabled } = req.body;
  const db = getDatabase();
  const newState = is_enabled ? 1 : 0;
  const now = new Date().toISOString();

  // Exclude btn_role_enforcement from general bulk toggle so master role security isn't accidentally modified
  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = ?, updated_by_id = ?, updated_at = ?
    WHERE element_id != 'btn_role_enforcement'
  `).run(newState, req.user.id, now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'UI_ELEMENT_CONTROLS_BULK_SET',
    targetResource: 'UI_CONTROL',
    targetId: 'ALL_EXCEPT_RBAC',
    details: { setState: newState === 1 ? 'ALL_USERS' : 'DEV_CONSOLE_ONLY' }
  });

  const controls = db.prepare('SELECT element_id, element_type, name, is_enabled FROM ui_element_controls').all();
  const map = {};
  for (const c of controls) {
    map[c.element_id] = c.is_enabled === 1;
  }

  notifyChange('ui_controls', { action: 'bulk-set', is_enabled: newState === 1 });

  res.json({
    success: true,
    message: newState === 1
      ? 'All UI detailing elements turned ON for normal website'
      : 'All UI detailing elements set to Developer Console ONLY',
    map
  });
});

// POST /api/ui-controls/bulk-reset (Reset all controls to enabled or default)
router.post('/bulk-reset', (req, res) => {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = 1, updated_by_id = ?, updated_at = ?
  `).run(req.user.id, now);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'UI_ELEMENT_CONTROLS_RESET_ALL',
    targetResource: 'UI_CONTROL',
    targetId: 'ALL',
    details: { resetTo: 'Enabled' }
  });

  const controls = db.prepare('SELECT element_id, element_type, name, is_enabled FROM ui_element_controls').all();
  const map = {};
  for (const c of controls) {
    map[c.element_id] = c.is_enabled === 1;
  }

  notifyChange('ui_controls', { action: 'bulk-reset' });

  res.json({ success: true, message: 'All UI elements reset to enabled', map });
});

export default router;


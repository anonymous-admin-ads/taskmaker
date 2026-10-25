import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { requireAdmin } from '../services/permissionService.js';
import {
  createDatabaseBackup,
  verifyRestoreBackup,
  getBackupHealth
} from '../services/backupService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

// GET /api/backup/health
router.get('/health', (req, res) => {
  try {
    const health = getBackupHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/history
router.get('/history', (req, res) => {
  const db = getDatabase();
  const backups = db.prepare(`
    SELECT * FROM backup_records
    ORDER BY started_at DESC
    LIMIT 50
  `).all();
  res.json({ backups });
});

// POST /api/backup/trigger
router.post('/trigger', (req, res) => {
  try {
    const { type = 'MANUAL' } = req.body;
    const result = createDatabaseBackup({
      type,
      initiatedByUserId: req.user.id,
      initiatedByName: req.user.name
    });
    res.status(201).json({
      success: true,
      message: 'Database backup created and encrypted successfully',
      backup: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/verify/:backupId
router.post('/verify/:backupId', (req, res) => {
  try {
    const result = verifyRestoreBackup(req.params.backupId, req.user.id);
    res.json({
      success: true,
      message: 'Restore verification passed: Tested in isolated recovery sandbox with complete schema & record validation',
      verification: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Restore verification failed: ${err.message}`
    });
  }
});

// GET /api/backup/restore-logs
router.get('/restore-logs', (req, res) => {
  const db = getDatabase();
  const logs = db.prepare(`
    SELECT l.*, u.name as verified_by_name
    FROM restore_verification_logs l
    LEFT JOIN users u ON l.verified_by_user_id = u.id
    ORDER BY l.verified_at DESC
    LIMIT 50
  `).all();

  const formatted = logs.map(l => ({
    ...l,
    record_counts: JSON.parse(l.record_counts || '{}')
  }));

  res.json({ logs: formatted });
});

export default router;


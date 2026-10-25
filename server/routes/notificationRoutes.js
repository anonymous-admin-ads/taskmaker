import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/notifications
router.get('/', (req, res) => {
  const db = getDatabase();
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 30
  `).all(req.user.id);

  const unreadCount = db.prepare(`
    SELECT count(*) as count FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).count;

  res.json({ notifications, unreadCount });
});

// POST /api/notifications/:id/read
router.post('/:id/read', (req, res) => {
  const db = getDatabase();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  const db = getDatabase();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true, message: 'All notifications marked as read' });
});

export default router;


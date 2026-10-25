import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/metrics/dashboard (Optimized Single-Pass Aggregation)
router.get('/dashboard', (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  // Consolidated single-pass user task metrics
  const taskAgg = db.prepare(`
    SELECT
      count(*) as assigned,
      sum(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
      sum(CASE WHEN status IN ('Dev Review', 'QA Review') THEN 1 ELSE 0 END) as in_review,
      sum(CASE WHEN status != 'Done' AND due_date < ? THEN 1 ELSE 0 END) as overdue,
      sum(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed,
      sum(CASE WHEN status = 'Done' AND due_date IS NOT NULL THEN 1 ELSE 0 END) as completed_with_due,
      sum(CASE WHEN status = 'Done' AND due_date IS NOT NULL AND updated_at <= due_date THEN 1 ELSE 0 END) as on_time
    FROM tickets WHERE assignee_id = ?
  `).get(today, userId);

  let onTimeRate = 86;
  if (taskAgg && taskAgg.completed_with_due > 0) {
    onTimeRate = Math.round((taskAgg.on_time / taskAgg.completed_with_due) * 100);
  }

  // Tasks by Status
  const statusRows = db.prepare(`
    SELECT status, count(*) as count
    FROM tickets
    GROUP BY status
  `).all();

  const totalTickets = statusRows.reduce((acc, r) => acc + r.count, 0);

  // My Tasks list (Top 8)
  const myTasks = db.prepare(`
    SELECT t.id, t.key, t.title, t.type, t.priority, t.status, t.due_date, p.name as project_name
    FROM tickets t
    JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ?
    ORDER BY t.status = 'In Progress' DESC, t.id DESC
    LIMIT 8
  `).all(userId);

  // Recent Activity Feed
  const recentActivity = db.prepare(`
    SELECT a.*, u.avatar as actor_avatar
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    ORDER BY a.id DESC
    LIMIT 6
  `).all();

  res.json({
    metrics: {
      assigned: taskAgg?.assigned || 0,
      inProgress: taskAgg?.in_progress || 0,
      inReview: taskAgg?.in_review || 0,
      overdue: taskAgg?.overdue || 0,
      completed: taskAgg?.completed || 0,
      onTimeRate
    },
    tasksByStatus: {
      total: totalTickets,
      breakdown: statusRows
    },
    myTasks,
    recentActivity
  });
});

// GET /api/metrics/hold-blocked
router.get('/hold-blocked', (req, res) => {
  const db = getDatabase();
  const { projectId, priority } = req.query;

  let baseTicketFilter = 'WHERE 1=1';
  const params = [];
  if (projectId) {
    baseTicketFilter += ' AND t.project_id = ?';
    params.push(projectId);
  }
  if (priority) {
    baseTicketFilter += ' AND t.priority = ?';
    params.push(priority);
  }

  // Active counts
  const activeHoldCount = db.prepare(`
    SELECT count(*) as count FROM tickets t
    JOIN hold_box_records h ON t.id = h.ticket_id AND h.is_active = 1
    ${baseTicketFilter}
  `).get(...params).count;

  const activeBlockedCount = db.prepare(`
    SELECT count(*) as count FROM tickets t
    JOIN blocked_box_records b ON t.id = b.ticket_id AND b.is_active = 1
    ${baseTicketFilter}
  `).get(...params).count;

  // Average Durations
  const holdDur = db.prepare(`
    SELECT avg((julianday(COALESCE(released_at, datetime('now'))) - julianday(entered_at)) * 24) as avg_hours
    FROM hold_box_records
  `).get();

  const blockedDur = db.prepare(`
    SELECT avg((julianday(COALESCE(resolved_at, datetime('now'))) - julianday(entered_at)) * 24) as avg_hours
    FROM blocked_box_records
  `).get();

  const today = new Date().toISOString().split('T')[0];
  const overdueHoldCount = db.prepare(`
    SELECT count(*) as count FROM hold_box_records
    WHERE is_active = 1 AND expected_release_date IS NOT NULL AND expected_release_date < ?
  `).get(today).count;

  const overdueBlockedCount = db.prepare(`
    SELECT count(*) as count FROM blocked_box_records
    WHERE is_active = 1 AND expected_resolution_date IS NOT NULL AND expected_resolution_date < ?
  `).get(today).count;

  const commonHoldReasons = db.prepare(`
    SELECT category, count(*) as count
    FROM hold_box_records
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
    LIMIT 4
  `).all();

  const commonBlockerReasons = db.prepare(`
    SELECT category, count(*) as count
    FROM blocked_box_records
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
    LIMIT 4
  `).all();

  res.json({
    activeHoldCount,
    activeBlockedCount,
    avgHoldHours: holdDur?.avg_hours ? +holdDur.avg_hours.toFixed(1) : 0,
    avgBlockedHours: blockedDur?.avg_hours ? +blockedDur.avg_hours.toFixed(1) : 0,
    overdueHoldCount,
    overdueBlockedCount,
    commonHoldReasons,
    commonBlockerReasons
  });
});

// GET /api/metrics/reports
router.get('/reports', (req, res) => {
  const db = getDatabase();
  const { projectId } = req.query;

  let filter = 'WHERE 1=1';
  const params = [];
  if (projectId) {
    filter += ' AND project_id = ?';
    params.push(projectId);
  }

  const byStatus = db.prepare(`SELECT status, count(*) as count FROM tickets ${filter} GROUP BY status`).all(...params);
  const byPriority = db.prepare(`SELECT priority, count(*) as count FROM tickets ${filter} GROUP BY priority`).all(...params);
  const byType = db.prepare(`SELECT type, count(*) as count FROM tickets ${filter} GROUP BY type`).all(...params);

  const agg = db.prepare(`
    SELECT
      count(*) as total,
      sum(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed,
      sum(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
      sum(CASE WHEN status != 'Done' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
    FROM tickets ${filter}
  `).get(...params);

  res.json({
    total: agg?.total || 0,
    completed: agg?.completed || 0,
    inProgress: agg?.in_progress || 0,
    overdue: agg?.overdue || 0,
    byStatus,
    byPriority,
    byType
  });
});

export default router;

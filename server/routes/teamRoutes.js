import express from 'express';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../services/authService.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();

router.use(authenticate);

// GET /api/teams
router.get('/', (req, res) => {
  const db = getDatabase();
  const teams = db.prepare(`
    SELECT t.*, u.name as lead_name, u.email as lead_email, u.avatar as lead_avatar,
           (SELECT count(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
    FROM teams t
    LEFT JOIN users u ON t.lead_id = u.id
    ORDER BY t.id ASC
  `).all();

  const memberStmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.avatar
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ?
  `);

  const enriched = teams.map(t => ({
    ...t,
    members: memberStmt.all(t.id)
  }));

  res.json({ teams: enriched });
});

// POST /api/teams
router.post('/', (req, res) => {
  const { name, description, leadId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO teams (name, description, lead_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), description || '', leadId || req.user.id, now);

  const teamId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)').run(teamId, req.user.id);

  logAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'TEAM_CREATED',
    targetResource: 'TEAM',
    targetId: String(teamId),
    details: { name }
  });

  res.status(201).json({ team: { id: teamId, name, description } });
});

// POST /api/teams/:id/members
router.post('/:id/members', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)').run(req.params.id, userId);

  res.json({ success: true, message: 'Member added to team' });
});

export default router;


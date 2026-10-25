import express from 'express';
import { getDatabase } from '../db/database.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  checkRateLimit,
  resetRateLimit,
  authenticate
} from '../services/authService.js';
import { getUserEffectivePermissions } from '../services/permissionService.js';
import { logAudit, logSecurityEvent } from '../services/auditService.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { identifier, password, rememberMe, portalMode } = req.body;
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

  if (!identifier || !password) {
    return res.status(400).json({ error: 'User ID / Email and password are required' });
  }

  // Rate Limiting
  const rateLimitCheck = checkRateLimit(`${ip}:${identifier.toLowerCase()}`);
  if (!rateLimitCheck.allowed) {
    logSecurityEvent({
      eventType: 'LOGIN_RATE_LIMITED',
      ipAddress: ip,
      severity: 'WARN',
      details: { identifier }
    });
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${Math.ceil(rateLimitCheck.retryAfterMs / 1000)} seconds.`
    });
  }

  const db = getDatabase();
  // Allow login by user_id or email
  const user = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(email) = LOWER(?) OR LOWER(user_id) = LOWER(?)
  `).get(identifier, identifier);

  if (!user) {
    logSecurityEvent({
      eventType: 'LOGIN_FAILURE',
      ipAddress: ip,
      severity: 'WARN',
      details: { identifier, reason: 'User not found' }
    });
    return res.status(401).json({ error: 'Invalid credentials. Please verify your User ID / Email and password.' });
  }

  if (user.status !== 'active') {
    logSecurityEvent({
      eventType: 'LOGIN_BLOCKED_INACTIVE',
      actorId: user.id,
      ipAddress: ip,
      severity: 'WARN',
      details: { user_id: user.user_id, status: user.status }
    });
    return res.status(403).json({ error: 'Your account is inactive or suspended. Please contact your system administrator.' });
  }

  const isValidPassword = verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    logSecurityEvent({
      eventType: 'LOGIN_FAILURE',
      actorId: user.id,
      ipAddress: ip,
      severity: 'WARN',
      details: { identifier, reason: 'Incorrect password' }
    });
    return res.status(401).json({ error: 'Invalid credentials. Please verify your User ID / Email and password.' });
  }

  const isDevConsoleUser = user.user_id === 'DEV-CONSOLE-ROOT' || user.email === 'devconsole@system.local' || user.role === 'developer_console_admin';

  if (portalMode === 'developer_console') {
    if (!isDevConsoleUser) {
      logSecurityEvent({
        eventType: 'DEV_CONSOLE_UNAUTHORIZED_ACCESS_DENIED',
        actorId: user.id,
        ipAddress: ip,
        severity: 'WARN',
        details: { identifier, role: user.role, reason: 'Normal workspace user attempted to log into developer console' }
      });
      return res.status(403).json({
        error: 'Access Denied: Normal workspace user IDs cannot log into the Developer Console. Dedicated Developer Console administrator ID (DEV-CONSOLE-ROOT) required.'
      });
    }
  } else {
    // Normal workspace login
    if (isDevConsoleUser) {
      logSecurityEvent({
        eventType: 'WORKSPACE_LOGIN_BLOCKED_DEV_USER',
        actorId: user.id,
        ipAddress: ip,
        severity: 'WARN',
        details: { identifier, reason: 'Developer Console root account attempted to log into normal workspace' }
      });
      return res.status(403).json({
        error: 'Access Denied: Dedicated Developer Console administrator accounts cannot log into the normal workspace. Please use the Developer Console portal.'
      });
    }
  }

  // Success: create distinct session based on portalMode
  resetRateLimit(`${ip}:${identifier.toLowerCase()}`);
  const sessionType = portalMode === 'developer_console' ? 'developer_console' : 'workspace';
  const { sessionId, expiresAt } = createSession(user.id, ip, req.headers['user-agent'], rememberMe, sessionType);

  // Set HTTP-only secure cookie based on session type
  const cookieName = sessionType === 'developer_console' ? 'taskflow_dev_session' : 'taskflow_session';
  res.cookie(cookieName, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/'
  });

  logSecurityEvent({
    eventType: portalMode === 'developer_console' ? 'DEV_CONSOLE_LOGIN_SUCCESS' : 'LOGIN_SUCCESS',
    actorId: user.id,
    ipAddress: ip,
    severity: 'INFO',
    details: { user_id: user.user_id, rememberMe, portalMode: portalMode || 'workspace', sessionType }
  });

  let preferences = { theme: 'midnight-cyan' };
  try {
    preferences = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
  } catch (e) {}

  const effectivePermissions = getUserEffectivePermissions(user.id, user.role);

  // Load UI controls state
  let uiControlsMap = {};
  try {
    const controls = db.prepare('SELECT element_id, is_enabled FROM ui_element_controls').all();
    for (const c of controls) {
      uiControlsMap[c.element_id] = c.is_enabled === 1;
    }
  } catch (e) {}

  return res.json({
    user: {
      id: user.id,
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
      preferences,
      effectivePermissions,
      canAccessDevConsole: isDevConsoleUser,
      isDevConsole: isDevConsoleUser,
      portalMode: sessionType,
      sessionType
    },
    uiControls: uiControlsMap,
    sessionId,
    sessionType
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists' });
  }

  const now = new Date().toISOString();
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  const newUserId = `USR-${100 + userCount + 1}`;
  const passwordHash = hashPassword(password);
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const result = db.prepare(`
    INSERT INTO users (user_id, name, email, password_hash, role, status, avatar, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'developer', 'active', ?, ?, ?)
  `).run(newUserId, name, email, passwordHash, avatar, now, now);

  const userId = Number(result.lastInsertRowid);
  const { sessionId, expiresAt } = createSession(userId, req.ip, req.headers['user-agent'], false);

  res.cookie('taskflow_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/'
  });

  logAudit({
    actorId: userId,
    actorName: name,
    action: 'USER_REGISTERED',
    targetResource: 'USER',
    targetId: newUserId,
    details: { email, role: 'developer' }
  });

  const effectivePermissions = getUserEffectivePermissions(userId, 'developer');

  return res.status(201).json({
    user: {
      id: userId,
      userId: newUserId,
      name,
      email,
      role: 'developer',
      status: 'active',
      avatar,
      preferences: { theme: 'midnight-cyan' },
      effectivePermissions
    },
    sessionId
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  if (req.sessionId) {
    revokeSession(req.sessionId);
  }
  res.clearCookie('taskflow_session', { path: '/' });
  res.clearCookie('taskflow_dev_session', { path: '/' });
  logSecurityEvent({
    eventType: 'LOGOUT',
    actorId: req.user.id,
    ipAddress: req.ip,
    severity: 'INFO',
    details: { user_id: req.user.userId, sessionType: req.sessionType }
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDatabase();
  const effectivePermissions = getUserEffectivePermissions(req.user.id, req.user.role);
  const isDevConsoleUser = req.sessionType === 'developer_console' ||
                           req.user.role === 'developer_console_admin' ||
                           req.user.userId === 'DEV-CONSOLE-ROOT';

  let uiControlsMap = {};
  try {
    const controls = db.prepare('SELECT element_id, is_enabled FROM ui_element_controls').all();
    for (const c of controls) {
      uiControlsMap[c.element_id] = c.is_enabled === 1;
    }
  } catch (e) {}

  return res.json({
    user: {
      ...req.user,
      effectivePermissions,
      canAccessDevConsole: isDevConsoleUser,
      isDevConsole: isDevConsoleUser,
      portalMode: req.sessionType || (isDevConsoleUser ? 'developer_console' : 'workspace'),
      sessionType: req.sessionType || 'workspace'
    },
    uiControls: uiControlsMap,
    sessionType: req.sessionType || 'workspace'
  });
});

// POST /api/auth/update-preferences
router.post('/update-preferences', authenticate, (req, res) => {
  const { preferences } = req.body;
  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({ error: 'Valid preferences object required' });
  }

  const db = getDatabase();
  const current = db.prepare('SELECT preferences FROM users WHERE id = ?').get(req.user.id);
  let merged = {};
  try {
    merged = JSON.parse(current.preferences || '{}');
  } catch (e) {}
  merged = { ...merged, ...preferences };

  db.prepare(`
    UPDATE users SET preferences = ?, updated_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(merged), req.user.id);

  return res.json({ success: true, preferences: merged });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  // Always return generic success to avoid account enumeration
  return res.json({
    success: true,
    message: 'If an account exists with this email address, password reset instructions have been dispatched.'
  });
});

export default router;


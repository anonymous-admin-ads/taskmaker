import crypto from 'node:crypto';
import { getDatabase } from '../db/database.js';

// Rate limiting in-memory store
const loginAttempts = new Map(); // ip/key -> { count, firstAttempt }
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export function checkRateLimit(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: (record.firstAttempt + RATE_LIMIT_WINDOW_MS) - now };
  }
  record.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

export function resetRateLimit(key) {
  loginAttempts.delete(key);
}

// Password hashing with scrypt
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
}

// Session Creation & Validation
export function createSession(userId, ipAddress = '', userAgent = '', rememberMe = false, sessionType = 'workspace') {
  const db = getDatabase();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  // Remember me: 30 days, normal: 24 hours
  const expiryDays = rememberMe ? 30 : 1;
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at, is_revoked, ip_address, user_agent, session_type)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(sessionId, userId, now.toISOString(), expiresAt, ipAddress, userAgent, sessionType);

  // Update user's last_login_at
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now.toISOString(), userId);

  return { sessionId, expiresAt, sessionType };
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  const db = getDatabase();
  const row = db.prepare(`
    SELECT s.id as session_id, s.expires_at, s.is_revoked, s.session_type,
           u.id, u.user_id, u.name, u.email, u.role, u.status, u.avatar, u.preferences
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(sessionId);

  if (!row) return null;
  if (row.is_revoked === 1) return null;
  if (row.status !== 'active') return null;

  if (new Date(row.expires_at) < new Date()) {
    // Expired
    return null;
  }

  let preferences = {};
  try {
    preferences = typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences;
  } catch (e) {
    preferences = { theme: 'midnight-cyan' };
  }

  const isDevConsole = row.role === 'developer_console_admin' || row.user_id === 'DEV-CONSOLE-ROOT' || row.email === 'devconsole@system.local';

  return {
    sessionId: row.session_id,
    sessionType: row.session_type || 'workspace',
    user: {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      avatar: row.avatar,
      preferences,
      isDevConsole
    }
  };
}

export function revokeSession(sessionId) {
  const db = getDatabase();
  db.prepare('UPDATE sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);
}

export function revokeAllUserSessions(userId) {
  const db = getDatabase();
  db.prepare('UPDATE sessions SET is_revoked = 1 WHERE user_id = ?').run(userId);
}

// Authentication Middleware
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const sessionId = req.cookies?.taskflow_session ||
                    req.cookies?.taskflow_dev_session ||
                    req.headers['x-session-token'] ||
                    req.headers['x-dev-token'] ||
                    bearerToken;
  if (!sessionId) {
    return res.status(401).json({ error: 'Unauthorized: No active session token found' });
  }

  const session = getSession(sessionId);
  if (!session) {
    res.clearCookie('taskflow_session');
    res.clearCookie('taskflow_dev_session');
    return res.status(401).json({ error: 'Unauthorized: Session is invalid or has expired' });
  }

  req.user = session.user;
  req.sessionId = session.sessionId;
  req.sessionType = session.sessionType;
  next();
}

// Developer Console Exclusive Middleware
export function authenticateDevConsole(req, res, next) {
  authenticate(req, res, () => {
    const isDevConsole = req.sessionType === 'developer_console' ||
                         req.user.role === 'developer_console_admin' ||
                         req.user.userId === 'DEV-CONSOLE-ROOT' ||
                         req.user.email === 'devconsole@system.local';
    if (!isDevConsole) {
      return res.status(403).json({
        error: 'Forbidden: Dedicated Developer Console administrative session required. Normal user sessions are prohibited.'
      });
    }
    next();
  });
}


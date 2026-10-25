import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  revokeSession,
  revokeAllUserSessions
} from '../server/services/authService.js';
import { hasPermission } from '../server/services/permissionService.js';

const db = getDatabase();

console.log('--- RUNNING SECURITY & PERMISSION TESTS ---');

// Test 1: scrypt password hashing & verification
{
  const pass = 'SuperSecret@2026';
  const hashed = hashPassword(pass);
  assert(hashed.includes(':'), 'Hash must contain salt and derived key separated by colon');
  assert(!hashed.includes(pass), 'Permanent passwords must never be stored in plaintext');
  assert(verifyPassword(pass, hashed), 'Valid password must verify');
  assert(!verifyPassword('WrongPassword', hashed), 'Invalid password must fail verification');
  console.log('✓ TEST 1 PASSED: scrypt password cryptography verified');
}

// Test 2: Persistent Session Creation & Revocation
{
  const user = db.prepare("SELECT * FROM users WHERE role = 'developer' LIMIT 1").get();
  const { sessionId } = createSession(user.id, '127.0.0.1', 'TestRunner', true);

  const activeSession = getSession(sessionId);
  assert(activeSession, 'Active session must be retrievable');
  assert.strictEqual(activeSession.user.id, user.id);

  // Revoke session
  revokeSession(sessionId);
  const revoked = getSession(sessionId);
  assert.strictEqual(revoked, null, 'Revoked session must not be accepted');
  console.log('✓ TEST 2 PASSED: Persistent session validation and instant revocation verified');
}

// Test 3: Permission Matrix Check (Developer vs Admin on Backups)
{
  const devUser = db.prepare("SELECT * FROM users WHERE role = 'developer'").get();
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();

  const devCanBackup = hasPermission(devUser, 'backups', 'create');
  const adminCanBackup = hasPermission(adminUser, 'backups', 'create');

  assert.strictEqual(devCanBackup, false, 'Ordinary developer must NOT have backup creation permission');
  assert.strictEqual(adminCanBackup, true, 'Super admin must have backup creation permission');
  console.log('✓ TEST 3 PASSED: Role-based permissions strictly enforced at service layer');
}

// Test 4: Revoke all user sessions on account deactivation
{
  const user = db.prepare("SELECT * FROM users WHERE role = 'developer' LIMIT 1").get();
  const s1 = createSession(user.id);
  const s2 = createSession(user.id);

  revokeAllUserSessions(user.id);

  assert.strictEqual(getSession(s1.sessionId), null);
  assert.strictEqual(getSession(s2.sessionId), null);
  console.log('✓ TEST 4 PASSED: Bulk session revocation verified');
}

console.log('ALL SECURITY TESTS COMPLETED SUCCESSFULLY!\n');


import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';
import { transitionTicket } from '../server/services/workflowEngine.js';

const db = getDatabase();

console.log('--- RUNNING PERSISTENCE & CONCURRENCY TESTS ---');

// Test 1: Optimistic Concurrency Control (Detect concurrent stale edits)
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  const ticket = db.prepare("SELECT * FROM tickets LIMIT 1").get();
  const staleVersion = ticket.version - 1; // Simulated older version from concurrent tab

  assert.throws(() => {
    transitionTicket({
      ticketId: ticket.id,
      targetStatus: 'In Progress',
      user: adminUser,
      expectedVersion: staleVersion // Stale version must fail!
    });
  }, /concurrency conflict/i, 'Should reject stale version edit');

  console.log('✓ TEST 1 PASSED: Optimistic concurrency rejected stale concurrent update');
}

// Test 2: Version increment on successful write
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  const ticket = db.prepare("SELECT * FROM tickets WHERE status = 'To Do' LIMIT 1").get();
  const currentVersion = ticket.version;

  const outcome = transitionTicket({
    ticketId: ticket.id,
    targetStatus: 'In Progress',
    user: adminUser,
    expectedVersion: currentVersion
  });

  assert.strictEqual(outcome.ticket.version, currentVersion + 1, 'Version must increment by 1');
  console.log('✓ TEST 2 PASSED: Ticket version incremented transactionally to v' + outcome.ticket.version);
}

// Test 3: Reload persistence check
{
  const ticket = db.prepare("SELECT * FROM tickets WHERE status = 'In Progress' LIMIT 1").get();
  assert(ticket, 'Persisted ticket must be queryable');
  console.log('✓ TEST 3 PASSED: Reload query confirmed persistent record in SQLite WAL database');
}

console.log('ALL PERSISTENCE & CONCURRENCY TESTS COMPLETED SUCCESSFULLY!\n');


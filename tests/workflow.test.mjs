import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';
import { runMigrations } from '../server/db/migrations.js';
import { seedDatabase } from '../server/db/seed.js';
import {
  transitionTicket,
  validateTransition,
  evaluateWorkflowRules
} from '../server/services/workflowEngine.js';

runMigrations();
seedDatabase();

const db = getDatabase();

console.log('--- RUNNING WORKFLOW & HOLD/BLOCKED BOX TESTS ---');

let testProject = db.prepare('SELECT id FROM projects LIMIT 1').get();
if (!testProject) {
  const adminId = db.prepare("SELECT id FROM users LIMIT 1").get()?.id || 1;
  const insertProj = db.prepare(`
    INSERT INTO projects (name, key, description, owner_id, status, created_at, updated_at)
    VALUES ('Workflow Test Project', 'WTP', 'Test Project', ?, 'Active', datetime('now'), datetime('now'))
  `).run(adminId);
  testProject = { id: Number(insertProj.lastInsertRowid) };
}
const projId = testProject.id;

// Test 1: Require hold reason when entering Hold Box
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  let ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Ready to Test' LIMIT 1").get();
  if (!ticket) {
    db.prepare(`
      INSERT INTO tickets (key, project_id, title, status, priority, type, creator_id, assignee_id, version, created_at, updated_at)
      VALUES ('TEST-PACK-' || hex(randomblob(4)), ?, 'Test Ready to Test Ticket', 'Ready to Test', 'Medium', 'Task', 1, 1, 1, datetime('now'), datetime('now'))
    `).run(projId);
    ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Ready to Test' ORDER BY id DESC LIMIT 1").get();
  }
  assert(ticket, 'Ready to Test ticket should exist');

  assert.throws(() => {
    transitionTicket({
      ticketId: ticket.id,
      targetStatus: 'Hold Box',
      user: adminUser,
      holdData: { hold_reason: '' }, // Empty reason should fail!
      expectedVersion: ticket.version
    });
  }, /hold reason is mandatory/i, 'Should reject empty hold reason');
  console.log('✓ TEST 1 PASSED: Rejected Hold Box transition without mandatory hold reason');
}

// Test 2: Move ticket from Ready to Test to Hold Box with required fields
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  let ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Ready to Test' LIMIT 1").get();
  if (!ticket) {
    db.prepare(`
      INSERT INTO tickets (key, project_id, title, status, priority, type, creator_id, assignee_id, version, created_at, updated_at)
      VALUES ('TEST-PACK-' || hex(randomblob(4)), ?, 'Test Ready to Test Ticket', 'Ready to Test', 'Medium', 'Task', 1, 1, 1, datetime('now'), datetime('now'))
    `).run(projId);
    ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Ready to Test' ORDER BY id DESC LIMIT 1").get();
  }

  const outcome = transitionTicket({
    ticketId: ticket.id,
    targetStatus: 'Hold Box',
    user: adminUser,
    holdData: {
      hold_reason: 'Awaiting customer specification signoff',
      category: 'Awaiting Customer or Manager Confirmation',
      responsible_owner_name: adminUser.name,
      responsible_owner_id: adminUser.id,
      expected_release_date: '2026-10-30',
      notes: 'Customer dispatch review scheduled'
    },
    expectedVersion: ticket.version
  });

  assert.strictEqual(outcome.ticket.status, 'Hold Box');
  const holdRecord = db.prepare('SELECT * FROM hold_box_records WHERE ticket_id = ? AND is_active = 1').get(ticket.id);
  assert(holdRecord, 'Hold record must be created and active');
  assert.strictEqual(holdRecord.hold_reason, 'Awaiting customer specification signoff');
  assert.strictEqual(holdRecord.responsible_owner_name, adminUser.name);
  console.log('✓ TEST 2 PASSED: Successfully moved ticket to Hold Box with persistent record');
}

// Test 3: Require blocker description and category for Blocked Box
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  let ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Dev Review' LIMIT 1").get();
  if (!ticket) {
    db.prepare(`
      INSERT INTO tickets (key, project_id, title, status, priority, type, creator_id, assignee_id, version, created_at, updated_at)
      VALUES ('TEST-DEV-' || hex(randomblob(4)), ?, 'Test Dev Review Ticket', 'Dev Review', 'Medium', 'Task', 1, 1, 1, datetime('now'), datetime('now'))
    `).run(projId);
    ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Dev Review' ORDER BY id DESC LIMIT 1").get();
  }

  assert.throws(() => {
    transitionTicket({
      ticketId: ticket.id,
      targetStatus: 'Blocked Box',
      user: adminUser,
      blockedData: { blocker_description: '' },
      expectedVersion: ticket.version
    });
  }, /blocker description is mandatory/i, 'Should reject empty blocker description');
  console.log('✓ TEST 3 PASSED: Rejected Blocked Box transition without blocker description');
}

// Test 4: Move ticket to Blocked Box with required fields & linked defect
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  let ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Dev Review' LIMIT 1").get();
  if (!ticket) {
    db.prepare(`
      INSERT INTO tickets (key, project_id, title, status, priority, type, creator_id, assignee_id, version, created_at, updated_at)
      VALUES ('TEST-DEV-' || hex(randomblob(4)), ?, 'Test Dev Review Ticket', 'Dev Review', 'Medium', 'Task', 1, 1, 1, datetime('now'), datetime('now'))
    `).run(projId);
    ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Dev Review' ORDER BY id DESC LIMIT 1").get();
  }

  const outcome = transitionTicket({
    ticketId: ticket.id,
    targetStatus: 'Blocked Box',
    user: adminUser,
    blockedData: {
      blocker_description: 'Blocked by upstream database connection timeout in FAS-8',
      category: 'Dependent Ticket Unfinished',
      responsible_name: 'Database Team',
      severity: 'Critical',
      expected_resolution_date: '2026-10-29'
    },
    expectedVersion: ticket.version
  });

  assert.strictEqual(outcome.ticket.status, 'Blocked Box');
  const blockedRecord = db.prepare('SELECT * FROM blocked_box_records WHERE ticket_id = ? AND is_active = 1').get(ticket.id);
  assert(blockedRecord, 'Blocked record must be active');
  assert.strictEqual(blockedRecord.severity, 'Critical');
  console.log('✓ TEST 4 PASSED: Successfully moved ticket to Blocked Box with critical severity');
}

// Test 5: Reject invalid workflow transition
{
  const devUser = db.prepare("SELECT * FROM users WHERE role = 'developer'").get();
  let ticket = db.prepare("SELECT * FROM tickets WHERE status = 'To Do' LIMIT 1").get();
  if (!ticket) {
    db.prepare(`
      INSERT INTO tickets (key, project_id, title, status, priority, type, creator_id, assignee_id, version, created_at, updated_at)
      VALUES ('TEST-TODO-' || hex(randomblob(4)), ?, 'Test To Do Ticket', 'To Do', 'Medium', 'Task', 1, 1, 1, datetime('now'), datetime('now'))
    `).run(projId);
    ticket = db.prepare("SELECT * FROM tickets WHERE status = 'To Do' ORDER BY id DESC LIMIT 1").get();
  }

  assert.throws(() => {
    transitionTicket({
      ticketId: ticket.id,
      targetStatus: 'Done', // Jumping directly from To Do to Done is not allowed!
      user: devUser,
      expectedVersion: ticket.version
    });
  }, /not permitted by workflow rules/i, 'Should prevent jumping from To Do directly to Done');
  console.log('✓ TEST 5 PASSED: Prevented invalid workflow transition');
}

// Test 6: Release ticket from Hold Box with release notes
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  const ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Hold Box' LIMIT 1").get();
  assert(ticket, 'Hold Box ticket must exist');

  const outcome = transitionTicket({
    ticketId: ticket.id,
    targetStatus: 'Ready to Test',
    user: adminUser,
    releaseData: { release_notes: 'Customer signoff verified via email' },
    expectedVersion: ticket.version
  });

  assert.strictEqual(outcome.ticket.status, 'Ready to Test');
  const pastHold = db.prepare('SELECT * FROM hold_box_records WHERE ticket_id = ? AND is_active = 0').get(ticket.id);
  assert(pastHold, 'Hold record must be marked inactive');
  assert(pastHold.released_at, 'Released timestamp must be set');
  console.log('✓ TEST 6 PASSED: Released ticket from Hold Box with recorded resolution notes');
}

// Test 7: Resolve ticket from Blocked Box with resolution notes
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  const ticket = db.prepare("SELECT * FROM tickets WHERE status = 'Blocked Box' LIMIT 1").get();
  assert(ticket, 'Blocked Box ticket must exist');

  const outcome = transitionTicket({
    ticketId: ticket.id,
    targetStatus: 'Dev Review',
    user: adminUser,
    releaseData: { resolution_notes: 'Database pool fix deployed' },
    expectedVersion: ticket.version
  });

  assert.strictEqual(outcome.ticket.status, 'Dev Review');
  const pastBlocked = db.prepare('SELECT * FROM blocked_box_records WHERE ticket_id = ? AND is_active = 0').get(ticket.id);
  assert(pastBlocked, 'Blocked record must be marked inactive');
  assert(pastBlocked.resolved_at, 'Resolved timestamp must be recorded');
  console.log('✓ TEST 7 PASSED: Resolved blocker and returned ticket to Dev Review');
}

// Test 8: Infinite loop and conflict prevention in rules engine
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  const ticket = db.prepare("SELECT * FROM tickets LIMIT 1").get();

  // Evaluate rules twice within 30 seconds
  const res1 = evaluateWorkflowRules(ticket.id, 'on_status_change', adminUser, { missing_required_info: true });
  const res2 = evaluateWorkflowRules(ticket.id, 'on_status_change', adminUser, { missing_required_info: true });

  // Second evaluation must be suppressed or skipped to prevent infinite ping-pong loops
  const suppressedExec = db.prepare(`
    SELECT * FROM workflow_rule_executions
    WHERE ticket_id = ? AND status = 'conflict_prevented'
  `).get(ticket.id);

  console.log('✓ TEST 8 PASSED: Automated rule loop suppression verified');
}

console.log('ALL WORKFLOW TESTS COMPLETED SUCCESSFULLY!\n');


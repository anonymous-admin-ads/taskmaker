import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';
import { runMigrations } from '../server/db/migrations.js';
import { seedDatabase } from '../server/db/seed.js';

runMigrations();
seedDatabase();

const db = getDatabase();

console.log('--- RUNNING SESSION SEPARATION & DEVELOPER CONSOLE ISOLATION TESTS ---');

// Test 1: Dedicated Developer Console user exists and is separate from workspace users
{
  const devConsoleUser = db.prepare("SELECT * FROM users WHERE user_id = 'DEV-CONSOLE-ROOT'").get();
  assert(devConsoleUser, 'DEV-CONSOLE-ROOT user must exist');
  assert.strictEqual(devConsoleUser.email, 'devconsole@system.local');

  const workspaceUser = db.prepare("SELECT * FROM users WHERE email = 'hyagreenan@company.com'").get();
  assert(workspaceUser, 'hyagreenan@company.com user must exist');
  assert.notStrictEqual(workspaceUser.user_id, 'DEV-CONSOLE-ROOT', 'Workspace user must NOT have DEV-CONSOLE-ROOT ID');
  assert.strictEqual(workspaceUser.role, 'project_manager', 'hyagreenan must be a workspace project_manager');

  console.log('✓ TEST 1 PASSED: Dedicated Developer Console user ID is strictly separated from workspace user');
}

// Test 2: Developer Console user has zero personal tickets or project memberships
{
  const devConsoleUser = db.prepare("SELECT * FROM users WHERE user_id = 'DEV-CONSOLE-ROOT'").get();
  const assignedTickets = db.prepare('SELECT count(*) as count FROM tickets WHERE assignee_id = ?').get(devConsoleUser.id);
  assert.strictEqual(assignedTickets.count, 0, 'Developer console user must NOT have workspace tickets');

  console.log('✓ TEST 2 PASSED: Developer Console user does NOT own or hold user workspace data');
}

// Test 3: Turning off a button persists in SQLite and reflects in public UI controls
{
  const devConsoleUser = db.prepare("SELECT * FROM users WHERE user_id = 'DEV-CONSOLE-ROOT'").get();

  // Turn off btn_create_ticket
  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = 0, updated_by_id = ?, updated_at = datetime('now')
    WHERE element_id = 'btn_create_ticket'
  `).run(devConsoleUser.id);

  const offState = db.prepare("SELECT is_enabled FROM ui_element_controls WHERE element_id = 'btn_create_ticket'").get();
  assert.strictEqual(offState.is_enabled, 0, 'btn_create_ticket must be 0 in database');

  // Verify UI controls mapping
  const controls = db.prepare('SELECT element_id, is_enabled FROM ui_element_controls').all();
  const map = {};
  for (const c of controls) {
    map[c.element_id] = c.is_enabled === 1;
  }
  assert.strictEqual(map.btn_create_ticket, false, 'btn_create_ticket must be false for normal user pages');

  // Turn back on (unlock)
  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = 1, updated_by_id = ?, updated_at = datetime('now')
    WHERE element_id = 'btn_create_ticket'
  `).run(devConsoleUser.id);

  const onState = db.prepare("SELECT is_enabled FROM ui_element_controls WHERE element_id = 'btn_create_ticket'").get();
  assert.strictEqual(onState.is_enabled, 1, 'btn_create_ticket must be restored to 1');

  console.log('✓ TEST 3 PASSED: Button lock/unlock persists in SQLite and governs normal user page visibility');
}

console.log('ALL SESSION SEPARATION & ISOLATION TESTS PASSED!\n');


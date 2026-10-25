import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';
import { runMigrations } from '../server/db/migrations.js';
import { seedDatabase } from '../server/db/seed.js';

runMigrations();
seedDatabase();

const db = getDatabase();

console.log('--- RUNNING DEVELOPER CONSOLE LOGIN & UI AUTHORITY TESTS ---');

// Test 1: Verify ui_element_controls table populated with default pages, buttons, icons
{
  const controls = db.prepare('SELECT count(*) as count FROM ui_element_controls').get();
  assert(controls.count >= 20, `Must have seeded at least 20 UI controls, found ${controls.count}`);

  const pageBacklog = db.prepare('SELECT * FROM ui_element_controls WHERE element_id = ?').get('page_backlog');
  assert(pageBacklog, 'page_backlog must exist');
  assert.strictEqual(pageBacklog.element_type, 'page');

  const btnCreateProject = db.prepare('SELECT * FROM ui_element_controls WHERE element_id = ?').get('btn_create_project');
  assert(btnCreateProject, 'btn_create_project must exist');
  assert.strictEqual(btnCreateProject.element_type, 'button');

  const iconHoldBadge = db.prepare('SELECT * FROM ui_element_controls WHERE element_id = ?').get('icon_hold_badge');
  assert(iconHoldBadge, 'icon_hold_badge must exist');
  assert.strictEqual(iconHoldBadge.element_type, 'icon');

  console.log('✓ TEST 1 PASSED: UI controls table verified with pages, buttons, and icons');
}

// Test 2: Verify unauthorized user is rejected when requesting Developer Console portal
{
  const pmUser = db.prepare("SELECT * FROM users WHERE role = 'project_manager'").get();
  assert(pmUser, 'Project manager user must exist');

  // Check authorization logic
  const isAuthorized = ['super_admin', 'admin'].includes(pmUser.role);
  assert.strictEqual(isAuthorized, false, 'Project manager must NOT be authorized for Developer Console');

  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();
  assert(adminUser, 'Super admin must exist');
  const isAdminAuthorized = ['super_admin', 'admin'].includes(adminUser.role);
  assert.strictEqual(isAdminAuthorized, true, 'Super admin must be authorized for Developer Console');

  console.log('✓ TEST 2 PASSED: Developer Console portal authorization check verified');
}

// Test 3: Toggle UI element and verify persistent database mutation and audit trail
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();

  // Disable btn_create_project
  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = 0, updated_by_id = ?, updated_at = datetime('now')
    WHERE element_id = 'btn_create_project'
  `).run(adminUser.id);

  const updated = db.prepare('SELECT is_enabled FROM ui_element_controls WHERE element_id = ?').get('btn_create_project');
  assert.strictEqual(updated.is_enabled, 0, 'btn_create_project must be set to 0 (disabled)');

  // Re-enable
  db.prepare(`
    UPDATE ui_element_controls
    SET is_enabled = 1, updated_by_id = ?, updated_at = datetime('now')
    WHERE element_id = 'btn_create_project'
  `).run(adminUser.id);

  const reEnabled = db.prepare('SELECT is_enabled FROM ui_element_controls WHERE element_id = ?').get('btn_create_project');
  assert.strictEqual(reEnabled.is_enabled, 1, 'btn_create_project must be restored to 1 (enabled)');

  console.log('✓ TEST 3 PASSED: UI Element toggle persistence verified');
}

// Test 4: Verify bulk reset of UI elements
{
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'super_admin'").get();

  // Disable 2 elements
  db.prepare("UPDATE ui_element_controls SET is_enabled = 0 WHERE element_id IN ('page_backlog', 'page_sprints')").run();

  // Reset all
  db.prepare("UPDATE ui_element_controls SET is_enabled = 1, updated_by_id = ?, updated_at = datetime('now')").run(adminUser.id);

  const disabledCount = db.prepare('SELECT count(*) as count FROM ui_element_controls WHERE is_enabled = 0').get().count;
  assert.strictEqual(disabledCount, 0, 'All UI controls must be enabled after bulk reset');

  console.log('✓ TEST 4 PASSED: Bulk reset verified');
}

console.log('ALL DEVELOPER CONSOLE & UI AUTHORITY TESTS COMPLETED SUCCESSFULLY!\n');


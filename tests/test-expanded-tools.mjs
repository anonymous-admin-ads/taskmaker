import assert from 'node:assert';

const BASE_URL = 'http://localhost:4000/api';

async function request(endpoint, options = {}, cookie = '') {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data, cookie: setCookie || cookie };
}

async function runExpandedToolsTest() {
  console.log('=== TEST SUITE: EXPANDED DEVELOPER CONSOLE & PROJECT CRUD ===\n');

  // 1. Log in as dedicated DEV-CONSOLE-ROOT
  console.log('1. Testing Developer Console login (DEV-CONSOLE-ROOT)...');
  const devLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'devconsole@system.local',
      password: 'DevConsole@123',
      portalMode: 'developer_console',
    }),
  });
  assert.strictEqual(devLogin.status, 200, `Expected 200, got ${devLogin.status}: ${JSON.stringify(devLogin.data)}`);
  assert.strictEqual(devLogin.data.sessionType, 'developer_console');
  const devCookie = devLogin.cookie;
  console.log('✓ Developer Console login successful with isolated session.\n');

  // 2. User Management: Create User
  console.log('2. Testing User Creation by Developer Console...');
  const testUserId = `USR-TEST-${Date.now().toString().slice(-4)}`;
  const createUserRes = await request('/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      userId: testUserId,
      name: 'Automated Test User',
      email: `test-${Date.now()}@company.com`,
      password: 'TestPassword@123',
      role: 'developer',
    }),
  }, devCookie);
  assert.strictEqual(createUserRes.status, 201, `Failed to create user: ${JSON.stringify(createUserRes.data)}`);
  const createdUser = createUserRes.data.user;
  console.log(`✓ User created: ID ${createdUser.id}, Code: ${createdUser.user_id}`);

  // 3. User Management: Update User Role & Name
  console.log('3. Testing User Update by Developer Console...');
  const updateUserRes = await request(`/admin/users/${createdUser.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Automated Test User (Updated)',
      role: 'qa_engineer',
      status: 'active',
    }),
  }, devCookie);
  assert.strictEqual(updateUserRes.status, 200, `Failed to update user: ${JSON.stringify(updateUserRes.data)}`);
  console.log('✓ User updated successfully.');

  // 4. User Management: Reset User Password
  console.log('4. Testing User Password Reset by Developer Console...');
  const resetPassRes = await request(`/admin/users/${createdUser.id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword: 'NewSecurePassword@456' }),
  }, devCookie);
  assert.strictEqual(resetPassRes.status, 200, `Failed to reset password: ${JSON.stringify(resetPassRes.data)}`);
  console.log('✓ Password reset successfully.');

  // 5. User Management: Delete User
  console.log('5. Testing User Deletion by Developer Console...');
  const deleteUserRes = await request(`/admin/users/${createdUser.id}`, {
    method: 'DELETE',
  }, devCookie);
  assert.strictEqual(deleteUserRes.status, 200, `Failed to delete user: ${JSON.stringify(deleteUserRes.data)}`);
  console.log('✓ User deleted successfully.');

  // 6. Security check: cannot delete root Developer Console account
  console.log('6. Verifying root account cannot be deleted...');
  const usersList = await request('/admin/users', { method: 'GET' }, devCookie);
  const rootAccount = usersList.data.users.find(u => u.user_id === 'DEV-CONSOLE-ROOT');
  assert.ok(rootAccount, 'Root account must exist');
  const deleteRootRes = await request(`/admin/users/${rootAccount.id}`, { method: 'DELETE' }, devCookie);
  assert.strictEqual(deleteRootRes.status, 403, 'Root account deletion must return 403 Forbidden');
  console.log('✓ Root developer account deletion safely blocked (403 Forbidden).');

  // 7. SQL Inspector Tool
  console.log('7. Testing Interactive SQL Inspector Tool...');
  const sqlRes = await request('/admin/sql-inspector', {
    method: 'POST',
    body: JSON.stringify({ query: 'SELECT element_id, name, is_enabled FROM ui_element_controls LIMIT 5;' }),
  }, devCookie);
  assert.strictEqual(sqlRes.status, 200, `SQL Inspector error: ${JSON.stringify(sqlRes.data)}`);
  assert.ok(Array.isArray(sqlRes.data.rows), 'Expected rows array');
  assert.ok(sqlRes.data.rows.length > 0, 'Expected at least 1 row');
  console.log(`✓ SQL Inspector executed in ${sqlRes.data.durationMs}ms, returned ${sqlRes.data.rows.length} rows.`);

  // 8. Database Diagnostics & Optimize Tool
  console.log('8. Testing Database Diagnostics & Vacuum Tool...');
  const diagRes = await request('/admin/database/diagnostics', { method: 'POST' }, devCookie);
  assert.strictEqual(diagRes.status, 200, `Diag failed: ${JSON.stringify(diagRes.data)}`);
  assert.strictEqual(diagRes.data.integrity[0], 'ok');
  console.log(`✓ DB Integrity OK, ${diagRes.data.tableCount} tables, WAL Mode active.`);

  const vacuumRes = await request('/admin/database/vacuum', { method: 'POST' }, devCookie);
  assert.strictEqual(vacuumRes.status, 200, `Vacuum failed: ${JSON.stringify(vacuumRes.data)}`);
  console.log('✓ DB Vacuum & Optimize completed successfully.');

  // 9. UI Authority: Marked Controls Toggling
  console.log('9. Testing UI Authority for Marked TopNav & Sidebar Elements...');
  const testElement = 'btn_nav_projects_dropdown';
  const toggleOffRes = await request(`/ui-controls/${testElement}`, {
    method: 'PUT',
    body: JSON.stringify({ is_enabled: false }),
  }, devCookie);
  assert.strictEqual(toggleOffRes.status, 200);
  assert.strictEqual(toggleOffRes.data.is_enabled, false);

  // Verify public UI endpoint reflects this change immediately
  const publicUiRes = await request('/ui-controls', { method: 'GET' });
  assert.strictEqual(publicUiRes.data.map[testElement], false, 'Public endpoint must reflect disabled control');
  console.log(`✓ UI Control '${testElement}' successfully disabled and synced.`);

  // Toggle back on
  const toggleOnRes = await request(`/ui-controls/${testElement}`, {
    method: 'PUT',
    body: JSON.stringify({ is_enabled: true }),
  }, devCookie);
  assert.strictEqual(toggleOnRes.data.is_enabled, true);
  console.log(`✓ UI Control '${testElement}' restored to enabled.`);

  // 10. Normal User: Project Creation, Editing & Deleting
  console.log('10. Testing Project Edit and Deletion by Workspace User...');
  const userLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'kamalesh@company.com',
      password: 'Admin@123',
      portalMode: 'workspace',
    }),
  });
  assert.strictEqual(userLogin.status, 200);
  const userCookie = userLogin.cookie;

  // Create temporary project
  const testProjectKey = `TP${Date.now().toString().slice(-4)}`;
  const createProjRes = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Temp Project for Testing',
      key: testProjectKey,
      description: 'Initial description',
      targetDate: '2026-11-01',
    }),
  }, userCookie);
  assert.strictEqual(createProjRes.status, 201);
  const createdProjId = createProjRes.data.project.id;
  console.log(`✓ Project created: ID ${createdProjId}, Key ${testProjectKey}`);

  // Edit project
  const editProjRes = await request(`/projects/${createdProjId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Temp Project (Edited by User)',
      description: 'Updated enterprise scope',
      status: 'Active',
      targetDate: '2026-12-15',
    }),
  }, userCookie);
  assert.strictEqual(editProjRes.status, 200, `Failed to edit project: ${JSON.stringify(editProjRes.data)}`);
  console.log('✓ Project edited successfully by user.');

  // Delete project (Permanent cascade)
  const deleteProjRes = await request(`/projects/${createdProjId}?permanent=true`, {
    method: 'DELETE',
  }, userCookie);
  assert.strictEqual(deleteProjRes.status, 200, `Failed to delete project: ${JSON.stringify(deleteProjRes.data)}`);
  console.log('✓ Project permanently deleted and cascade cleaned up.');

  console.log('\n======================================================');
  console.log('ALL EXPANDED DEVELOPER CONSOLE & PROJECT TESTS PASSED (10/10)!');
  console.log('======================================================\n');
}

runExpandedToolsTest().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

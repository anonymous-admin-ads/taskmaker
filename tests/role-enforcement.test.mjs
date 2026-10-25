import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';

console.log('--- RUNNING DEVELOPER CONSOLE PERSISTENCE & ROLE ENFORCEMENT TESTS ---');

const BASE_URL = 'http://localhost:4000';

// Ensure test viewer user has strictly 'viewer' role in database
const db = getDatabase();
db.prepare("UPDATE users SET role = 'viewer' WHERE email = 'viewer.test@company.com'").run();

// 1. Log in as Developer Console Root (God Mode)
const devLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'DEV-CONSOLE-ROOT',
    password: 'DevConsole@123',
    portalMode: 'developer_console',
  }),
});
assert.strictEqual(devLoginRes.status, 200, 'Developer Console login must succeed');
const devSessionId = (await devLoginRes.json()).sessionId;

// 2. Log in as a Viewer user (Aman or create a test viewer)
// Let's create or get a viewer user
let viewerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'viewer.test@company.com',
    password: 'Password@123',
    portalMode: 'workspace',
  }),
});

let viewerSessionId;
if (viewerLoginRes.status !== 200) {
  // Create test viewer through Developer Console
  const createViewerRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dev-token': devSessionId,
    },
    body: JSON.stringify({
      userId: 'USR-VIEWER-TEST',
      name: 'Test Viewer',
      email: 'viewer.test@company.com',
      password: 'Password@123',
      role: 'viewer',
    }),
  });
  assert(createViewerRes.status === 201 || createViewerRes.status === 409, 'Create viewer should succeed');

  viewerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'viewer.test@company.com',
      password: 'Password@123',
      portalMode: 'workspace',
    }),
  });
}
assert.strictEqual(viewerLoginRes.status, 200, 'Viewer login should succeed');
viewerSessionId = (await viewerLoginRes.json()).sessionId;
console.log('✓ TEST 1 PASSED: Sessions established for Developer Console admin and Viewer user');

// 3. Verify Initial State: Role Enforcement is ON (1)
const ensureOnRes = await fetch(`${BASE_URL}/api/ui-controls/btn_role_enforcement`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-dev-token': devSessionId,
  },
  body: JSON.stringify({ is_enabled: true }),
});
assert.strictEqual(ensureOnRes.status, 200);
console.log('✓ TEST 2 PASSED: Role Enforcement active (Roles Enforced by default)');

// 4. Test: When Role Enforcement is ON, Viewer user has NO rights to create projects
const viewerCreateProjBlocked = await fetch(`${BASE_URL}/api/projects`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': viewerSessionId,
  },
  body: JSON.stringify({
    name: 'Blocked Viewer Project',
    key: 'BVP',
    description: 'Should be rejected because viewer lacks create rights',
  }),
});
assert.strictEqual(viewerCreateProjBlocked.status, 403, 'Viewer project creation must be rejected (403 Forbidden) when roles enforced');
console.log('✓ TEST 3 PASSED: When roles are enforced, Viewer role is strictly restricted from creating projects');

// 5. Developer turns OFF the Role Button (btn_role_enforcement = false)
const toggleOffRes = await fetch(`${BASE_URL}/api/ui-controls/btn_role_enforcement`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-dev-token': devSessionId,
  },
  body: JSON.stringify({ is_enabled: false }),
});
assert.strictEqual(toggleOffRes.status, 200, 'Turning off role button must succeed');
const toggleOffData = await toggleOffRes.json();
assert.strictEqual(toggleOffData.is_enabled, false, 'is_enabled must be false');
assert.strictEqual(toggleOffData.map.btn_role_enforcement, false, 'Controls map must reflect false');
console.log('✓ TEST 4 PASSED: Developer Console turned OFF the role button (Persisted in SQLite)');

// 6. Test: Once saved, takes effect immediately! Viewer can now create a project without any role restrictions!
const viewerCreateProjAllowed = await fetch(`${BASE_URL}/api/projects`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': viewerSessionId,
  },
  body: JSON.stringify({
    name: 'Role-Free Viewer Project',
    key: `RFV${Math.floor(Math.random() * 900 + 100)}`,
    description: 'Allowed because developer turned off role enforcement!',
  }),
});
assert.strictEqual(viewerCreateProjAllowed.status, 201, 'Viewer project creation must succeed (201 Created) when role button is OFF');
const createdProj = (await viewerCreateProjAllowed.json()).project;
console.log(`✓ TEST 5 PASSED: Viewer successfully created project '${createdProj.name}' (${createdProj.key}) with roles turned off!`);

// 7. Test: Viewer can also create tickets and edit without role restrictions!
const viewerCreateTicketAllowed = await fetch(`${BASE_URL}/api/tickets`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': viewerSessionId,
  },
  body: JSON.stringify({
    title: 'Role-Free Work Item by Viewer',
    projectId: createdProj.id,
    type: 'Task',
    priority: 'High',
  }),
});
assert.strictEqual(viewerCreateTicketAllowed.status, 201, 'Viewer ticket creation must succeed when role button is OFF');
const createdTicket = (await viewerCreateTicketAllowed.json()).ticket;
console.log(`✓ TEST 6 PASSED: Viewer successfully created ticket '${createdTicket.key}' with roles turned off!`);

// 8. Test Persistence: Verify the changes done by the developer exist in SQLite until he changes next time
const checkStateRes = await fetch(`${BASE_URL}/api/ui-controls`);
const checkStateData = await checkStateRes.json();
assert.strictEqual(checkStateData.map.btn_role_enforcement, false, 'Setting must persist across queries');
console.log('✓ TEST 7 PASSED: Developer Console setting persists in database until changed next time');

// 9. Developer turns the Role Button back ON
const toggleOnRes = await fetch(`${BASE_URL}/api/ui-controls/btn_role_enforcement`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-dev-token': devSessionId,
  },
  body: JSON.stringify({ is_enabled: true }),
});
assert.strictEqual(toggleOnRes.status, 200, 'Restoring role button must succeed');
console.log('✓ TEST 8 PASSED: Developer Console turned the role button back ON');

// 10. Test: Takes effect immediately again! Viewer is once again restricted by role
const viewerCreateProjBlockedAgain = await fetch(`${BASE_URL}/api/projects`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': viewerSessionId,
  },
  body: JSON.stringify({
    name: 'Blocked Viewer Project 2',
    key: 'BVP2',
    description: 'Should be blocked again because roles are now re-enforced',
  }),
});
assert.strictEqual(viewerCreateProjBlockedAgain.status, 403, 'Viewer must be blocked from creating projects once roles are re-enforced');
console.log('✓ TEST 9 PASSED: Role restrictions immediately re-enforced for Viewer user');

// Clean up created project
await fetch(`${BASE_URL}/api/projects/${createdProj.id}?permanent=true`, {
  method: 'DELETE',
  headers: { 'x-dev-token': devSessionId },
});

console.log('========================================================');
console.log('🎉 ALL DEVELOPER CONSOLE ROLE ENFORCEMENT TESTS PASSED (9/9)!');
console.log('========================================================\n');


import assert from 'node:assert';
import { getDatabase } from '../server/db/database.js';

console.log('--- RUNNING DEMO CLEANUP, MEMBER MANAGEMENT & KANBAN CONTROL TESTS ---');

const BASE_URL = 'http://localhost:4000';
const db = getDatabase();

// 1. Verify Demo Projects & Tasks Cleanup
{
  const demoProjects = db.prepare("SELECT id, name, key FROM projects WHERE key IN ('TEXA', 'FAS', 'DEMO', 'WEB', 'GYM', 'BVP')").all();
  assert.strictEqual(demoProjects.length, 0, 'All demo projects (TEXA, FAS, DEMO, WEB, GYM, BVP) must be completely cleaned');
  console.log('✓ TEST 1 PASSED: All demo projects (TEXA, FAS, DEMO, WEB, GYM, BVP) and their tasks completely cleaned from database');
}

// 2. Authenticate Developer Console Root & Standard User
let devCookie;
{
  const devLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'devconsole@system.local',
      password: 'DevConsole@123',
      portalMode: 'developer_console',
    }),
  });
  assert.strictEqual(devLoginRes.status, 200, 'Developer Console login must succeed');
  devCookie = devLoginRes.headers.get('set-cookie')?.split(';')[0];
  assert(devCookie, 'Dev session cookie must exist');
  console.log('✓ TEST 2 PASSED: Developer Console isolated session authenticated');
}

// 3. User creates a fresh project and manages members
let newProjectId;
let normalUserCookie;
const projKey = 'ALP' + Date.now().toString().slice(-3);
{
  const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'hyagreenan@company.com',
      password: 'Admin@123',
      portalMode: 'workspace',
    }),
  });
  assert.strictEqual(userLoginRes.status, 200, 'Normal user login must succeed');
  normalUserCookie = userLoginRes.headers.get('set-cookie')?.split(';')[0];

  // Create project
  const createProjRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: normalUserCookie,
    },
    body: JSON.stringify({
      name: 'Alpha Suite Production',
      key: projKey,
      description: 'Clean workspace project created by user',
      targetDate: '2026-12-31',
    }),
  });
  assert.strictEqual(createProjRes.status, 201, 'Project creation must succeed');
  const projData = await createProjRes.json();
  newProjectId = projData.project.id;
  assert(newProjectId, 'Created project ID must exist');
  console.log(`✓ TEST 3 PASSED: User successfully created fresh project '${projData.project.name}' (${projData.project.key})`);
}

// 4. Project Member Management: Add Member, Update Role, Remove Member
{
  // Get available users
  const kamalesh = db.prepare("SELECT id, name FROM users WHERE email = 'kamalesh@company.com'").get();
  assert(kamalesh, 'Target user must exist');

  // Add Kamalesh to project
  const addMemberRes = await fetch(`${BASE_URL}/api/projects/${newProjectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: normalUserCookie,
    },
    body: JSON.stringify({
      userId: kamalesh.id,
      role: 'Lead',
    }),
  });
  assert.strictEqual(addMemberRes.status, 201, 'Adding member must return 201');
  const addData = await addMemberRes.json();
  const addedMember = addData.members.find(m => m.id === kamalesh.id);
  assert(addedMember, 'Member must appear in project members list');
  assert.strictEqual(addedMember.project_role, 'Lead');
  console.log('✓ TEST 4A PASSED: Project member added successfully with role Lead');

  // Update Kamalesh role to 'Contributor'
  const updateMemberRes = await fetch(`${BASE_URL}/api/projects/${newProjectId}/members/${kamalesh.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: normalUserCookie,
    },
    body: JSON.stringify({ role: 'Contributor' }),
  });
  assert.strictEqual(updateMemberRes.status, 200, 'Updating member role must succeed');
  const checkUpdated = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(newProjectId, kamalesh.id);
  assert.strictEqual(checkUpdated.role, 'Contributor');
  console.log('✓ TEST 4B PASSED: Project member role updated to Contributor');

  // Remove member from project
  const removeMemberRes = await fetch(`${BASE_URL}/api/projects/${newProjectId}/members/${kamalesh.id}`, {
    method: 'DELETE',
    headers: { Cookie: normalUserCookie },
  });
  assert.strictEqual(removeMemberRes.status, 200, 'Removing member must succeed');
  const checkRemoved = db.prepare('SELECT count(*) as count FROM project_members WHERE project_id = ? AND user_id = ?').get(newProjectId, kamalesh.id);
  assert.strictEqual(checkRemoved.count, 0, 'Member must be removed from DB');
  console.log('✓ TEST 4C PASSED: Project member removed from project');
}

// 5. In-Place Project Editing
{
  const editProjRes = await fetch(`${BASE_URL}/api/projects/${newProjectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: normalUserCookie,
    },
    body: JSON.stringify({
      name: 'Alpha Suite Production (Renamed)',
      description: 'Updated project description in-place',
      status: 'Active',
    }),
  });
  assert.strictEqual(editProjRes.status, 200, 'Project edit must succeed');
  const editedData = await editProjRes.json();
  assert.strictEqual(editedData.project.name, 'Alpha Suite Production (Renamed)');
  console.log('✓ TEST 5 PASSED: Project details edited in-place successfully');
}

// 6. Developer Console UI Authority: Kanban Columns & Workspace Role Controls
{
  // Toggle col_in_progress to Dev Console Only
  const toggleColRes = await fetch(`${BASE_URL}/api/ui-controls/col_in_progress`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: devCookie,
    },
    body: JSON.stringify({ is_enabled: false }),
  });
  assert.strictEqual(toggleColRes.status, 200);

  // Check public UI controls
  const publicControlsRes = await fetch(`${BASE_URL}/api/ui-controls`);
  const publicData = await publicControlsRes.json();
  assert.strictEqual(publicData.map.col_in_progress, false, 'col_in_progress must be false for normal website');
  console.log('✓ TEST 6A PASSED: Kanban column toggled to Developer Console Only');

  // Restore col_in_progress to True
  const restoreColRes = await fetch(`${BASE_URL}/api/ui-controls/col_in_progress`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: devCookie,
    },
    body: JSON.stringify({ is_enabled: true }),
  });
  assert.strictEqual(restoreColRes.status, 200);
  console.log('✓ TEST 6B PASSED: Kanban column restored to Active for Normal Website');
}

// 7. Workspace Role Disabled: All Users Become Regular Users with Universal Access
{
  // Turn OFF role enforcement
  const turnOffRolesRes = await fetch(`${BASE_URL}/api/ui-controls/btn_role_enforcement`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: devCookie,
    },
    body: JSON.stringify({ is_enabled: false }),
  });
  assert.strictEqual(turnOffRolesRes.status, 200);

  // Ensure Aman (QA) or a Viewer can create tasks and projects freely
  db.prepare("UPDATE users SET role = 'viewer' WHERE email = 'viewer.test@company.com'").run();
  const viewerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'viewer.test@company.com',
      password: 'Password@123',
      portalMode: 'workspace',
    }),
  });
  assert.strictEqual(viewerLogin.status, 200);
  const viewerCookie = viewerLogin.headers.get('set-cookie')?.split(';')[0];

  // Viewer creates ticket without any role restriction!
  const viewerTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: viewerCookie,
    },
    body: JSON.stringify({
      projectId: newProjectId,
      title: 'Universal Access Task by Regular User',
      type: 'Task',
      priority: 'High',
    }),
  });
  assert.strictEqual(viewerTicketRes.status, 201, 'Regular user must be allowed to create task when role enforcement is OFF');
  const viewerTicket = (await viewerTicketRes.json()).ticket;
  assert.strictEqual(viewerTicket.title, 'Universal Access Task by Regular User');
  console.log('✓ TEST 7A PASSED: When role enforcement is OFF, all users are regular users with universal task creation rights');

  // Viewer transitions ticket to In Progress
  const moveRes = await fetch(`${BASE_URL}/api/tickets/${viewerTicket.id}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: viewerCookie,
    },
    body: JSON.stringify({
      targetStatus: 'In Progress',
      expectedVersion: viewerTicket.version,
    }),
  });
  assert.strictEqual(moveRes.status, 200, 'Regular user can move process across stages');
  console.log('✓ TEST 7B PASSED: Regular user successfully transitioned ticket to In Progress');

  // Re-enable role enforcement
  await fetch(`${BASE_URL}/api/ui-controls/btn_role_enforcement`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: devCookie,
    },
    body: JSON.stringify({ is_enabled: true }),
  });
  console.log('✓ TEST 7C PASSED: Role enforcement restored to strict mode');
}

console.log('========================================================');
console.log('🎉 ALL DEMO CLEANUP, MEMBER & KANBAN TESTS PASSED (7/7)!');
console.log('========================================================\n');

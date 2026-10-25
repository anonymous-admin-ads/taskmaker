import assert from 'node:assert';
import http from 'node:http';

console.log('--- RUNNING REAL-TIME MULTI-USER SYNCHRONIZATION & GODMODE TESTS ---');

const BASE_URL = 'http://localhost:4000';

// 1. Check /api/sync/state initial state
const stateRes = await fetch(`${BASE_URL}/api/sync/state`);
assert.strictEqual(stateRes.status, 200, 'GET /api/sync/state must return 200');
const stateData = await stateRes.json();
assert(typeof stateData.revision === 'number', 'revision must be a number');
assert(stateData.revision >= 1, 'revision must be at least 1');
assert(typeof stateData.timestamp === 'string', 'timestamp must be a string');
console.log(`✓ TEST 1 PASSED: Sync state endpoint active (Current Revision: ${stateData.revision})`);

// 2. Normal user login (Workspace admin)
const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'hyagreenan@company.com', password: 'Admin@123', portalMode: 'workspace' }),
});
assert.strictEqual(userLoginRes.status, 200, 'User login must succeed');
const userLoginData = await userLoginRes.json();
console.log('Logged in user info:', userLoginData.user);
const userSessionId = userLoginData.sessionId;
assert(userSessionId, 'User login must return sessionId');
console.log('✓ TEST 2 PASSED: Normal user login successful');

// 3. Developer Console root login (God Mode)
const devLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'DEV-CONSOLE-ROOT', password: 'DevConsole@123', portalMode: 'developer_console' }),
});
assert.strictEqual(devLoginRes.status, 200, 'Dev Console root login must succeed');
const devLoginData = await devLoginRes.json();
const devSessionId = devLoginData.sessionId;
assert(devSessionId, 'Dev login must return sessionId');
assert.strictEqual(devLoginData.user.isDevConsole, true);
assert.strictEqual(devLoginData.user.portalMode, 'developer_console');
console.log('✓ TEST 3 PASSED: God Mode Developer Console root authentication isolated & active');

// 4. Test SSE Stream Receiving Live Mutation Events
const initialRev = stateData.revision;
let receivedEvents = [];

const req = http.request(`${BASE_URL}/api/sync/events`, {
  headers: {
    'Accept': 'text/event-stream',
  }
}, (res) => {
  res.on('data', (chunk) => {
    const text = chunk.toString();
    receivedEvents.push(text);
  });
});
req.end();

// Wait 250ms for SSE connection to establish
await new Promise(r => setTimeout(r, 250));

// 5. Trigger a mutation from Developer Console (Toggle UI authority)
const toggleRes = await fetch(`${BASE_URL}/api/ui-controls/page_timeline`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-dev-token': devSessionId,
  },
  body: JSON.stringify({ is_enabled: false }),
});
assert.strictEqual(toggleRes.status, 200, 'UI Control toggle should succeed');

// Check that revision increased
await new Promise(r => setTimeout(r, 100));
const stateAfterToggle = await (await fetch(`${BASE_URL}/api/sync/state`)).json();
assert(stateAfterToggle.revision > initialRev, `Revision should increase after UI toggle (was ${initialRev}, now ${stateAfterToggle.revision})`);
console.log(`✓ TEST 4 PASSED: Developer Console UI Authority toggle incremented sync revision to ${stateAfterToggle.revision}`);

// Restore UI control
await fetch(`${BASE_URL}/api/ui-controls/page_timeline`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-dev-token': devSessionId,
  },
  body: JSON.stringify({ is_enabled: true }),
});

// 6. Trigger a Ticket mutation from normal user
const revBeforeTicket = (await (await fetch(`${BASE_URL}/api/sync/state`)).json()).revision;
const projectsRes = await fetch(`${BASE_URL}/api/projects`, {
  headers: { 'x-session-token': userSessionId }
});
const projectsList = (await projectsRes.json()).projects;
const targetProject = projectsList[0];
console.log(`Using target project: ${targetProject.name} (id: ${targetProject.id})`);

const createTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': userSessionId,
  },
  body: JSON.stringify({
    title: 'Real-time Sync Multi-User Verification Task',
    projectId: targetProject.id,
    type: 'Task',
    priority: 'High',
  }),
});
if (createTicketRes.status !== 201) {
  console.log('Ticket creation response:', createTicketRes.status, await createTicketRes.json());
}
assert.strictEqual(createTicketRes.status, 201, 'Ticket creation should return 201');
const createdTicket = (await createTicketRes.json()).ticket;

await new Promise(r => setTimeout(r, 100));
const revAfterTicket = (await (await fetch(`${BASE_URL}/api/sync/state`)).json()).revision;
assert(revAfterTicket > revBeforeTicket, `Revision should increase after ticket creation (was ${revBeforeTicket}, now ${revAfterTicket})`);
console.log(`✓ TEST 5 PASSED: Ticket creation by user triggered real-time sync notification (Revision: ${revAfterTicket})`);

// 7. Verify SSE stream received the events
req.destroy();
const joinedSSE = receivedEvents.join('\n');
assert(joinedSSE.includes('connected'), 'SSE stream must receive connected event');
assert(joinedSSE.includes('ui_controls') || joinedSSE.includes('tickets') || joinedSSE.includes('change'), 'SSE stream must receive real-time entity change events');
console.log('✓ TEST 6 PASSED: Real-time SSE stream received live broadcast events instantly');

// 8. Clean up created ticket
await fetch(`${BASE_URL}/api/tickets/${createdTicket.id}/status`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': userSessionId,
  },
  body: JSON.stringify({ status: 'Done', resolutionReason: 'Verification completed' }),
});

console.log('========================================================');
console.log('🎉 ALL REAL-TIME SYNCHRONIZATION & GOD MODE TESTS PASSED (6/6)!');
console.log('========================================================\n');

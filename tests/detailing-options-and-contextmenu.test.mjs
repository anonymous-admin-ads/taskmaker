import assert from 'node:assert';
import http from 'node:http';

const BASE_URL = 'http://localhost:4000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

console.log('--- RUNNING WEBSITE DETAILING OPTIONS & RIGHT-CLICK AUTHORITY TESTS ---');

// 1. Authenticate Developer Console Administrator
const devLoginRes = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'devconsole@system.local', password: 'DevConsole@123', portalMode: 'developer_console' })
});
assert.strictEqual(devLoginRes.status, 200, 'Developer Console login failed');
const devCookie = devLoginRes.headers['set-cookie']?.[0]?.split(';')[0];
assert(devCookie, 'Dev session cookie missing');
console.log('✓ TEST 1 PASSED: Developer Console isolated session active');

// 2. Verify all seeded detailing options exist in database
const adminControlsRes = await request('/api/ui-controls/admin', {
  method: 'GET',
  headers: { Cookie: devCookie }
});
assert.strictEqual(adminControlsRes.status, 200);
const controls = adminControlsRes.body.controls;
assert(controls.length >= 30, `Expected at least 30 detailing options, found ${controls.length}`);

const requiredDetailingIds = [
  'btn_backlog_create_issue',
  'backlog_search',
  'backlog_type_filter',
  'backlog_active_sprint_section',
  'btn_complete_sprint',
  'btn_notifications',
  'btn_user_profile',
  'widget_stats_cards',
  'widget_recent_activity',
  'btn_put_on_hold',
  'btn_mark_blocked'
];

for (const id of requiredDetailingIds) {
  const found = controls.some(c => c.element_id === id);
  assert(found, `Detailing option '${id}' must exist in ui_element_controls database`);
}
console.log(`✓ TEST 2 PASSED: All ${requiredDetailingIds.length} detailing options verified in SQLite catalog`);

// 3. Test Turning ON Only for Developer Console (Hiding from Normal Website)
const toggleDevOnlyRes = await request('/api/ui-controls/btn_backlog_create_issue', {
  method: 'PUT',
  headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_enabled: false })
});
assert.strictEqual(toggleDevOnlyRes.status, 200);
assert.strictEqual(toggleDevOnlyRes.body.is_enabled, false);

// Check public /api/ui-controls endpoint (used by normal website)
const publicControlsRes1 = await request('/api/ui-controls', { method: 'GET' });
assert.strictEqual(publicControlsRes1.status, 200);
assert.strictEqual(publicControlsRes1.body.map['btn_backlog_create_issue'], false, 'Normal website must receive false for dev-only element');
console.log('✓ TEST 3 PASSED: Element set to Developer Console ONLY (Hidden from normal website)');

// 4. Test Turning ON for Normal Website (Visible to All Users)
const toggleEveryoneRes = await request('/api/ui-controls/btn_backlog_create_issue', {
  method: 'PUT',
  headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_enabled: true })
});
assert.strictEqual(toggleEveryoneRes.status, 200);
assert.strictEqual(toggleEveryoneRes.body.is_enabled, true);

const publicControlsRes2 = await request('/api/ui-controls', { method: 'GET' });
assert.strictEqual(publicControlsRes2.body.map['btn_backlog_create_issue'], true, 'Normal website must receive true for enabled element');
console.log('✓ TEST 4 PASSED: Element turned ON for Normal Website & All Users');

// 5. Test Dynamic On-The-Fly Registration via Right-Click
const customElementId = `btn_custom_option_${Date.now()}`;
const dynamicRegisterRes = await request(`/api/ui-controls/${customElementId}`, {
  method: 'PUT',
  headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    is_enabled: false,
    name: 'Custom User Widget',
    element_type: 'button',
    target_location: 'Right-Click Inspector',
    description: 'Dynamically registered via live in-app right click'
  })
});
assert.strictEqual(dynamicRegisterRes.status, 200);
assert.strictEqual(dynamicRegisterRes.body.is_enabled, false);

// Verify it now exists in database
const verifyDynamicRes = await request('/api/ui-controls/admin', {
  method: 'GET',
  headers: { Cookie: devCookie }
});
const dynamicFound = verifyDynamicRes.body.controls.find(c => c.element_id === customElementId);
assert(dynamicFound, 'Dynamically right-clicked element must persist in database');
assert.strictEqual(dynamicFound.name, 'Custom User Widget');
console.log(`✓ TEST 5 PASSED: On-the-fly dynamic element '${customElementId}' registered and persisted`);

// 6. Test Batch Bulk-Set Endpoint
const bulkSetRes = await request('/api/ui-controls/bulk-set', {
  method: 'POST',
  headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_enabled: true })
});
assert.strictEqual(bulkSetRes.status, 200);
console.log('✓ TEST 6 PASSED: Batch bulk-set applied across all detailing options');

console.log('========================================================');
console.log('🎉 ALL WEBSITE DETAILING & RIGHT-CLICK TESTS PASSED (6/6)!');
console.log('========================================================\n');

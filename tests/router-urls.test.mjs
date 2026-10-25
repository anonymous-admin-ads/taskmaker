import assert from 'node:assert';
import { VIEW_TO_PATH, PATH_TO_VIEW, getPathForView, getViewFromPath } from '../src/utils/router.js';

console.log('--- RUNNING PAGE URL & ROUTING SYNCHRONIZATION TESTS ---');

// Test 1: All view names have explicit URL path mappings
const expectedViews = [
  ['dashboard', '/dashboard'],
  ['board', '/board'],
  ['backlog', '/backlog'],
  ['list_view', '/list'],
  ['timeline', '/timeline'],
  ['calendar', '/calendar'],
  ['reports', '/reports'],
  ['sprints', '/sprints'],
  ['projects', '/projects'],
  ['project_detail', '/project-detail'],
  ['teams', '/teams'],
  ['my_work', '/my-work'],
  ['settings', '/settings'],
  ['developer_console', '/godmode'],
  ['godmode', '/godmode'],
  ['login', '/login'],
  ['signup', '/signup'],
];

for (const [view, expectedPath] of expectedViews) {
  const actualPath = getPathForView(view);
  assert.strictEqual(actualPath, expectedPath, `View ${view} should map to ${expectedPath}, got ${actualPath}`);
}
console.log('✓ TEST 1 PASSED: All view names correctly map to designated URL paths (including /godmode)');

// Test 2: URL paths correctly reverse-map to view names
for (const [view, path] of expectedViews) {
  const parsed = getViewFromPath(path);
  assert.strictEqual(parsed.view, view === 'godmode' ? 'developer_console' : view, `Path ${path} should parse to view ${view}, got ${parsed.view}`);
}
console.log('✓ TEST 2 PASSED: URL paths correctly parse into view states');

// Test 3: Path variants and aliases parse correctly
assert.strictEqual(getViewFromPath('/list_view').view, 'list_view');
assert.strictEqual(getViewFromPath('/list-view').view, 'list_view');
assert.strictEqual(getViewFromPath('/my_work').view, 'my_work');
assert.strictEqual(getViewFromPath('/project_detail').view, 'project_detail');
assert.strictEqual(getViewFromPath('/dev-console').view, 'developer_console');
assert.strictEqual(getViewFromPath('/developer_console').view, 'developer_console');
assert.strictEqual(getViewFromPath('/godmode').view, 'developer_console');
assert.strictEqual(getViewFromPath('/god-mode').view, 'developer_console');
assert.strictEqual(getViewFromPath('/').view, 'dashboard');
assert.strictEqual(getViewFromPath('').view, 'dashboard');
assert.strictEqual(getViewFromPath('/board/').view, 'board'); // trailing slash tolerance
console.log('✓ TEST 3 PASSED: Path variants, aliases, and trailing slashes handled gracefully');

// Test 4: Auth and God Mode route classification
const loginRoute = getViewFromPath('/login');
assert.strictEqual(loginRoute.isAuth, 'login');
assert.strictEqual(loginRoute.isGodMode, undefined);

const signupRoute = getViewFromPath('/signup');
assert.strictEqual(signupRoute.isAuth, 'signup');
assert.strictEqual(signupRoute.isGodMode, undefined);

const godmodeRoute = getViewFromPath('/godmode');
assert.strictEqual(godmodeRoute.isDevConsole, true);
assert.strictEqual(godmodeRoute.isGodMode, true);

const devRoute = getViewFromPath('/developer-console');
assert.strictEqual(devRoute.isDevConsole, true);
assert.strictEqual(devRoute.isGodMode, true);
console.log('✓ TEST 4 PASSED: Auth and God Mode / Developer Console flags correctly identified');

// Test 5: HTTP Server SPA route resolution for all pages on localhost:4000
const testPaths = [
  '/',
  '/dashboard',
  '/board',
  '/backlog',
  '/list',
  '/timeline',
  '/calendar',
  '/reports',
  '/sprints',
  '/projects',
  '/project-detail',
  '/teams',
  '/my-work',
  '/settings',
  '/developer-console',
  '/godmode',
  '/god-mode',
  '/login',
  '/signup',
];

for (const path of testPaths) {
  const res = await fetch(`http://localhost:4000${path}`);
  assert.strictEqual(res.status, 200, `Path ${path} on server should return status 200, got ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('text/html'), `Path ${path} should return HTML content, got ${contentType}`);
}
console.log('✓ TEST 5 PASSED: Server successfully returns index.html (HTTP 200) for all 19 SPA routes including /godmode');

console.log('========================================================');
console.log('🎉 ALL PAGE URL ROUTING TESTS PASSED (5/5)!');
console.log('========================================================\n');


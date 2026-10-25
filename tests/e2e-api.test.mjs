import assert from 'node:assert';
import app from '../server/server.js';
import http from 'node:http';

const server = http.createServer(app);

server.listen(4001, '127.0.0.1', async () => {
  console.log('--- RUNNING END-TO-END HTTP API SMOKE TESTS (PORT 4001) ---');

  try {
    // 1. Health check
    const healthRes = await fetch('http://127.0.0.1:4001/api/health');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    console.log('✓ API Health check passed');

    // 2. Login as Super Admin
    const loginRes = await fetch('http://127.0.0.1:4001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'hyagreenan@company.com',
        password: 'Admin@123',
        rememberMe: true
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert(loginData.sessionId, 'Login must issue session token');
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert(cookieHeader && cookieHeader.includes('taskflow_session'), 'HTTP-only session cookie must be set');
    console.log('✓ Login verified with persistent session cookie');

    const authHeaders = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    };

    // 3. Query Projects
    const projRes = await fetch('http://127.0.0.1:4001/api/projects', { headers: authHeaders });
    const projData = await projRes.json();
    assert(projData.projects.length >= 5, 'Projects must include Texawave-ERP, FAS, etc.');
    console.log(`✓ Projects queried: ${projData.projects.length} active enterprise projects`);

    // 4. Query Tickets (checking Hold Box & Blocked Box records)
    const ticketRes = await fetch('http://127.0.0.1:4001/api/tickets', { headers: authHeaders });
    const ticketData = await ticketRes.json();
    const holdTicket = ticketData.tickets.find(t => t.status === 'Hold Box');
    const blockedTicket = ticketData.tickets.find(t => t.status === 'Blocked Box');
    assert(holdTicket, 'Hold Box ticket must be present in query');
    assert(blockedTicket, 'Blocked Box ticket must be present in query');
    assert(holdTicket.hold_reason, 'Hold reason must be attached to ticket');
    console.log(`✓ Tickets queried: ${ticketData.tickets.length} total, Hold Box: ${holdTicket.key}, Blocked Box: ${blockedTicket.key}`);

    // 5. Query Developer Console Backup Health
    const backupRes = await fetch('http://127.0.0.1:4001/api/backup/health', { headers: authHeaders });
    assert.strictEqual(backupRes.status, 200);
    const backupHealth = await backupRes.json();
    assert.strictEqual(backupHealth.database.journalMode, 'WAL');
    assert(backupHealth.backups.total > 0);
    console.log(`✓ Developer Console backup health verified (Database size: ${Math.round(backupHealth.database.sizeBytes / 1024)} KB)`);

    // 6. Test unauthorized access to Developer Console
    const anonRes = await fetch('http://127.0.0.1:4001/api/admin/dashboard');
    assert.strictEqual(anonRes.status, 401, 'Anonymous request to admin console must return 401');
    console.log('✓ Unauthorized route access blocked by server-side authorization middleware');

    console.log('\nALL END-TO-END HTTP API SMOKE TESTS PASSED!');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('❌ E2E API Test Failed:', err);
    server.close(() => process.exit(1));
  }
});


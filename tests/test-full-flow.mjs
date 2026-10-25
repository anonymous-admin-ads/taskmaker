import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = 'e:\\ventura task\\.tmp-edge-test-profile';

console.log('Spawning Edge for full navigation test...');
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=' + userDataDir,
  '--disable-gpu',
  '--no-sandbox',
  'about:blank',
]);

let wsDebuggerUrl = null;
chrome.stderr.on('data', d => {
  const str = d.toString();
  const m = str.match(/DevTools listening on (ws:\/\/[^\s]+)/);
  if (m) {
    wsDebuggerUrl = m[1];
  }
});

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    if (wsDebuggerUrl) return wsDebuggerUrl;
    await wait(200);
  }
  throw new Error('Edge remote debugging did not respond');
}

async function run() {
  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    const callbacks = new Map();
    function send(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve) => {
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const resolve = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        resolve(msg);
      }
    };

    const newTarget = await send('Target.createTarget', { url: 'http://localhost:4000/login' });
    const targetId = newTarget.result.targetId;
    const attached = await send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.result.sessionId;

    function sendSession(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve) => {
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
      });
    }

    const consoleLogs = [];
    const errors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: msg.params.type, text: msg.params.args.map(a => a.value || a.description).join(' ') });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails);
      }
      if (msg.id && callbacks.has(msg.id)) {
        const resolve = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        resolve(msg);
      }
    };

    await sendSession('Runtime.enable');
    await sendSession('Page.enable');
    await sendSession('Network.enable');

    console.log('1. Waiting on /login ...');
    await wait(1500);

    // Click Kamalesh login button
    console.log('2. Clicking Kamalesh demo login button...');
    const clickKamalesh = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const kBtn = btns.find(b => b.textContent && b.textContent.includes('Kamalesh'));
        if (kBtn) { kBtn.click(); return 'clicked'; }
        return 'not found';
      })()`
    });
    console.log('Kamalesh button click result:', clickKamalesh.result?.result?.value);

    await wait(2500);

    const currentPath = await sendSession('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('Current URL pathname after login:', currentPath.result?.result?.value);

    const docTitle = await sendSession('Runtime.evaluate', { expression: 'document.title' });
    console.log('Document title after login:', docTitle.result?.result?.value);

    // Capture screenshot of workspace
    const wsShot = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (wsShot.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\workspace-shot.png', Buffer.from(wsShot.result.data, 'base64'));
      console.log('Saved workspace-shot.png');
    }

    // Now test navigating to /board
    console.log('3. Navigating to /board ...');
    await sendSession('Page.navigate', { url: 'http://localhost:4000/board' });
    await wait(2000);
    const boardPath = await sendSession('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('Board URL:', boardPath.result?.result?.value);

    const boardShot = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (boardShot.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\board-shot.png', Buffer.from(boardShot.result.data, 'base64'));
      console.log('Saved board-shot.png');
    }

    // Now test navigating to /projects
    console.log('4. Navigating to /projects ...');
    await sendSession('Page.navigate', { url: 'http://localhost:4000/projects' });
    await wait(2000);
    const projectsPath = await sendSession('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('Projects URL:', projectsPath.result?.result?.value);

    const projShot = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (projShot.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\projects-shot.png', Buffer.from(projShot.result.data, 'base64'));
      console.log('Saved projects-shot.png');
    }

    // Now test /godmode
    console.log('5. Navigating to /godmode ...');
    await sendSession('Page.navigate', { url: 'http://localhost:4000/godmode' });
    await wait(2000);
    const godmodePath = await sendSession('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('Godmode URL:', godmodePath.result?.result?.value);

    const godShot = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (godShot.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\godmode-shot.png', Buffer.from(godShot.result.data, 'base64'));
      console.log('Saved godmode-shot.png');
    }

    console.log('\n=== SUMMARY OF RUNTIME EXCEPTIONS ===');
    console.log(JSON.stringify(errors, null, 2));

    console.log('\n=== CONSOLE LOGS ===');
    console.log(JSON.stringify(consoleLogs, null, 2));

    ws.close();
  } catch (e) {
    console.error('Run failed:', e);
  } finally {
    chrome.kill();
  }
}

run();


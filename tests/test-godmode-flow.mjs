import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = 'e:\\ventura task\\.tmp-edge-godmode-profile';

const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9224',
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

    const newTarget = await send('Target.createTarget', { url: 'http://localhost:4000/godmode' });
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

    console.log('1. Waiting on /godmode ...');
    await wait(2000);

    const shot1 = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (shot1.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\godmode-login-shot.png', Buffer.from(shot1.result.data, 'base64'));
      console.log('Saved godmode-login-shot.png');
    }

    // Click DEV-CONSOLE-ROOT 1-click button
    console.log('2. Clicking DEV-CONSOLE-ROOT demo login button...');
    const clickRoot = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const rBtn = btns.find(b => b.textContent && b.textContent.includes('DEV-CONSOLE-ROOT'));
        if (rBtn) { rBtn.click(); return 'clicked'; }
        return 'not found';
      })()`
    });
    console.log('DEV-CONSOLE-ROOT click result:', clickRoot.result?.result?.value);

    await wait(2500);

    const devPath = await sendSession('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('Current URL pathname after dev console login:', devPath.result?.result?.value);

    const devShot = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (devShot.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\devconsole-dashboard-shot.png', Buffer.from(devShot.result.data, 'base64'));
      console.log('Saved devconsole-dashboard-shot.png');
    }

    console.log('\n=== RUNTIME EXCEPTIONS IN DEV CONSOLE ===');
    console.log(JSON.stringify(errors, null, 2));

    ws.close();
  } catch (e) {
    console.error('Run failed:', e);
  } finally {
    chrome.kill();
  }
}

run();


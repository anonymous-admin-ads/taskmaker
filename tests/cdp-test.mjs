import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = 'e:\\ventura task\\.tmp-edge-profile';

console.log('Spawning Edge...');
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=' + userDataDir,
  '--disable-gpu',
  '--no-sandbox',
  'about:blank',
]);
let wsDebuggerUrl = null;
chrome.stderr.on('data', d => {
  const str = d.toString();
  console.log('Edge stderr:', str);
  const m = str.match(/DevTools listening on (ws:\/\/[^\s]+)/);
  if (m) {
    wsDebuggerUrl = m[1];
  }
});
chrome.on('exit', code => console.log('Edge exited with code:', code));

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    if (wsDebuggerUrl) return wsDebuggerUrl;
    await wait(200);
  }
  throw new Error('Chrome remote debugging did not respond');
}

async function main() {
  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to Edge Browser WebSocket:', wsUrl);
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

    // Create target page
    const newTarget = await send('Target.createTarget', { url: 'http://localhost:4000/login' });
    const targetId = newTarget.result.targetId;
    console.log('Created target page:', targetId);

    // Attach to target
    const attached = await send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.result.sessionId;
    console.log('Attached with sessionId:', sessionId);

    function sendSession(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve) => {
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
      });
    }

    const consoleLogs = [];
    const errors = [];
    const networkFailures = [];

    const origOnMessage = ws.onmessage;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: msg.params.type, args: msg.params.args.map(a => a.value || a.description) });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails);
      }
      if (msg.method === 'Network.loadingFailed') {
        networkFailures.push(msg.params);
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

    console.log('Waiting 3 seconds for page execution...');
    await wait(3000);

    console.log('\n--- Console Logs ---');
    console.log(JSON.stringify(consoleLogs, null, 2));

    console.log('\n--- Runtime Exceptions ---');
    console.log(JSON.stringify(errors, null, 2));

    console.log('\n--- Network Failures ---');
    console.log(JSON.stringify(networkFailures, null, 2));

    const evalRes = await sendSession('Runtime.evaluate', { expression: 'document.getElementById("root")?.innerHTML' });
    console.log('\n--- Root InnerHTML (first 500 chars) ---');
    console.log(evalRes.result?.result?.value ? evalRes.result.result.value.substring(0, 500) : 'EMPTY ROOT!');

    const shotRes = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (shotRes.result?.data) {
      const fs = await import('fs');
      fs.writeFileSync('e:\\ventura task\\actual-browser-shot.png', Buffer.from(shotRes.result.data, 'base64'));
      console.log('Saved actual-browser-shot.png');
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

main();

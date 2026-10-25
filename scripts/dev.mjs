import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

console.log('\x1b[1m\x1b[36m========================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   TASKFLOW ENTERPRISE - UNIFIED DEV ENVIRONMENT       \x1b[0m');
console.log('\x1b[1m\x1b[36m   Backend (Express API :4000) + Frontend (Vite :3000) \x1b[0m');
console.log('\x1b[1m\x1b[36m========================================================\x1b[0m\n');

// 1. Start Backend Server
const backend = spawn(process.execPath, [path.join(rootDir, 'server/server.js')], {
  cwd: rootDir,
  env: { ...process.env, PORT: process.env.PORT || '4000', TASKFLOW_DEV_RUNNER: '1' },
  stdio: 'inherit',
});

// 2. Start Vite Dev Server
const viteBin = path.join(rootDir, 'node_modules/vite/bin/vite.js');
const frontend = spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', '3000'], {
  cwd: rootDir,
  env: { ...process.env, TASKFLOW_DEV_RUNNER: '1' },
  stdio: 'inherit',
});

// Clean shutdown handler for all spawned processes
let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m[Dev] Shutting down TaskFlow dev environment...\x1b[0m');

  const killProc = (proc) => {
    if (!proc || proc.killed) return;
    try {
      if (isWin && proc.pid) {
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t']);
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // ignore cleanup errors
    }
  };

  killProc(backend);
  killProc(frontend);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

backend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[31m[Backend] Exited unexpectedly with code ${code}\x1b[0m`);
  }
});

frontend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[31m[Frontend] Exited with code ${code}\x1b[0m`);
    shutdown();
  }
});


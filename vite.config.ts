import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

function autoBackendPlugin(): Plugin {
  let backendProc: ChildProcess | null = null;

  return {
    name: 'auto-backend-server',
    configureServer(server) {
      // If already started via scripts/dev.mjs, don't start again
      if (process.env.TASKFLOW_DEV_RUNNER === '1') {
        return;
      }

      // Check if backend port 4000 is already active
      const req = http.get('http://127.0.0.1:4000/api/health', () => {
        console.log('\x1b[32m%s\x1b[0m', '⚡ TaskFlow backend server already active on http://localhost:4000');
      });

      req.on('error', () => {
        console.log('\x1b[36m%s\x1b[0m', '⚡ Auto-launching TaskFlow backend server on http://localhost:4000...');
        backendProc = spawn(process.execPath, [path.resolve(import.meta.dirname, './server/server.js')], {
          stdio: 'inherit',
          cwd: path.resolve(import.meta.dirname),
          env: { ...process.env, PORT: '4000' },
        });

        const stopBackend = () => {
          if (backendProc && !backendProc.killed) {
            try {
              if (process.platform === 'win32' && backendProc.pid) {
                spawn('taskkill', ['/pid', backendProc.pid.toString(), '/f', '/t']);
              } else {
                backendProc.kill('SIGTERM');
              }
            } catch {
              // ignore
            }
            backendProc = null;
          }
        };

        process.on('exit', stopBackend);
        process.on('SIGINT', () => {
          stopBackend();
          process.exit();
        });
        process.on('SIGTERM', () => {
          stopBackend();
          process.exit();
        });
        server.httpServer?.on('close', stopBackend);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    autoBackendPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

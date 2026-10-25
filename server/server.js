import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getDatabase } from './db/database.js';
import { runMigrations } from './db/migrations.js';
import { seedDatabase } from './db/seed.js';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import uiControlRoutes from './routes/uiControlRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

import { createDatabaseBackup, verifyRestoreBackup } from './services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Enable gzip/deflate compression for blazing fast transfers
app.use(compression());

// Security & Parsing Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security Response Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Run Migrations and Seed Database on launch
runMigrations();
seedDatabase();

// Initial Automated Backup verification on startup if none exists
try {
  const db = getDatabase();
  const backupCount = db.prepare('SELECT count(*) as count FROM backup_records').get().count;
  if (backupCount === 0) {
    console.log('[Scheduler] Generating initial baseline production backup...');
    const bkp = createDatabaseBackup({
      type: 'FULL',
      initiatedByName: 'Automated System Scheduler'
    });
    console.log('[Scheduler] Running sandbox restore verification on baseline backup...');
    verifyRestoreBackup(bkp.backupId);
    console.log('[Scheduler] Initial baseline backup and restore verification complete!');
  }
} catch (err) {
  console.warn('[Scheduler] Startup backup check notice:', err.message);
}

// Scheduled Daily Backup Interval (every 24 hours in prod, or every 6 hours)
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  try {
    console.log('[Scheduler] Executing scheduled daily backup...');
    const result = createDatabaseBackup({
      type: 'FULL',
      initiatedByName: 'Scheduled Daily Job'
    });
    verifyRestoreBackup(result.backupId);
  } catch (err) {
    console.error('[Scheduler] Scheduled backup job failed:', err.message);
  }
}, BACKUP_INTERVAL_MS);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ui-controls', uiControlRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build with optimal cache policies
const DIST_DIR = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    }
  }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`TaskFlow Enterprise Server running on http://localhost:${PORT}`);
  console.log(`SQLite Persistent Database with WAL Mode & ACID Compliance`);
  console.log(`Hold Box & Blocked Box Workflow Engine Active`);
  console.log(`Automated AES-256 Encrypted Backups Active`);
  console.log(`======================================================\n`);
});

export default app;

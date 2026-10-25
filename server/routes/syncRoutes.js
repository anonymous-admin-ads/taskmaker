import express from 'express';
import { addClient, getSyncState } from '../services/eventService.js';

const router = express.Router();

// GET /api/sync/state - Lightweight revision check for polling fallback
router.get('/state', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(getSyncState());
});

// GET /api/sync/events - Real-time Server-Sent Events (SSE) stream
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Send initial connection confirmation
  const current = getSyncState();
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', ...current })}\n\n`);

  addClient(res);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 20000);

  res.on('close', () => {
    clearInterval(heartbeat);
  });
});

export default router;


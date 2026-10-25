import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'taskflow.db');

export let db = null;

export function getDatabase() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // Configure production-grade high-performance SQLite pragmas
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -64000;'); // 64MB memory cache for instant queries
    db.exec('PRAGMA temp_store = MEMORY;');
    db.exec('PRAGMA mmap_size = 268435456;'); // Memory-mapped I/O (256MB)
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDatabase;

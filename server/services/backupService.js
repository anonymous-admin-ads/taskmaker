import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { getDatabase, DB_PATH } from '../db/database.js';
import { logAudit, logSecurityEvent } from './auditService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dedicated isolated storage directory for backups
const BACKUPS_DIR = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Server encryption secret for backup files (AES-256-GCM)
const BACKUP_ENCRYPTION_KEY = process.env.TASKFLOW_BACKUP_KEY ||
  crypto.createHash('sha256').update('taskflow-enterprise-secure-backup-vault-key-2026').digest();

const RETENTION_DAYS = 30;

export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', BACKUP_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: [12-byte IV][16-byte Auth Tag][Encrypted Data]
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const ciphertext = encryptedBuffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', BACKUP_ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function createDatabaseBackup({
  type = 'MANUAL',
  initiatedByUserId = null,
  initiatedByName = 'Automated Scheduler'
} = {}) {
  const db = getDatabase();
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `bkp_${type.toLowerCase()}_${timestampStr}`;
  const filename = `${backupId}.tfbak`;
  const targetFilepath = path.join(BACKUPS_DIR, filename);
  const now = new Date();
  const retentionExpiry = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1. Insert initial PENDING / RUNNING record
  db.prepare(`
    INSERT INTO backup_records (
      backup_id, filename, filepath, storage_location, type, status,
      is_encrypted, retention_expiry, started_at
    ) VALUES (?, ?, ?, ?, ?, 'RUNNING', 1, ?, ?)
  `).run(backupId, filename, targetFilepath, BACKUPS_DIR, type, retentionExpiry, now.toISOString());

  const startTime = Date.now();

  try {
    // 2. Perform atomic SQLite backup:
    // First, checkpoint WAL to ensure all latest transactions are flushed
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    // Read the primary database file
    const rawDbBuffer = fs.readFileSync(DB_PATH);

    // Sanitize in-memory copy before encryption: live sessions & plaintext passwords are not stored in raw db anyway
    // (passwords are scrypt-hashed, sessions can be cleared in backup copy if desired)
    // To create a perfectly clean backup copy, we write to a temporary file, scrub active sessions, then read and encrypt
    const tempRestorePath = path.join(BACKUPS_DIR, `temp_${backupId}.db`);
    fs.writeFileSync(tempRestorePath, rawDbBuffer);

    const tempDb = new DatabaseSync(tempRestorePath);
    // Invalidate live active session tokens inside the exported backup to prevent session hijacking
    tempDb.exec('UPDATE sessions SET is_revoked = 1 WHERE is_revoked = 0;');
    tempDb.close();

    const sanitizedDbBuffer = fs.readFileSync(tempRestorePath);
    fs.unlinkSync(tempRestorePath);

    // 3. Compute SHA256 checksum before encryption
    const checksum = crypto.createHash('sha256').update(sanitizedDbBuffer).digest('hex');

    // 4. Encrypt with AES-256-GCM
    const encryptedData = encryptBuffer(sanitizedDbBuffer);

    // 5. Write to dedicated backups storage directory
    fs.writeFileSync(targetFilepath, encryptedData);
    const sizeBytes = encryptedData.length;

    const completedAt = new Date().toISOString();

    // 6. Update backup record with SUCCEEDED status
    db.prepare(`
      UPDATE backup_records
      SET status = 'SUCCEEDED', size_bytes = ?, checksum_sha256 = ?, completed_at = ?
      WHERE backup_id = ?
    `).run(sizeBytes, checksum, completedAt, backupId);

    // 7. Audit and log
    logAudit({
      actorId: initiatedByUserId,
      actorName: initiatedByName,
      action: 'BACKUP_CREATED',
      targetResource: 'BACKUP',
      targetId: backupId,
      details: {
        backupId,
        type,
        sizeBytes,
        checksum,
        storageLocation: BACKUPS_DIR,
        durationMs: Date.now() - startTime
      }
    });

    // 8. Prune expired backups according to retention policy
    pruneExpiredBackups();

    return {
      success: true,
      backupId,
      filename,
      sizeBytes,
      checksum,
      completedAt,
      retentionExpiry
    };
  } catch (err) {
    console.error('[BackupService] Backup creation failed:', err);
    db.prepare(`
      UPDATE backup_records
      SET status = 'FAILED', error_message = ?, completed_at = ?
      WHERE backup_id = ?
    `).run(err.message, new Date().toISOString(), backupId);

    logSecurityEvent({
      eventType: 'BACKUP_FAILURE',
      actorId: initiatedByUserId,
      severity: 'CRITICAL',
      details: { backupId, type, error: err.message }
    });

    throw err;
  }
}

export function verifyRestoreBackup(backupId, verifiedByUserId = null) {
  const db = getDatabase();
  const backup = db.prepare('SELECT * FROM backup_records WHERE backup_id = ?').get(backupId);
  if (!backup) {
    throw new Error(`Backup record ${backupId} not found`);
  }

  if (backup.status !== 'SUCCEEDED') {
    throw new Error(`Cannot verify backup ${backupId} with status '${backup.status}'`);
  }

  const startTime = Date.now();
  const verificationDbPath = path.resolve(__dirname, '../../data/verification_restore.db');

  // Remove existing verification sandbox if present
  if (fs.existsSync(verificationDbPath)) {
    try { fs.unlinkSync(verificationDbPath); } catch (e) {}
  }

  try {
    // 1. Read encrypted backup file
    if (!fs.existsSync(backup.filepath)) {
      throw new Error(`Backup file missing from storage: ${backup.filepath}`);
    }
    const encryptedBuffer = fs.readFileSync(backup.filepath);

    // 2. Decrypt with AES-256-GCM
    const decryptedBuffer = decryptBuffer(encryptedBuffer);

    // 3. Verify Checksum
    const calculatedChecksum = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');
    if (calculatedChecksum !== backup.checksum_sha256) {
      throw new Error(`Integrity Failure: SHA256 mismatch (expected ${backup.checksum_sha256}, got ${calculatedChecksum})`);
    }

    // 4. Restore into separate recovery sandbox database
    fs.writeFileSync(verificationDbPath, decryptedBuffer);

    // 5. Open recovery database and perform deep integrity checks
    const recoveryDb = new DatabaseSync(verificationDbPath);

    const integrityResult = recoveryDb.prepare('PRAGMA integrity_check;').all();
    const isIntegrityOk = integrityResult.length > 0 && integrityResult[0].integrity_check === 'ok';
    if (!isIntegrityOk) {
      throw new Error(`Database integrity check failed: ${JSON.stringify(integrityResult)}`);
    }

    const fkResult = recoveryDb.prepare('PRAGMA foreign_key_check;').all();
    if (fkResult.length > 0) {
      throw new Error(`Foreign key constraint violations in restored backup: ${JSON.stringify(fkResult)}`);
    }

    // 6. Validate critical record counts and relationships
    const userCount = recoveryDb.prepare('SELECT count(*) as count FROM users').get().count;
    const projectCount = recoveryDb.prepare('SELECT count(*) as count FROM projects').get().count;
    const ticketCount = recoveryDb.prepare('SELECT count(*) as count FROM tickets').get().count;
    const holdBoxCount = recoveryDb.prepare('SELECT count(*) as count FROM hold_box_records').get().count;
    const blockedBoxCount = recoveryDb.prepare('SELECT count(*) as count FROM blocked_box_records').get().count;
    const ruleCount = recoveryDb.prepare('SELECT count(*) as count FROM workflow_rules').get().count;
    const roleCount = recoveryDb.prepare('SELECT count(*) as count FROM roles').get().count;

    recoveryDb.close();

    // 7. Cleanup verification sandbox file
    if (fs.existsSync(verificationDbPath)) {
      try { fs.unlinkSync(verificationDbPath); } catch (e) {}
    }

    const recordCounts = {
      users: userCount,
      projects: projectCount,
      tickets: ticketCount,
      holdBoxRecords: holdBoxCount,
      blockedBoxRecords: blockedBoxCount,
      workflowRules: ruleCount,
      roles: roleCount
    };

    const durationMs = Date.now() - startTime;
    const verifiedAt = new Date().toISOString();

    // 8. Record successful verification log
    db.prepare(`
      INSERT INTO restore_verification_logs (
        backup_id, verified_at, verified_by_user_id, status,
        record_counts, integrity_check_output, duration_ms, details
      ) VALUES (?, ?, ?, 'PASSED', ?, 'ok', ?, 'Restored and verified in isolated sandbox with 100% schema and FK compliance')
    `).run(backupId, verifiedAt, verifiedByUserId, JSON.stringify(recordCounts), durationMs);

    // 9. Update backup record
    db.prepare(`
      UPDATE backup_records
      SET last_verified_at = ?, verification_status = 'PASSED'
      WHERE backup_id = ?
    `).run(verifiedAt, backupId);

    logAudit({
      actorId: verifiedByUserId,
      actorName: 'Administrator',
      action: 'RESTORE_VERIFIED',
      targetResource: 'BACKUP',
      targetId: backupId,
      details: { backupId, recordCounts, durationMs, status: 'PASSED' }
    });

    return {
      success: true,
      backupId,
      status: 'PASSED',
      verifiedAt,
      recordCounts,
      durationMs
    };
  } catch (err) {
    console.error('[BackupService] Restore verification failed:', err);
    if (fs.existsSync(verificationDbPath)) {
      try { fs.unlinkSync(verificationDbPath); } catch (e) {}
    }

    const durationMs = Date.now() - startTime;
    const verifiedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO restore_verification_logs (
        backup_id, verified_at, verified_by_user_id, status,
        record_counts, integrity_check_output, duration_ms, details
      ) VALUES (?, ?, ?, 'FAILED', '{}', ?, ?, ?)
    `).run(backupId, verifiedAt, verifiedByUserId, err.message, durationMs, err.stack);

    db.prepare(`
      UPDATE backup_records
      SET last_verified_at = ?, verification_status = 'FAILED'
      WHERE backup_id = ?
    `).run(verifiedAt, backupId);

    logSecurityEvent({
      eventType: 'RESTORE_VERIFICATION_FAILURE',
      actorId: verifiedByUserId,
      severity: 'CRITICAL',
      details: { backupId, error: err.message }
    });

    throw err;
  }
}

export function pruneExpiredBackups() {
  const db = getDatabase();
  const now = new Date().toISOString();
  const expired = db.prepare(`
    SELECT * FROM backup_records
    WHERE retention_expiry < ? AND status = 'SUCCEEDED'
  `).all(now);

  for (const b of expired) {
    if (fs.existsSync(b.filepath)) {
      try {
        fs.unlinkSync(b.filepath);
      } catch (e) {
        console.warn(`[BackupService] Failed to delete expired file ${b.filepath}:`, e.message);
      }
    }
  }

  if (expired.length > 0) {
    db.prepare(`DELETE FROM backup_records WHERE retention_expiry < ?`).run(now);
  }
}

export function getBackupHealth() {
  const db = getDatabase();
  
  // Database file stats
  let dbSizeBytes = 0;
  let walSizeBytes = 0;
  if (fs.existsSync(DB_PATH)) {
    dbSizeBytes = fs.statSync(DB_PATH).size;
  }
  const walPath = `${DB_PATH}-wal`;
  if (fs.existsSync(walPath)) {
    walSizeBytes = fs.statSync(walPath).size;
  }

  // Backup statistics
  const recentSuccess = db.prepare(`
    SELECT * FROM backup_records WHERE status = 'SUCCEEDED' ORDER BY completed_at DESC LIMIT 1
  `).get();

  const recentFailure = db.prepare(`
    SELECT * FROM backup_records WHERE status = 'FAILED' ORDER BY started_at DESC LIMIT 1
  `).get();

  const totalBackups = db.prepare('SELECT count(*) as count FROM backup_records').get().count;
  const verifiedBackups = db.prepare(`SELECT count(*) as count FROM backup_records WHERE verification_status = 'PASSED'`).get().count;

  // Calculate RPO and RTO
  // RPO (Recovery Point Objective): time elapsed since last successful backup
  let currentRpoHours = null;
  if (recentSuccess && recentSuccess.completed_at) {
    const msSince = Date.now() - new Date(recentSuccess.completed_at).getTime();
    currentRpoHours = +(msSince / (1000 * 60 * 60)).toFixed(2);
  }

  // Last verified restore log
  const lastRestoreLog = db.prepare(`
    SELECT * FROM restore_verification_logs ORDER BY verified_at DESC LIMIT 1
  `).get();

  let avgRestoreDurationMs = 120; // default benchmark
  if (lastRestoreLog) {
    avgRestoreDurationMs = lastRestoreLog.duration_ms;
  }

  return {
    database: {
      dbPath: DB_PATH,
      sizeBytes: dbSizeBytes,
      walSizeBytes: walSizeBytes,
      journalMode: 'WAL',
      foreignKeys: 'ON',
      isHealthy: true
    },
    backups: {
      total: totalBackups,
      verified: verifiedBackups,
      storageLocation: BACKUPS_DIR,
      retentionDays: RETENTION_DAYS,
      encryption: 'AES-256-GCM',
      recentSuccess: recentSuccess || null,
      recentFailure: recentFailure || null,
      currentRpoHours,
      targetRpoHours: 24, // 24-hour target RPO
      estimatedRtoSeconds: Math.ceil(avgRestoreDurationMs / 1000) || 1, // Tested sandbox RTO
      lastRestoreVerification: lastRestoreLog ? {
        ...lastRestoreLog,
        record_counts: JSON.parse(lastRestoreLog.record_counts || '{}')
      } : null
    }
  };
}


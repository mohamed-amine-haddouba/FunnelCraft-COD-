#!/usr/bin/env node
/**
 * Guarded CodWorth data reset.
 *
 * Default mode is a read-only preview. A destructive reset requires BOTH:
 *   OWNER_EMAIL=<configured owner>
 *   RESET_CONFIRM=DELETE_ALL_NON_OWNER_DATA
 *   node scripts/reset-data.cjs --confirm-production-reset
 *
 * An encrypted GPG backup is mandatory before any mutation. Plans, settings,
 * payment ledger history and security/audit logs are intentionally preserved.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.CODWORTH_DATA_DIR || path.join(PROJECT_ROOT, 'data'));
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
const CONFIRM_FLAG = process.argv.includes('--confirm-production-reset');
const CONFIRM_VALUE = process.env.RESET_CONFIRM === 'DELETE_ALL_NON_OWNER_DATA';

const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  pages: path.join(DATA_DIR, 'pages.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  coupons: path.join(DATA_DIR, 'coupons.json'),
  payments: path.join(DATA_DIR, 'payments.json'),
  sandboxSessions: path.join(DATA_DIR, 'sandbox_sessions.json'),
  sandboxResetTokens: path.join(DATA_DIR, 'sandbox_reset_tokens.json'),
  sandboxDeployLock: path.join(DATA_DIR, 'sandbox_deploy_lock.json'),
  sandboxCommandLock: path.join(DATA_DIR, 'sandbox_command_lock.json'),
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error(`Refusing reset: ${path.basename(filePath)} is corrupt. Restore a verified backup first.`);
  }
  return parsed;
}

function readJsonArray(filePath) {
  const parsed = readJson(filePath, []);
  if (!Array.isArray(parsed)) {
    throw new Error(`Refusing reset: ${path.basename(filePath)} must contain a JSON array.`);
  }
  return parsed;
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2) + '\n', {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

function runFactoryReset() {
  console.log('================================================================');
  console.log('[RESET] CodWorth guarded factory-reset preview');
  console.log(`[RESET] Data directory: ${DATA_DIR}`);
  console.log('================================================================');

  if (!fs.existsSync(DATA_DIR)) throw new Error('Data directory does not exist.');
  if (!OWNER_EMAIL) throw new Error('OWNER_EMAIL must be configured; no account will be guessed.');

  // Read and validate every affected file before any write is attempted.
  const allUsers = readJsonArray(FILES.users);
  const ownerAccounts = allUsers.filter((user) =>
    user && typeof user === 'object' &&
    String(user.email || '').trim().toLowerCase() === OWNER_EMAIL &&
    String(user.role || '').trim().toLowerCase() === 'admin'
  );
  if (ownerAccounts.length !== 1) {
    throw new Error('Expected exactly one configured active owner/admin account. No files were modified.');
  }
  const owner = ownerAccounts[0];
  if (owner.status && owner.status !== 'active') {
    throw new Error('Configured owner account is not active. No files were modified.');
  }

  const orders = readJsonArray(FILES.orders);
  const pages = readJsonArray(FILES.pages);
  const sessions = readJsonArray(FILES.sessions);
  const coupons = readJsonArray(FILES.coupons);
  const payments = readJsonArray(FILES.payments);
  const sandboxSessions = readJsonArray(FILES.sandboxSessions);
  const sandboxResetTokens = readJsonArray(FILES.sandboxResetTokens);
  readJson(FILES.sandboxDeployLock, { inProgress: false });
  readJson(FILES.sandboxCommandLock, { inProgress: false });

  const summary = {
    ownerAccountsPreserved: 1,
    usersToRemove: Math.max(0, allUsers.length - 1),
    ordersToRemove: orders.length,
    pagesToRemove: pages.length,
    sessionsToRevoke: sessions.length,
    couponsToRemove: coupons.length,
    manualPaymentsToRemove: payments.length,
    sandboxSessionsToClear: sandboxSessions.length,
    sandboxResetTokensToClear: sandboxResetTokens.length,
    plansSettingsPayPalLedgerAndAuditLogs: 'PRESERVED',
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!CONFIRM_FLAG || !CONFIRM_VALUE) {
    console.log('[RESET] Dry run only. No files were modified.');
    console.log('[RESET] To proceed, set RESET_CONFIRM=DELETE_ALL_NON_OWNER_DATA and pass --confirm-production-reset.');
    return;
  }

  // The reset is forbidden unless a verified encrypted backup can be created.
  const backup = spawnSync('bash', [path.join(PROJECT_ROOT, 'scripts/backup-data.sh')], {
    cwd: PROJECT_ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (backup.error || backup.status !== 0) {
    throw new Error('Encrypted backup failed. Reset aborted before modifying any data.');
  }

  const sanitizedOwner = {
    ...owner,
    pages_created_count: 0,
    orders_count: 0,
  };

  // Keep financial plans, platform settings, PayPal ledger and forensic audit logs.
  const writes = [
    [FILES.users, [sanitizedOwner]],
    [FILES.orders, []],
    [FILES.pages, []],
    [FILES.sessions, []],
    [FILES.coupons, []],
    [FILES.payments, []],
    [FILES.sandboxSessions, []],
    [FILES.sandboxResetTokens, []],
    [FILES.sandboxDeployLock, {
      inProgress: false,
      lockedAt: 0,
      actorEmail: '',
      lastCompletedDeployAt: 0,
    }],
    [FILES.sandboxCommandLock, {
      inProgress: false,
      lockedAt: 0,
      actorEmail: '',
      commandId: '',
    }],
  ];

  try {
    for (const [filePath, value] of writes) writeJsonAtomic(filePath, value);
  } catch (error) {
    throw new Error(`Reset stopped during persistence. An encrypted pre-reset backup exists and must be used for recovery: ${error.message}`);
  }

  console.log('[RESET] Completed. Owner preserved; merchant data reset.');
  console.log('[RESET] Plans, settings, PayPal ledger and security/audit logs were preserved.');
  console.log('================================================================');
}

try {
  runFactoryReset();
} catch (error) {
  console.error('[RESET ABORTED]', error.message);
  process.exitCode = 1;
}

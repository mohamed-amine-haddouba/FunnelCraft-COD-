#!/usr/bin/env node
/**
 * FunnelCraft-COD — Production Factory Reset Script (scripts/reset-data.cjs)
 *
 * Cleans all dummy/test data (test merchants, test orders, test landing pages,
 * test coupons, manual payment requests, sessions, locks, and audit logs)
 * while strictly preserving the Owner account (naadianajah2020@gmail.com)
 * and system settings (data/settings.json).
 *
 * Usage:
 *   node scripts/reset-data.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OWNER_EMAIL = 'naadianajah2020@gmail.com';
const DATA_DIR = path.resolve(__dirname, '../data');

const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  pages: path.join(DATA_DIR, 'pages.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  coupons: path.join(DATA_DIR, 'coupons.json'),
  plans: path.join(DATA_DIR, 'plans.json'),
  auditLogs: path.join(DATA_DIR, 'sandbox_audit.json'),
  payments: path.join(DATA_DIR, 'payments.json'),
  sandboxSessions: path.join(DATA_DIR, 'sandbox_sessions.json'),
  sandboxResetTokens: path.join(DATA_DIR, 'sandbox_reset_tokens.json'),
  sandboxDeployLock: path.join(DATA_DIR, 'sandbox_deploy_lock.json'),
  sandboxCommandLock: path.join(DATA_DIR, 'sandbox_command_lock.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    nameAr: 'باقة المبتدئين (Starter)',
    priceMAD: 99,
    features: [
      '3 صفحات',
      '500 طلب/شهر',
      'بدون علامة مائية',
      'إحصائيات أساسية',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Unlimited',
    nameAr: 'باقة المحترفين (Pro)',
    priceMAD: 179,
    features: [
      'صفحات غير محدودة',
      'طلبات غير محدودة',
      'إزالة العلامة المائية',
      'دومين مخصص',
      'ربط بيكسل الإعلانات',
      'دعم فوري واتساب',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Scale',
    nameAr: 'باقة الشركات (Enterprise)',
    priceMAD: 349,
    features: [
      'كل ميزات Pro',
      'مدير حساب مخصص',
      'ربط شركات التوصيل API',
      'تقارير متقدمة',
    ],
  },
];

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function runFactoryReset() {
  console.log('================================================================');
  console.log('[RESET] Starting FunnelCraft-COD Production Factory Reset...');
  console.log(`[RESET] Target Data Directory: ${DATA_DIR}`);
  console.log('================================================================');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`[RESET ERROR] Data directory does not exist: ${DATA_DIR}`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Fail-Safe Verification of Owner Account in data/users.json
  // ---------------------------------------------------------------------------
  if (!fs.existsSync(FILES.users)) {
    console.error(
      `[RESET ABORTED] Cannot find ${FILES.users}. Refusing to run without verifying Owner account (${OWNER_EMAIL}).`
    );
    process.exit(1);
  }

  let allUsers;
  try {
    const rawUsers = fs.readFileSync(FILES.users, 'utf-8');
    allUsers = JSON.parse(rawUsers);
  } catch (err) {
    console.error(`[RESET ABORTED] Failed to parse ${FILES.users}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(allUsers)) {
    console.error(`[RESET ABORTED] ${FILES.users} does not contain a valid JSON array.`);
    process.exit(1);
  }

  const keptOwners = allUsers.filter((user) => {
    if (!user || typeof user !== 'object') return false;
    const email = String(user.email || '').trim().toLowerCase();
    const role = String(user.role || '').trim().toLowerCase();
    return role === 'admin' || email === OWNER_EMAIL;
  });

  const hasPrimaryOwner = keptOwners.some(
    (user) => String(user.email || '').trim().toLowerCase() === OWNER_EMAIL
  );

  if (keptOwners.length === 0 || !hasPrimaryOwner) {
    console.error(
      `[RESET ABORTED] Fail-safe triggered: Owner account (${OWNER_EMAIL}) was NOT found in data/users.json. No files were modified.`
    );
    process.exit(1);
  }

  // Reset vanity counters on the kept owner account(s) while preserving credentials & role
  const sanitizedOwners = keptOwners.map((owner) => ({
    ...owner,
    pages_created_count: 0,
    orders_count: 0,
  }));

  const removedUsersCount = allUsers.length - sanitizedOwners.length;
  writeJsonAtomic(FILES.users, sanitizedOwners);
  console.log(
    `[RESET] Cleared ${removedUsersCount} test users. Kept ${sanitizedOwners.length} owner account(s) (${sanitizedOwners
      .map((u) => u.email)
      .join(', ')}).`
  );

  // ---------------------------------------------------------------------------
  // STEP 2: Reset Orders (data/orders.json -> [])
  // ---------------------------------------------------------------------------
  const existingOrders = readJsonSafe(FILES.orders, []);
  const ordersCount = Array.isArray(existingOrders) ? existingOrders.length : 0;
  writeJsonAtomic(FILES.orders, []);
  console.log(`[RESET] Cleared ${ordersCount} test orders in data/orders.json (reset to []).`);

  // ---------------------------------------------------------------------------
  // STEP 3: Reset Landing Pages (data/pages.json -> [])
  // ---------------------------------------------------------------------------
  const existingPages = readJsonSafe(FILES.pages, []);
  const pagesCount = Array.isArray(existingPages) ? existingPages.length : 0;
  writeJsonAtomic(FILES.pages, []);
  console.log(`[RESET] Cleared ${pagesCount} test landing pages in data/pages.json (reset to []).`);

  // ---------------------------------------------------------------------------
  // STEP 4: Reset Sessions (data/sessions.json -> {})
  // ---------------------------------------------------------------------------
  const existingSessions = readJsonSafe(FILES.sessions, {});
  const sessionsCount =
    existingSessions && typeof existingSessions === 'object' && !Array.isArray(existingSessions)
      ? Object.keys(existingSessions).length
      : 0;
  writeJsonAtomic(FILES.sessions, {});
  console.log(
    `[RESET] Cleared ${sessionsCount} active sessions in data/sessions.json (reset to {}).`
  );

  // ---------------------------------------------------------------------------
  // STEP 5: Reset Coupons (data/coupons.json -> [])
  // ---------------------------------------------------------------------------
  const existingCoupons = readJsonSafe(FILES.coupons, []);
  const couponsCount = Array.isArray(existingCoupons) ? existingCoupons.length : 0;
  writeJsonAtomic(FILES.coupons, []);
  console.log(`[RESET] Cleared ${couponsCount} test coupons in data/coupons.json (reset to []).`);

  // ---------------------------------------------------------------------------
  // STEP 6: Reset Plans to Default (data/plans.json)
  // ---------------------------------------------------------------------------
  writeJsonAtomic(FILES.plans, DEFAULT_PLANS);
  console.log(
    `[RESET] Reset data/plans.json to ${DEFAULT_PLANS.length} default plans (Starter: 99 MAD, Pro: 179 MAD, Enterprise: 349 MAD).`
  );

  // ---------------------------------------------------------------------------
  // STEP 7: Reset Audit Logs (data/sandbox_audit.json -> [])
  // ---------------------------------------------------------------------------
  const existingAudit = readJsonSafe(FILES.auditLogs, []);
  const auditCount = Array.isArray(existingAudit) ? existingAudit.length : 0;
  writeJsonAtomic(FILES.auditLogs, []);
  console.log(
    `[RESET] Cleared ${auditCount} audit log entries in data/sandbox_audit.json (reset to []).`
  );

  // Clean any rotated audit log archives (sandbox_audit.*.json)
  try {
    const dirEntries = fs.readdirSync(DATA_DIR);
    for (const entry of dirEntries) {
      if (/^sandbox_audit\.\d+\.json$/.test(entry)) {
        fs.unlinkSync(path.join(DATA_DIR, entry));
        console.log(`[RESET] Deleted rotated audit log archive: data/${entry}`);
      }
    }
  } catch {
    // ignore
  }

  // ---------------------------------------------------------------------------
  // STEP 8: Reset Other Test / Transient Files (Payments, Locks, Sandbox Sessions)
  // ---------------------------------------------------------------------------
  const existingPayments = readJsonSafe(FILES.payments, []);
  const paymentsCount = Array.isArray(existingPayments) ? existingPayments.length : 0;
  writeJsonAtomic(FILES.payments, []);
  console.log(
    `[RESET] Cleared ${paymentsCount} test manual payment records in data/payments.json (reset to []).`
  );

  writeJsonAtomic(FILES.sandboxSessions, []);
  console.log('[RESET] Reset data/sandbox_sessions.json to [].');

  writeJsonAtomic(FILES.sandboxResetTokens, []);
  console.log('[RESET] Reset data/sandbox_reset_tokens.json to [].');

  writeJsonAtomic(FILES.sandboxDeployLock, {
    inProgress: false,
    lockedAt: 0,
    actorEmail: '',
    lastCompletedDeployAt: 0,
  });
  console.log('[RESET] Reset data/sandbox_deploy_lock.json to default unlocked state.');

  writeJsonAtomic(FILES.sandboxCommandLock, {
    inProgress: false,
    lockedAt: 0,
    actorEmail: '',
    commandId: '',
  });
  console.log('[RESET] Reset data/sandbox_command_lock.json to default unlocked state.');

  if (fs.existsSync(FILES.settings)) {
    console.log('[RESET] Preserved system settings in data/settings.json.');
  }

  console.log('================================================================');
  console.log('[RESET SUCCESS] Factory Reset completed cleanly.');
  console.log('================================================================');
}

runFactoryReset();

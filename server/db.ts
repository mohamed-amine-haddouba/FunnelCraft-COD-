import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  UserProfile,
  SubscriptionStatus,
  SubscriptionTier,
  ManualPaymentRequest,
  MoroccanPaymentMethod,
  MoroccanBankAccount,
  PlatformSettings,
  StoredPage,
  CustomDomainStatus,
  PagePixelsConfig,
} from '../src/types/user';
import {
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  inferMoroccanPaymentMethod,
} from '../src/utils/currencyAndBanks';
import {
  VPS_IP,
  CNAME_TARGET,
  getPlanCapabilities,
  checkFeatureAccess,
  validateAndNormalizeCustomDomain,
} from '../src/utils/planLimits';
import { generateStandaloneHtml } from '../src/utils/htmlExporter';
import {
  SecurityLoginAuditEntry,
  SecurityAuthMethod,
  SecurityLoginStatus,
  MAX_SECURITY_LOGIN_AUDIT_ENTRIES,
  capSecurityAuditEntries,
  redactForensicSensitiveData,
  parseUserAgentInfo,
} from '../src/utils/ipAndForensics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.resolve(DATA_DIR, 'payments.json');
const PAGES_FILE = path.resolve(DATA_DIR, 'pages.json');
const ORDERS_FILE = path.resolve(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');
const PLANS_FILE = path.resolve(DATA_DIR, 'plans.json');
const COUPONS_FILE = path.resolve(DATA_DIR, 'coupons.json');
const SECURITY_LOGIN_AUDIT_FILE = path.resolve(DATA_DIR, 'security_login_audit.json');
const EMAIL_VERIFICATIONS_FILE = path.resolve(DATA_DIR, 'email_verifications.json');

export interface EmailVerificationRecord {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  salt: string;
  created_at: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  used_at: string | null;
  ip: string;
  user_agent: string;
}

export interface SubscriptionPlanConfig {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  nameAr?: string;
  priceMAD: number;
  features: string[];
}

export interface SaaSCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number;
  currentUses: number;
  redemptionIds?: string[];
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter Plan',
    nameAr: 'المبتدئ (Starter)',
    priceMAD: 99,
    features: [
      'محرر الصفحات الاحترافي (Page Builder)',
      'استيراد المنتجات بـ 3 طبقات (3-Layer Scraper)',
      'استمارة الدفع عند الاستلام (COD Form)',
      'تحليلات أساسية (Basic Analytics)',
      'التحقق عبر البريد الإلكتروني (Email Verification)',
    ],
  },
  {
    id: 'pro',
    name: 'Professional Plan',
    nameAr: 'بريميوم (Professional)',
    priceMAD: 199,
    features: [
      'كل مميزات باقة المبتدئ (Everything in Starter)',
      'ربط الدومين المخصص (Custom Domain)',
      'بيكسل فيسبوك وتيك توك (Facebook & TikTok Pixels)',
      'تحليلات وإحصائيات متقدمة (Advanced Analytics)',
      'توليد الصفحات بالذكاء الاصطناعي (AI Page Generation - Gemini)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Business Plan',
    nameAr: 'الأعمال (Business)',
    priceMAD: 299,
    features: [
      'كل مميزات باقة بريميوم (Everything in Professional)',
      'الربط مع شركات الشحن والتوصيل (Shipping API Integrations)',
      'صفحات وطلبات وزيارات غير محدودة (Unlimited Everything)',
      'دعم فني ذو أولوية (Priority Support)',
    ],
  },
];

export interface StoredUser extends UserProfile {
  password_hash: string;
  password_salt: string;
  reset_token?: string;
  reset_token_expires?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: number;
  mustChangePassword?: boolean;
  initialPasswordBootstrapped?: boolean;
}

// In-memory sessions store: sha256(token) -> { userId, expiresAt }
const sessions = new Map<string, { userId: string; expiresAt: number }>();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password: string, salt: string): string {
  return 'scrypt-v1$' + crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }).toString('hex');
}

export function hashPasswordWithSalt(password: string, salt?: string): { hash: string; salt: string } {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  return {
    hash: hashPassword(password, effectiveSalt),
    salt: effectiveSalt,
  };
}

function getConfiguredOwnerEmail(): string {
  return (process.env.OWNER_EMAIL || '').trim().toLowerCase();
}

function createDefaultOwnerUser(): StoredUser | null {
  const superAdminEmail = getConfiguredOwnerEmail();
  if (!superAdminEmail) {
    return null;
  }
  const envInitialPassword = (process.env.OWNER_INITIAL_PASSWORD || '').trim();
  const initialPassword = envInitialPassword || crypto.randomBytes(32).toString('hex');
  const superAdminSalt = crypto.randomBytes(16).toString('hex');
  const superAdminHash = hashPassword(initialPassword, superAdminSalt);

  return {
    id: 'user-admin-owner-001',
    email: superAdminEmail,
    full_name: 'Platform Owner',
    store_name: 'CodWorth HQ (المالك)',
    phone: (process.env.OWNER_CONTACT_PHONE || '').trim(),
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    city: 'Casablanca',
    custom_domain: 'codworth.com',
    two_factor_enabled: false,
    role: 'admin',
    status: 'active',
    plan_id: 'enterprise',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    pages_created_count: 5,
    orders_count: 50,
    subscription_status: 'active',
    subscription_tier: 'enterprise_tier',
    password_hash: superAdminHash,
    password_salt: superAdminSalt,
    mustChangePassword: false,
    initialPasswordBootstrapped: Boolean(envInitialPassword),
    email_verified: true,
    email_verified_at: new Date().toISOString(),
    email_verification_required: false,
    last_verification_email_sent_at: null,
  };
}

function writeJsonFileAtomic(filePath: string, payload: unknown): boolean {
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    try { fs.rmSync(tmpPath, { force: true }); } catch { /* best effort */ }
    console.error(`[DB ERROR] Atomic write failed for ${path.basename(filePath)}:`, err);
    return false;
  }
}

export function isOwnerOrAdminUser(
  user: Pick<UserProfile, 'email' | 'role'> | null | undefined,
  configuredOwnerEmail?: string
): boolean {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const envOwner = (configuredOwnerEmail ?? getConfiguredOwnerEmail()).trim().toLowerCase();
  return (
    user.role === 'admin' ||
    Boolean(envOwner && email === envOwner)
  );
}

/**
 * Idempotent one-time migration rule for email_verified fields (Part A1).
 */
export function migrateUsersEmailVerificationInPlace(
  usersList: StoredUser[],
  nowMs: number = Date.now()
): { modified: boolean; recentUnverifiedEmails: string[] } {
  let modified = false;
  const recentUnverifiedEmails: string[] = [];
  const nowIso = new Date(nowMs).toISOString();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const ownerEmail = getConfiguredOwnerEmail();

  for (const u of usersList) {
    if (!u || !u.id) continue;

    if (isOwnerOrAdminUser(u, ownerEmail)) {
      if (
        u.email_verified !== true ||
        u.email_verification_required !== false ||
        u.email_verified_at === undefined ||
        u.last_verification_email_sent_at === undefined
      ) {
        u.email_verified = true;
        u.email_verified_at = u.email_verified_at || nowIso;
        u.email_verification_required = false;
        u.last_verification_email_sent_at = u.last_verification_email_sent_at ?? null;
        modified = true;
      }
      continue;
    }

    if (typeof u.email_verified !== 'boolean') {
      const createdAtMs = u.created_at ? Date.parse(u.created_at) : NaN;
      const isCreatedWithinLast24h =
        Number.isFinite(createdAtMs) && nowMs - createdAtMs >= 0 && nowMs - createdAtMs <= twentyFourHoursMs;

      if (isCreatedWithinLast24h) {
        u.email_verified = false;
        u.email_verified_at = null;
        u.email_verification_required = true;
        u.last_verification_email_sent_at = u.last_verification_email_sent_at ?? null;
        recentUnverifiedEmails.push(u.email);
      } else {
        u.email_verified = true;
        u.email_verified_at = nowIso;
        u.email_verification_required = true;
        u.last_verification_email_sent_at = u.last_verification_email_sent_at ?? null;
      }
      modified = true;
    } else {
      if (u.email_verified_at === undefined) {
        u.email_verified_at = u.email_verified ? nowIso : null;
        modified = true;
      }
      if (typeof u.email_verification_required !== 'boolean') {
        u.email_verification_required = true;
        modified = true;
      }
      if (u.last_verification_email_sent_at === undefined) {
        u.last_verification_email_sent_at = null;
        modified = true;
      }
    }
  }

  if (recentUnverifiedEmails.length > 0) {
    console.warn(
      `[BOOT MIGRATION WARNING] Marked ${recentUnverifiedEmails.length} recently created (<24h) account(s) as email_verified=false requiring verification:`,
      recentUnverifiedEmails
    );
  }

  return { modified, recentUnverifiedEmails };
}

export function ensureDataFiles(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const initialSettings: PlatformSettings = {
      bankAccounts: [],
      updatedAt: new Date().toISOString(),
    };
    const initialFiles: Array<[string, () => unknown]> = [
      [USERS_FILE, () => { const ownerUser = createDefaultOwnerUser(); return ownerUser ? [ownerUser] : []; }],
      [PAYMENTS_FILE, () => []],
      [PAGES_FILE, () => []],
      [ORDERS_FILE, () => []],
      [SETTINGS_FILE, () => initialSettings],
      [PLANS_FILE, () => DEFAULT_SUBSCRIPTION_PLANS],
      [COUPONS_FILE, () => []],
      [SECURITY_LOGIN_AUDIT_FILE, () => []],
      [EMAIL_VERIFICATIONS_FILE, () => []],
    ];

    for (const [file, createInitialValue] of initialFiles) {
      if (!fs.existsSync(file) && !writeJsonFileAtomic(file, createInitialValue())) {
        throw new Error(`Unable to initialize ${path.basename(file)}.`);
      }
    }

    console.log('[BOOT] Data files verified (existing files preserved).');
  } catch (err) {
    console.error('[BOOT] Failed to verify or initialize data files:', err);
    throw err; // Never start with partially initialized or silently missing persistence.
  }
}

let persistedUsersSnapshot: Map<string, StoredUser> | null = null;
let usersStoreRef: Map<string, StoredUser> | null = null;

function cloneUsersMap(source: Map<string, StoredUser>): Map<string, StoredUser> {
  return new Map(Array.from(source.entries(), ([id, user]) => [
    id,
    JSON.parse(JSON.stringify(user)) as StoredUser,
  ]));
}

function restoreUsersMap(target: Map<string, StoredUser>): void {
  if (!persistedUsersSnapshot) return;
  target.clear();
  for (const [id, user] of persistedUsersSnapshot) {
    target.set(id, JSON.parse(JSON.stringify(user)) as StoredUser);
  }
}

function loadUsersFromDisk(): Map<string, StoredUser> {
  const usersMap = new Map<string, StoredUser>();
  if (fs.existsSync(USERS_FILE)) {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    let parsed: unknown;
    try { parsed = JSON.parse(data); }
    catch { throw new Error('users.json is corrupt. Restore a verified backup before starting CodWorth.'); }
    if (!Array.isArray(parsed)) throw new Error('users.json must contain an array. Restore a verified backup.');
    for (const user of parsed as StoredUser[]) {
      if (!user || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string') {
        throw new Error('users.json contains an invalid user record. Restore a verified backup.');
      }
      usersMap.set(user.id, user);
    }
  }
  persistedUsersSnapshot = cloneUsersMap(usersMap);

  let modified = false;
  const superAdminEmail = getConfiguredOwnerEmail();

  if (superAdminEmail) {
    const existingOwner = Array.from(usersMap.values()).find(
      (u) => u.email.toLowerCase().trim() === superAdminEmail
    );

    if (!existingOwner) {
      const ownerUser = createDefaultOwnerUser();
      if (ownerUser) {
        usersMap.set(ownerUser.id, ownerUser);
        modified = true;
      }
    } else {
      if ((process.env.OWNER_INITIAL_PASSWORD || '').trim()) {
        console.warn(
          '[SECURITY WARNING] OWNER_INITIAL_PASSWORD is set in environment, but owner record already exists. Ignoring OWNER_INITIAL_PASSWORD.'
        );
      }
      if (existingOwner.role !== 'admin') {
        existingOwner.role = 'admin';
        usersMap.set(existingOwner.id, existingOwner);
        modified = true;
      }
    }
  }

  const allLoaded = Array.from(usersMap.values());
  const migrationResult = migrateUsersEmailVerificationInPlace(allLoaded);
  if (migrationResult.modified) {
    for (const u of allLoaded) {
      usersMap.set(u.id, u);
    }
    modified = true;
  }

  if (modified) {
    saveUsersToDisk(usersMap);
  }
  return usersMap;
}

function saveUsersToDisk(usersMap: Map<string, StoredUser>): boolean {
  const list = Array.from(usersMap.values());
  if (!writeJsonFileAtomic(USERS_FILE, list)) {
    restoreUsersMap(usersMap);
    if (usersStoreRef && usersStoreRef !== usersMap) restoreUsersMap(usersStoreRef);
    throw new Error('Unable to persist user records; in-memory changes were rolled back.');
  }
  persistedUsersSnapshot = cloneUsersMap(usersMap);
  return true;
}

ensureDataFiles();
const users = loadUsersFromDisk();
usersStoreRef = users;

/* ---------------- MANUAL PAYMENTS STORE ---------------- */

function loadPaymentsFromDisk(): Map<string, ManualPaymentRequest> {
  const map = new Map<string, ManualPaymentRequest>();
  if (!fs.existsSync(PAYMENTS_FILE)) return map;
  const data = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(data); }
  catch { throw new Error('payments.json is corrupt. Restore a verified backup before starting CodWorth.'); }
  if (!Array.isArray(parsed)) throw new Error('payments.json must contain an array. Restore a verified backup.');
  for (const payment of parsed as ManualPaymentRequest[]) {
    if (!payment || typeof payment.id !== 'string' || !payment.id) {
      throw new Error('payments.json contains an invalid payment record. Restore a verified backup.');
    }
    map.set(payment.id, payment);
  }
  return map;
}

function savePaymentsToDisk(paymentsMap: Map<string, ManualPaymentRequest>) {
  if (!writeJsonFileAtomic(PAYMENTS_FILE, Array.from(paymentsMap.values()))) {
    throw new Error('Failed to persist manual payments.');
  }
}

const manualPayments = loadPaymentsFromDisk();

export function toSafeProfile(user: StoredUser): UserProfile {
  const {
    password_hash,
    password_salt,
    reset_token,
    reset_token_expires,
    resetPasswordToken,
    resetPasswordExpires,
    mustChangePassword,
    initialPasswordBootstrapped,
    ...profile
  } = user;
  if (profile.role !== 'admin' && (profile.subscription_status === 'cancelled' ||
      profile.subscription_status === 'past_due' ||
      (profile.current_period_end && Date.parse(profile.current_period_end) <= Date.now()))) {
    return { ...profile, plan_id: 'free', subscription_tier: 'free_tier', subscription_status: 'free' };
  }
  return profile;
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase();
  for (const u of users.values()) {
    if (u.email.trim().toLowerCase() === normalized) {
      return u;
    }
  }
  return undefined;
}

export function findUserById(id: string): StoredUser | undefined {
  return users.get(id);
}

/**
 * Bootstraps the owner account using process.env.OWNER_INITIAL_PASSWORD ONLY if no owner record exists.
 * If an owner record already exists, logs a startup warning and ignores OWNER_INITIAL_PASSWORD.
 */
export function bootstrapOwnerFromEnv(): {
  user: StoredUser | null;
  bootstrapped: boolean;
  warningLogged: boolean;
} {
  const configuredEmail = getConfiguredOwnerEmail();
  if (!configuredEmail) {
    return { user: null, bootstrapped: false, warningLogged: false };
  }

  const existing = findUserByEmail(configuredEmail);
  const envInitialPassword = (process.env.OWNER_INITIAL_PASSWORD || '').trim();

  if (existing) {
    let warningLogged = false;
    if (envInitialPassword) {
      console.warn(
        '[SECURITY WARNING] OWNER_INITIAL_PASSWORD is set in environment, but owner record already exists. Ignoring OWNER_INITIAL_PASSWORD.'
      );
      warningLogged = true;
    }
    return { user: existing, bootstrapped: false, warningLogged };
  }

  const rawPassword = envInitialPassword || crypto.randomBytes(32).toString('hex');
  const { hash, salt } = hashPasswordWithSalt(rawPassword);
  const id = `user-owner-${crypto.randomUUID()}`;
  const owner: StoredUser = {
    id,
    email: configuredEmail,
    full_name: 'Platform Owner',
    store_name: 'CodWorth HQ (المالك)',
    phone: (process.env.OWNER_CONTACT_PHONE || '').trim(),
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    city: 'Casablanca',
    custom_domain: 'codworth.com',
    two_factor_enabled: false,
    role: 'admin',
    status: 'active',
    plan_id: 'enterprise',
    created_at: new Date().toISOString(),
    pages_created_count: 5,
    orders_count: 50,
    subscription_status: 'active',
    subscription_tier: 'enterprise_tier',
    password_hash: hash,
    password_salt: salt,
    mustChangePassword: false,
    initialPasswordBootstrapped: Boolean(envInitialPassword),
    email_verified: true,
    email_verified_at: new Date().toISOString(),
    email_verification_required: false,
    last_verification_email_sent_at: null,
  };
  users.set(id, owner);
  saveUsersToDisk(users);
  return { user: owner, bootstrapped: Boolean(envInitialPassword), warningLogged: false };
}

export function setOwnerMustChangePassword(userId: string, mustChange: boolean): boolean {
  const user = users.get(userId);
  if (!user) return false;
  user.mustChangePassword = mustChange;
  if (!mustChange) {
    user.initialPasswordBootstrapped = false;
  }
  users.set(user.id, user);
  saveUsersToDisk(users);
  return true;
}

export function ensureOwnerAccountForEmail(email: string, initialPassword?: string): StoredUser {
  const normalized = email.trim().toLowerCase();
  const existing = findUserByEmail(normalized);
  if (existing) {
    let changed = false;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changed = true;
    }
    if (existing.status !== 'active') {
      existing.status = 'active';
      changed = true;
    }
    if (existing.email_verified !== true || existing.email_verification_required !== false) {
      existing.email_verified = true;
      existing.email_verified_at = existing.email_verified_at || new Date().toISOString();
      existing.email_verification_required = false;
      changed = true;
    }
    if (initialPassword) {
      const { hash, salt } = hashPasswordWithSalt(initialPassword);
      existing.password_hash = hash;
      existing.password_salt = salt;
      existing.mustChangePassword = false;
      existing.initialPasswordBootstrapped = false;
      // A password reset must revoke all existing owner sessions.
      invalidateAllUserSessions(existing.id);
      changed = true;
    }
    if (changed) {
      users.set(existing.id, existing);
      saveUsersToDisk(users);
    }
    return existing;
  }

  const usedEnvBootstrap = !initialPassword && Boolean((process.env.OWNER_INITIAL_PASSWORD || '').trim());
  const { hash, salt } = hashPasswordWithSalt(
    initialPassword || process.env.OWNER_INITIAL_PASSWORD || crypto.randomBytes(32).toString('hex')
  );
  const id = `user-owner-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const owner: StoredUser = {
    id,
    email: normalized,
    full_name: 'Platform Owner',
    store_name: 'CodWorth HQ (المالك)',
    phone: (process.env.OWNER_CONTACT_PHONE || '').trim(),
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    city: 'Casablanca',
    custom_domain: 'codworth.com',
    two_factor_enabled: false,
    role: 'admin',
    status: 'active',
    plan_id: 'enterprise',
    created_at: nowIso,
    pages_created_count: 5,
    orders_count: 50,
    subscription_status: 'active',
    subscription_tier: 'enterprise_tier',
    password_hash: hash,
    password_salt: salt,
    mustChangePassword: false,
    initialPasswordBootstrapped: usedEnvBootstrap,
    email_verified: true,
    email_verified_at: nowIso,
    email_verification_required: false,
    last_verification_email_sent_at: null,
  };
  users.set(id, owner);
  saveUsersToDisk(users);
  return owner;
}

export function getAllUsers(): UserProfile[] {
  const allPages = Array.from(pages.values());
  const allOrders = getAllOrders();

  return Array.from(users.values()).map((u) => {
    const userPagesCount = allPages.filter((p) => p.userId === u.id).length;
    const userOrdersCount = allOrders.filter(
      (o) => o.userId === u.id
    ).length;

    return {
      ...toSafeProfile(u),
      pages_created_count: Math.max(u.pages_created_count || 0, userPagesCount),
      orders_count: userOrdersCount,
    };
  });
}

export function updateUserPlan(
  userId: string,
  planId: 'free' | 'starter' | 'pro' | 'enterprise'
): UserProfile {
  const user = users.get(userId);
  if (!user) throw new Error('User not found.');

  user.plan_id = planId;
  if (planId === 'free') {
    user.subscription_status = 'free';
    user.subscription_tier = 'free_tier';
  } else if (planId === 'starter') {
    user.subscription_status = 'active';
    user.subscription_tier = 'starter_tier';
  } else if (planId === 'pro') {
    user.subscription_status = 'active';
    user.subscription_tier = 'pro_monthly';
  } else if (planId === 'enterprise') {
    user.subscription_status = 'active';
    user.subscription_tier = 'enterprise_tier';
  }

  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

export function updateUserAccountStatus(
  userId: string,
  status: 'active' | 'pending' | 'suspended'
): UserProfile {
  const user = users.get(userId);
  if (!user) throw new Error('User not found.');
  user.status = status;
  if (status === 'suspended') invalidateAllUserSessions(userId);
  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

export function deleteUser(userId: string): boolean {
  const exists = users.has(userId);
  if (!exists) return false;
  invalidateAllUserSessions(userId);
  users.delete(userId);
  saveUsersToDisk(users);
  return true;
}

export function createAdminUser(data: {
  email: string;
  fullName: string;
  storeName?: string;
  phone?: string;
  city?: string;
  role?: 'admin' | 'merchant' | 'user';
  planId?: 'free' | 'starter' | 'pro' | 'enterprise';
  password?: string;
}): StoredUser {
  const normalized = data.email.trim().toLowerCase();
  if (findUserByEmail(normalized)) {
    throw new Error('An account with this email already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(data.password || crypto.randomBytes(32).toString('hex'), salt);
  const id = `user-${crypto.randomUUID()}`;
  const planId = data.planId || 'free';
  const configuredOwner = getConfiguredOwnerEmail();
  const isSuperAdminEmail = Boolean(configuredOwner && normalized === configuredOwner);

  const newUser: StoredUser = {
    id,
    email: normalized,
    full_name: data.fullName.trim() || 'New Merchant',
    store_name: data.storeName?.trim() || `${data.fullName.trim()} Store`,
    phone: data.phone?.trim() || '+212 600-000000',
    city: data.city || 'الدار البيضاء',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    two_factor_enabled: false,
    role: isSuperAdminEmail ? 'admin' : 'merchant',
    status: 'active',
    plan_id: planId,
    created_at: new Date().toISOString(),
    pages_created_count: 0,
    orders_count: 0,
    subscription_status: planId === 'free' ? 'free' : 'active',
    subscription_tier:
      planId === 'enterprise'
        ? 'enterprise_tier'
        : planId === 'pro'
        ? 'pro_monthly'
        : planId === 'starter'
        ? 'starter_tier'
        : 'free_tier',
    password_hash: passwordHash,
    password_salt: salt,
    email_verified: true,
    email_verified_at: new Date().toISOString(),
    email_verification_required: !isSuperAdminEmail,
    last_verification_email_sent_at: null,
  };

  users.set(id, newUser);
  saveUsersToDisk(users);
  return newUser;
}

export function createUser(
  email: string,
  password: string,
  fullName: string,
  storeName?: string,
  phone?: string,
  twoFactorEnabled?: boolean
): StoredUser {
  const normalized = email.trim().toLowerCase();
  const existing = findUserByEmail(normalized);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const id = crypto.randomUUID();

  const configuredOwner = getConfiguredOwnerEmail();
  const isSuperAdminEmail =
    Boolean(configuredOwner && normalized === configuredOwner);
  const nowIso = new Date().toISOString();

  const newUser: StoredUser = {
    id,
    email: normalized,
    full_name: fullName.trim() || 'Merchant',
    store_name: storeName?.trim() || 'متجر COD الجديد',
    phone: phone?.trim() || '+212 600-000000',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    two_factor_enabled: twoFactorEnabled ?? false,
    role: isSuperAdminEmail ? 'admin' : 'merchant',
    status: 'active',
    plan_id: isSuperAdminEmail ? 'enterprise' : 'free',
    created_at: nowIso,
    pages_created_count: 0,
    orders_count: 0,
    subscription_status: isSuperAdminEmail ? 'active' : 'free',
    subscription_tier: isSuperAdminEmail ? 'enterprise_tier' : 'free_tier',
    password_hash: passwordHash,
    password_salt: salt,
    email_verified: isSuperAdminEmail ? true : false,
    email_verified_at: isSuperAdminEmail ? nowIso : null,
    email_verification_required: isSuperAdminEmail ? false : true,
    last_verification_email_sent_at: null,
  };

  users.set(id, newUser);
  saveUsersToDisk(users);
  return newUser;
}

/* ---------------- EMAIL VERIFICATIONS STORE (Part A2) ---------------- */

function loadEmailVerificationsFromDisk(): EmailVerificationRecord[] {
  if (!fs.existsSync(EMAIL_VERIFICATIONS_FILE)) return [];
  const raw = fs.readFileSync(EMAIL_VERIFICATIONS_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('email_verifications.json is corrupt. Restore a verified backup before starting CodWorth.'); }
  if (!Array.isArray(parsed)) throw new Error('email_verifications.json must contain an array.');
  return parsed as EmailVerificationRecord[];
}

function saveEmailVerificationsToDisk(records: EmailVerificationRecord[]): boolean {
  if (!writeJsonFileAtomic(EMAIL_VERIFICATIONS_FILE, records)) {
    throw new Error('Unable to persist email verification records.');
  }
  return true;
}

const emailVerificationRecords: EmailVerificationRecord[] = loadEmailVerificationsFromDisk();

export function computeEmailVerificationCodeHash(code: string, salt: string): string {
  return crypto.createHash('sha256').update(code + salt).digest('hex');
}

export function createEmailVerificationRecord(params: {
  userId: string;
  email: string;
  ip: string;
  userAgent: string;
  ttlMs?: number;
}): { code: string; record: EmailVerificationRecord } {
  const normalizedEmail = params.email.trim().toLowerCase();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const ttlMs = params.ttlMs ?? 15 * 60 * 1000; // 15 minutes default
  const expiresAtIso = new Date(nowMs + ttlMs).toISOString();

  // Invalidate any previous unused verification records for this user / email
  for (const rec of emailVerificationRecords) {
    if (
      rec.used_at === null &&
      (rec.user_id === params.userId || rec.email.toLowerCase() === normalizedEmail)
    ) {
      rec.used_at = nowIso;
    }
  }

  // Generate 6-digit code via crypto.randomInt (never Math.random)
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  const code_hash = computeEmailVerificationCodeHash(code, salt);

  const record: EmailVerificationRecord = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    email: normalizedEmail,
    code_hash,
    salt,
    created_at: nowIso,
    expires_at: expiresAtIso,
    attempts: 0,
    max_attempts: 5,
    used_at: null,
    ip: params.ip || '0.0.0.0',
    user_agent: params.userAgent || 'unknown',
  };

  emailVerificationRecords.push(record);
  saveEmailVerificationsToDisk(emailVerificationRecords);

  const user = users.get(params.userId) || findUserByEmail(normalizedEmail);
  if (user) {
    user.last_verification_email_sent_at = nowIso;
    users.set(user.id, user);
    saveUsersToDisk(users);
  }

  return { code, record };
}

export function verifyEmailVerificationCode(
  rawEmail: string,
  rawCode: string
): {
  status:
    | 'VERIFIED'
    | 'USER_NOT_FOUND'
    | 'EXPIRED_OR_INVALID'
    | 'MAX_ATTEMPTS_EXCEEDED'
    | 'INVALID_CODE';
  user?: UserProfile;
} {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  const cleanCode = String(rawCode || '').trim();
  const user = findUserByEmail(normalizedEmail);

  if (!user) {
    // Perform a dummy hash comparison for constant-time behavior
    const dummyHash = computeEmailVerificationCodeHash(cleanCode || '000000', DUMMY_SALT);
    const bufA = Buffer.from(dummyHash, 'hex');
    crypto.timingSafeEqual(bufA, bufA);
    return { status: 'USER_NOT_FOUND' };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Find the most recent verification record for this user + email
  let latestRecord: EmailVerificationRecord | undefined;
  for (let i = emailVerificationRecords.length - 1; i >= 0; i--) {
    const rec = emailVerificationRecords[i];
    if (rec.user_id === user.id && rec.email.toLowerCase() === normalizedEmail) {
      latestRecord = rec;
      break;
    }
  }

  if (!latestRecord) {
    return { status: 'EXPIRED_OR_INVALID' };
  }

  const expiresMs = Date.parse(latestRecord.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
    return { status: 'EXPIRED_OR_INVALID' };
  }

  if (latestRecord.attempts >= latestRecord.max_attempts) {
    if (latestRecord.used_at === null) {
      latestRecord.used_at = nowIso;
      saveEmailVerificationsToDisk(emailVerificationRecords);
    }
    return { status: 'MAX_ATTEMPTS_EXCEEDED' };
  }

  if (latestRecord.used_at !== null) {
    return { status: 'EXPIRED_OR_INVALID' };
  }

  const activeRecord = latestRecord;

  const candidateHash = computeEmailVerificationCodeHash(cleanCode, activeRecord.salt);
  const expectedBuf = Buffer.from(activeRecord.code_hash, 'hex');
  const candidateBuf = Buffer.from(candidateHash, 'hex');

  const isMatch =
    expectedBuf.length === candidateBuf.length &&
    crypto.timingSafeEqual(expectedBuf, candidateBuf);

  if (!isMatch) {
    activeRecord.attempts += 1;
    if (activeRecord.attempts >= activeRecord.max_attempts) {
      activeRecord.used_at = nowIso;
      saveEmailVerificationsToDisk(emailVerificationRecords);
      return { status: 'MAX_ATTEMPTS_EXCEEDED' };
    }
    saveEmailVerificationsToDisk(emailVerificationRecords);
    return { status: 'INVALID_CODE' };
  }

  // Match! Mark verification record used and mark user verified
  activeRecord.used_at = nowIso;
  saveEmailVerificationsToDisk(emailVerificationRecords);

  user.email_verified = true;
  user.email_verified_at = nowIso;
  users.set(user.id, user);
  saveUsersToDisk(users);

  return {
    status: 'VERIFIED',
    user: toSafeProfile(user),
  };
}

export function getEmailVerificationRecordsByEmail(email: string): EmailVerificationRecord[] {
  const normalized = email.trim().toLowerCase();
  return emailVerificationRecords.filter((r) => r.email.toLowerCase() === normalized);
}

export function updateEmailVerificationRecordForTest(
  recordId: string,
  updates: Partial<EmailVerificationRecord>
): boolean {
  const rec = emailVerificationRecords.find((r) => r.id === recordId);
  if (!rec) return false;
  Object.assign(rec, updates);
  saveEmailVerificationsToDisk(emailVerificationRecords);
  return true;
}

export function setUserEmailVerifiedState(
  userId: string,
  verified: boolean,
  required: boolean = true
): UserProfile | null {
  const user = users.get(userId);
  if (!user) return null;
  user.email_verified = verified;
  user.email_verified_at = verified ? new Date().toISOString() : null;
  user.email_verification_required = required;
  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = hashPassword('constant_time_dummy_reference_password', DUMMY_SALT);

export function timingSafeVerifyPassword(user: StoredUser | undefined, attempt: string): boolean {
  const candidate = typeof attempt === 'string' ? attempt : '';
  const saltToUse = user?.password_salt || DUMMY_SALT;
  const expectedHex = user?.password_hash || DUMMY_HASH;
  const legacy = /^[0-9a-f]{128}$/i.test(expectedHex);
  const actual = legacy
    ? crypto.pbkdf2Sync(candidate, saltToUse, 1000, 64, 'sha512').toString('hex')
    : hashPassword(candidate, saltToUse);
  const expected = Buffer.from(expectedHex);
  const computed = Buffer.from(actual);
  if (expected.length !== computed.length || !crypto.timingSafeEqual(expected, computed) || !user || !candidate) return false;
  if (legacy) {
    user.password_hash = hashPassword(candidate, saltToUse);
    saveUsersToDisk(users);
  }
  return true;
}

export function verifyPassword(user: StoredUser, attempt: string): boolean {
  return timingSafeVerifyPassword(user, attempt);
}

export function setResetPasswordToken(
  email: string,
  token: string,
  expiresAt: number
): boolean {
  const user = findUserByEmail(email);
  if (!user) return false;
  user.resetPasswordToken = token;
  user.resetPasswordExpires = expiresAt;
  users.set(user.id, user);
  saveUsersToDisk(users);
  return true;
}

export function clearResetPasswordToken(email: string): boolean {
  const user = findUserByEmail(email);
  if (!user) return false;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  users.set(user.id, user);
  saveUsersToDisk(users);
  return true;
}

export function invalidateAllUserSessions(userId: string): number {
  let removed = 0;
  for (const [token, sess] of sessions.entries()) {
    if (sess.userId === userId) {
      sessions.delete(token);
      removed += 1;
    }
  }
  if (removed > 0) {
    saveSessionsToDisk();
  }
  return removed;
}

export function updateUserPassword(
  email: string,
  newHash: string,
  newSalt: string
): boolean {
  const user = findUserByEmail(email);
  if (!user) return false;
  user.password_hash = newHash;
  user.password_salt = newSalt;
  user.mustChangePassword = false;
  user.initialPasswordBootstrapped = false;
  users.set(user.id, user);
  saveUsersToDisk(users);
  invalidateAllUserSessions(user.id);
  return true;
}

export function updateUser2FA(userId: string, enabled: boolean): UserProfile {
  const user = users.get(userId);
  if (!user) throw new Error('User not found.');
  user.two_factor_enabled = enabled;
  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

export function updateUserProfile(userId: string, data: Partial<UserProfile>): UserProfile {
  const user = users.get(userId);
  if (!user) throw new Error('User not found.');
  if (typeof data.full_name === 'string' && data.full_name.trim()) {
    user.full_name = data.full_name.trim();
  }
  if (typeof data.store_name === 'string' && data.store_name.trim()) {
    user.store_name = data.store_name.trim();
  }
  if (typeof data.phone === 'string' && data.phone.trim()) {
    user.phone = data.phone.trim();
  }
  if (typeof data.avatar === 'string' && data.avatar.trim()) {
    user.avatar = data.avatar.trim();
  }
  if (typeof data.custom_domain === 'string') {
    user.custom_domain = data.custom_domain.trim();
  }
  if (typeof data.city === 'string' && data.city.trim()) {
    user.city = data.city.trim();
  }
  if (typeof data.two_factor_enabled === 'boolean') {
    user.two_factor_enabled = data.two_factor_enabled;
  }
  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

export function findOrCreateGoogleUser(payload: { email: string; name: string; picture?: string }): StoredUser {
  const normalized = payload.email.trim().toLowerCase();
  const existing = findUserByEmail(normalized);
  if (existing) {
    let updated = false;
    if (payload.picture && !existing.avatar) {
      existing.avatar = payload.picture;
      updated = true;
    }
    if (existing.status === 'pending') {
      existing.status = 'active';
      updated = true;
    }
    if (updated) {
      users.set(existing.id, existing);
      saveUsersToDisk(users);
    }
    return existing;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(crypto.randomBytes(24).toString('hex'), salt);
  const id = crypto.randomUUID();

  const configuredOwner = getConfiguredOwnerEmail();
  const isSuperAdminEmail = Boolean(configuredOwner && normalized === configuredOwner);

  const newUser: StoredUser = {
    id,
    email: normalized,
    full_name: payload.name || 'Google Merchant',
    store_name: `${payload.name || 'Merchant'} COD Store`,
    phone: '+212 661-000000',
    avatar: payload.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    two_factor_enabled: false,
    role: isSuperAdminEmail ? 'admin' : 'merchant',
    status: 'active',
    plan_id: isSuperAdminEmail ? 'enterprise' : 'free',
    created_at: new Date().toISOString(),
    pages_created_count: 0,
    orders_count: 0,
    subscription_status: isSuperAdminEmail ? 'active' : 'free',
    subscription_tier: isSuperAdminEmail ? 'enterprise_tier' : 'free_tier',
    password_hash: passwordHash,
    password_salt: salt,
    email_verified: true,
    email_verified_at: new Date().toISOString(),
    email_verification_required: !isSuperAdminEmail,
    last_verification_email_sent_at: null,
  };

  users.set(id, newUser);
  saveUsersToDisk(users);
  return newUser;
}

const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

function loadSessionsFromDisk(): void {
  if (!fs.existsSync(SESSIONS_FILE)) return;
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    const entries = JSON.parse(raw) as Array<[string, { userId: string; expiresAt: number }]>;
    if (Array.isArray(entries)) {
      const now = Date.now();
      for (const [tok, sess] of entries) {
        if (tok && sess && sess.userId && sess.expiresAt > now) {
          sessions.set(tok, sess);
        }
      }
    }
  } catch {
    // ignore corrupt sessions file
  }
}

function saveSessionsToDisk(): void {
  if (!writeJsonFileAtomic(SESSIONS_FILE, Array.from(sessions.entries()))) {
    throw new Error('Failed to persist session changes.');
  }
}

loadSessionsFromDisk();

function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf-8').digest('hex');
}

export function createSession(userId: string): string {
  const user = users.get(userId);
  if (!user || user.status === 'suspended') throw new Error('Account unavailable.');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  sessions.set(tokenHash, { userId, expiresAt });
  try {
    saveSessionsToDisk();
  } catch (error) {
    sessions.delete(tokenHash); // Do not expose an unpersisted login as successful.
    throw error;
  }
  return rawToken;
}

export function getUserByToken(token: string): StoredUser | undefined {
  if (!token || typeof token !== 'string') {
    return undefined;
  }
  const trimmed = token.trim();
  if (!trimmed) {
    return undefined;
  }
  const tokenHash = hashSessionToken(trimmed);
  const session = sessions.get(tokenHash);
  if (!session) {
    return undefined;
  }
  if (Date.now() > session.expiresAt) {
    sessions.delete(tokenHash);
    saveSessionsToDisk();
    return undefined;
  }
  const user = users.get(session.userId);
  if (!user || user.status === 'suspended') {
    sessions.delete(tokenHash);
    saveSessionsToDisk();
    return undefined;
  }
  return user;
}

export function deleteSession(token: string): void {
  if (!token || typeof token !== 'string') return;
  const tokenHash = hashSessionToken(token.trim());
  sessions.delete(tokenHash);
  saveSessionsToDisk();
}


export function incrementUserUsage(userId: string): {
  user: UserProfile;
  allowed: boolean;
  maxPages: number;
  requiredPlan?: 'starter' | 'pro' | 'enterprise';
  message?: string;
} {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const currentPagesCount = getUserPages(userId).length;
  const access = checkFeatureAccess(
    'create_page',
    user,
    currentPagesCount,
    getConfiguredOwnerEmail()
  );

  if (!access.allowed) {
    user.pages_created_count = Math.max(user.pages_created_count || 0, currentPagesCount);
    return {
      user: toSafeProfile(user),
      allowed: false,
      maxPages: access.maxPages,
      requiredPlan: access.requiredPlan,
      message: access.message,
    };
  }

  user.pages_created_count = Math.max((user.pages_created_count || 0) + 1, currentPagesCount);
  saveUsersToDisk(users);
  return {
    user: toSafeProfile(user),
    allowed: true,
    maxPages: access.maxPages,
  };
}

export function updateUserSubscription(
  userId: string,
  status: SubscriptionStatus,
  tier: SubscriptionTier,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  currentPeriodEnd?: string
): UserProfile {
  const previous = users.get(userId);
  if (!previous) {
    throw new Error('User not found.');
  }

  const user = { ...previous };
  user.subscription_status = status;
  user.subscription_tier = tier;
  if (status === 'active') {
    // Payment must never reactivate an administratively suspended account.
    if (tier === 'starter_tier') {
      user.plan_id = 'starter';
    } else if (tier === 'enterprise_tier') {
      user.plan_id = 'enterprise';
    } else {
      user.plan_id = 'pro';
    }
  } else if (status === 'free') {
    user.plan_id = 'free';
  }
  if (stripeCustomerId) user.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) user.stripe_subscription_id = stripeSubscriptionId;
  if (currentPeriodEnd) user.current_period_end = currentPeriodEnd;

  const updated = new Map(users).set(userId, user);
  if (!saveUsersToDisk(updated)) throw new Error('Unable to save subscription.');
  users.set(userId, user);
  return toSafeProfile(user);
}

/* ---------------- MANUAL PAYMENT METHODS ---------------- */

export function createManualPaymentRequest(
  userId: string,
  userEmail: string,
  userName: string,
  method: MoroccanPaymentMethod,
  transactionReference: string,
  amount: number = 100,
  proofImageUrl?: string,
  notes?: string
): ManualPaymentRequest {
  const id = `pay-${method.toLowerCase()}-${Date.now().toString().slice(-6)}`;
  const request: ManualPaymentRequest = {
    id,
    userId,
    userEmail,
    userName,
    amount,
    method,
    transactionReference: transactionReference.trim(),
    proofImageUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes,
  };

  manualPayments.set(id, request);
  savePaymentsToDisk(manualPayments);
  return request;
}

export function getManualPaymentsByUser(userId: string): ManualPaymentRequest[] {
  const result: ManualPaymentRequest[] = [];
  for (const p of manualPayments.values()) {
    if (p.userId === userId) {
      result.push(p);
    }
  }
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllManualPayments(): ManualPaymentRequest[] {
  return Array.from(manualPayments.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function approveManualPayment(paymentId: string): { payment: ManualPaymentRequest; user: UserProfile } {
  const payment = manualPayments.get(paymentId);
  if (!payment) {
    throw new Error('Payment request not found.');
  }

  payment.status = 'approved';
  savePaymentsToDisk(manualPayments);

  const updatedUser = updateUserSubscription(
    payment.userId,
    'active',
    'pro_monthly',
    `manual_${payment.method.toLowerCase()}`,
    payment.transactionReference,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  );

  return { payment, user: updatedUser };
}

export function rejectManualPayment(paymentId: string): ManualPaymentRequest {
  const payment = manualPayments.get(paymentId);
  if (!payment) {
    throw new Error('Payment request not found.');
  }

  payment.status = 'rejected';
  savePaymentsToDisk(manualPayments);
  return payment;
}

/* ---------------- USER PAGES / FUNNELS PERSISTENCE ---------------- */

const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ء': '', 'ؤ': 'w', 'ئ': 'y',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function slugify(text: string): string {
  let raw = (text || '').toString();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep raw if not URI encoded
  }

  const cleanedInput = raw
    .replace(/\b404\s*[-_]*\s*(page|not\s*found)?\b/gi, '')
    .replace(/\bpage\s*not\s*found\b/gi, '')
    .toLowerCase()
    .trim();

  const transliterated = Array.from(cleanedInput)
    .map((ch) => (ARABIC_TO_LATIN_MAP[ch] !== undefined ? ARABIC_TO_LATIN_MAP[ch] : ch))
    .join('');

  const slug = transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!slug || slug === '404' || slug === '404-page' || slug.includes('404-page')) {
    return `funnel-${Date.now().toString(36)}`;
  }

  return slug;
}

function loadPagesFromDisk(): Map<string, StoredPage> {
  const pagesMap = new Map<string, StoredPage>();
  if (!fs.existsSync(PAGES_FILE)) return pagesMap;
  const data = fs.readFileSync(PAGES_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(data); }
  catch { throw new Error('pages.json is corrupt. Restore a verified backup before starting CodWorth.'); }
  if (!Array.isArray(parsed)) throw new Error('pages.json must contain an array. Restore a verified backup.');
  let repaired = false;
  for (const p of parsed as StoredPage[]) {
    if (!p || typeof p.id !== 'string' || !p.id || typeof p.userId !== 'string') {
      throw new Error('pages.json contains an invalid page record. Restore a verified backup.');
    }
    if (!p.slug || p.slug === '404' || p.slug.includes('404-page')) {
      p.slug = slugify(p.title || 'landing-page');
      if (p.data && typeof p.data === 'object') (p.data as Record<string, unknown>).slug = p.slug;
      repaired = true;
    }
    if (p.customDomain === undefined) { p.customDomain = null; repaired = true; }
    if (!p.domainStatus) { p.domainStatus = p.customDomain ? 'pending_dns' : 'not_connected'; repaired = true; }
    if (!p.expectedDnsIp) p.expectedDnsIp = VPS_IP;
    if (!p.expectedDnsCname) p.expectedDnsCname = CNAME_TARGET;
    pagesMap.set(p.id, p);
  }
  if (repaired) savePagesToDisk(pagesMap);
  return pagesMap;
}

// Fast O(1) in-memory lookup map: normalized custom domain (and www. variant) -> page.slug
const activeDomainToSlugCache = new Map<string, string>();

function rebuildActiveDomainCache(pagesMap: Map<string, StoredPage>): void {
  activeDomainToSlugCache.clear();
  for (const p of pagesMap.values()) {
    if (p.isPublished && p.customDomain && p.domainStatus === 'active') {
      const clean = p.customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (clean) {
        activeDomainToSlugCache.set(clean, p.slug);
        if (clean.startsWith('www.')) {
          activeDomainToSlugCache.set(clean.slice(4), p.slug);
        } else {
          activeDomainToSlugCache.set(`www.${clean}`, p.slug);
        }
      }
    }
  }
}

function savePagesToDisk(pagesMap: Map<string, StoredPage>): void {
  const list = Array.from(pagesMap.values());
  if (!writeJsonFileAtomic(PAGES_FILE, list)) throw new Error('Failed to persist pages.');
  rebuildActiveDomainCache(pagesMap);
}

const pages = loadPagesFromDisk();
rebuildActiveDomainCache(pages);

export function getActiveDomainToSlugCache(): ReadonlyMap<string, string> {
  return activeDomainToSlugCache;
}

export function saveUserPage(
  userId: string,
  pageInput: {
    id?: string;
    title?: string;
    slug?: string;
    customDomain?: string | null;
    isPublished?: boolean;
    compiledHtml?: string;
    data: unknown;
  }
): { page: StoredPage; isNew: boolean } {
  let domain: string | null | undefined;
  if (pageInput.customDomain !== undefined) {
    domain = null;
    if (pageInput.customDomain?.trim()) {
      const check = validateAndNormalizeCustomDomain(pageInput.customDomain);
      if (!check.valid || isDomainClaimedByAnotherPage(check.normalizedDomain, pageInput.id))
        throw new Error('Invalid or already connected domain.');
      domain = check.normalizedDomain;
    }
  }
  const now = new Date().toISOString();
  const dataRecord =
    typeof pageInput.data === 'object' && pageInput.data !== null
      ? (pageInput.data as Record<string, unknown>)
      : {};
  const dataTitle = typeof dataRecord.title === 'string' ? dataRecord.title : undefined;

  if (pageInput.id && pages.has(pageInput.id)) {
    const existing = pages.get(pageInput.id)!;
    const reqUser = users.get(userId);
    const isAdmin = reqUser?.role === 'admin' || reqUser?.email?.toLowerCase() === getConfiguredOwnerEmail();
    if (existing.userId !== userId && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to modify this page.');
    }
    existing.title = pageInput.title || dataTitle || existing.title;
    const candidateExistingSlug =
      pageInput.slug && !pageInput.slug.includes('404')
        ? slugify(pageInput.slug)
        : existing.slug && !existing.slug.includes('404')
        ? existing.slug
        : slugify(existing.title);
    if (existing.isPublished && !isSlugAvailable(candidateExistingSlug, existing.id)) throw new Error('Slug is taken.');
    existing.slug = candidateExistingSlug;
    existing.data = pageInput.data;
    if (existing.pixels && existing.data && typeof existing.data === 'object') {
      (existing.data as Record<string, unknown>).pixels = existing.pixels;
    }
    if (domain !== undefined && domain !== existing.customDomain) {
      existing.customDomain = domain;
      existing.domainStatus = domain ? 'pending_dns' : 'not_connected';
      existing.domainVerifiedAt = null;
      existing.domainError = null;
      existing.domainProof = domain ? crypto.randomBytes(18).toString('hex') : undefined;
    }
    if (pageInput.isPublished !== undefined) existing.isPublished = pageInput.isPublished;
    if (pageInput.compiledHtml !== undefined) existing.compiledHtml = pageInput.compiledHtml;
    existing.updatedAt = now;
    pages.set(existing.id, existing);
    savePagesToDisk(pages);
    return { page: existing, isNew: false };
  }

  const pageId = pageInput.id && !pages.has(pageInput.id) ? pageInput.id : `page-${crypto.randomUUID()}`;
  const title = pageInput.title || dataTitle || 'Untitled Landing Page';
  const slug =
    pageInput.slug && !pageInput.slug.includes('404')
      ? slugify(pageInput.slug)
      : slugify(title);

  const finalData =
    typeof pageInput.data === 'object' && pageInput.data !== null
      ? { ...(pageInput.data as Record<string, unknown>), id: pageId, title }
      : { id: pageId, title, blocks: [] };

  const normalizedCustomDomain = domain || null;

  const newPage: StoredPage = {
    id: pageId,
    userId,
    title,
    slug,
    customDomain: normalizedCustomDomain,
    domainProof: normalizedCustomDomain ? crypto.randomBytes(18).toString('hex') : undefined,
    domainStatus: normalizedCustomDomain ? 'pending_dns' : 'not_connected',
    expectedDnsIp: VPS_IP,
    expectedDnsCname: CNAME_TARGET,
    data: finalData,
    compiledHtml: pageInput.compiledHtml,
    isPublished: pageInput.isPublished ?? false,
    viewsCount: 0,
    ordersCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  pages.set(pageId, newPage);
  saveUsersToDisk(users);
  savePagesToDisk(pages);
  return { page: newPage, isNew: true };
}

export function getUserPages(userId: string): StoredPage[] {
  const userPages: StoredPage[] = [];
  for (const p of pages.values()) {
    if (p.userId === userId) {
      userPages.push(p);
    }
  }
  return userPages.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getUserPageById(userId: string, pageId: string, isAdmin = false): StoredPage | null {
  const p = pages.get(pageId);
  if (!p) return null;
  if (p.userId !== userId && !isAdmin) {
    return null;
  }
  return p;
}

export function deleteUserPage(userId: string, pageId: string, isAdmin = false): boolean {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    return false;
  }
  pages.delete(pageId);
  savePagesToDisk(pages);
  return true;
}

export function duplicateUserPage(userId: string, pageId: string): StoredPage | null {
  const source = pages.get(pageId);
  if (!source || source.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const newId = `page-${crypto.randomUUID()}`;
  const newTitle = `${source.title} (Copy)`;
  const newSlug = `${slugify(newTitle)}-${newId.slice(0, 6)}`;

  const clonedData = JSON.parse(JSON.stringify(source.data));
  if (clonedData && typeof clonedData === 'object') {
    clonedData.id = newId;
    clonedData.title = newTitle;
  }

  const duplicated: StoredPage = {
    id: newId,
    userId,
    title: newTitle,
    slug: newSlug,
    customDomain: null,
    domainStatus: 'not_connected',
    expectedDnsIp: VPS_IP,
    expectedDnsCname: CNAME_TARGET,
    data: clonedData,
    compiledHtml: source.compiledHtml,
    isPublished: false,
    viewsCount: 0,
    ordersCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  pages.set(newId, duplicated);
  savePagesToDisk(pages);
  return duplicated;
}

/* ---------------- PUBLISHING, CUSTOM DOMAINS & PIXELS HELPERS ---------------- */

export function isSlugAvailable(slug: string, excludePageId?: string): boolean {
  const normalized = slugify(slug);
  for (const p of pages.values()) {
    if (p.id !== excludePageId && p.isPublished && p.slug.trim().toLowerCase() === normalized) {
      return false;
    }
  }
  return true;
}

export function isDomainClaimedByAnotherPage(domain: string, excludePageId?: string): boolean {
  const clean = domain.trim().toLowerCase().replace(/^www\./, '');
  for (const p of pages.values()) {
    if (p.id === excludePageId || !p.customDomain) continue;
    const existingClean = p.customDomain.trim().toLowerCase().replace(/^www\./, '');
    if (existingClean === clean) {
      return true;
    }
  }
  return false;
}

export function setPageCustomDomain(
  userId: string,
  pageId: string,
  rawDomain: string,
  isAdmin = false
): StoredPage {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    throw new Error('Forbidden: Page not found or permission denied.');
  }

  const validation = validateAndNormalizeCustomDomain(rawDomain);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid domain name.');
  }

  const normalizedDomain = validation.normalizedDomain;
  if (isDomainClaimedByAnotherPage(normalizedDomain, pageId)) {
    throw new Error(`The domain "${normalizedDomain}" is already connected to another landing page.`);
  }

  const isSameDomain = p.customDomain === normalizedDomain;
  p.customDomain = normalizedDomain;
  if (!isSameDomain || !p.domainProof) p.domainProof = crypto.randomBytes(18).toString('hex');
  if (!isSameDomain || !p.domainStatus || p.domainStatus === 'not_connected' || p.domainStatus === 'error') {
    p.domainStatus = 'pending_dns';
    p.domainError = null;
    p.domainVerifiedAt = null;
  }
  p.expectedDnsIp = VPS_IP;
  p.expectedDnsCname = CNAME_TARGET;
  p.updatedAt = new Date().toISOString();

  // Also keep user profile custom_domain synced for convenience
  const owner = users.get(p.userId);
  if (owner) {
    owner.custom_domain = normalizedDomain;
    users.set(owner.id, owner);
    saveUsersToDisk(users);
  }

  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function updatePageDomainStatus(
  userId: string,
  pageId: string,
  status: CustomDomainStatus,
  errorMsg?: string | null,
  isAdmin = false
): StoredPage {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    throw new Error('Forbidden: Page not found or permission denied.');
  }

  const now = new Date().toISOString();
  p.domainStatus = status;
  p.domainError = errorMsg ?? null;
  if (status === 'active') {
    p.domainVerifiedAt = now;
    p.isPublished = true;
    p.publishedAt = p.publishedAt || now;
    if (!p.compiledHtml && p.data) {
      p.compiledHtml = generateStandaloneHtml({
        ...p.data,
        slug: p.slug,
        pixels: p.pixels || p.data.pixels,
      });
    }
  }
  p.expectedDnsIp = VPS_IP;
  p.expectedDnsCname = CNAME_TARGET;
  p.updatedAt = now;

  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function removePageCustomDomain(
  userId: string,
  pageId: string,
  isAdmin = false
): StoredPage {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    throw new Error('Forbidden: Page not found or permission denied.');
  }

  p.customDomain = null;
  p.domainStatus = 'not_connected';
  p.domainError = null;
  p.domainVerifiedAt = null;
  p.updatedAt = new Date().toISOString();

  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function updatePagePixels(
  userId: string,
  pageId: string,
  pixels: PagePixelsConfig,
  isAdmin = false
): StoredPage {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    throw new Error('Forbidden: Page not found or permission denied.');
  }

  const sanitizedPixels: PagePixelsConfig = {
    facebookPixelId: (pixels.facebookPixelId || '').trim().replace(/[^a-zA-Z0-9_-]/g, ''),
    tiktokPixelId: (pixels.tiktokPixelId || '').trim().replace(/[^a-zA-Z0-9_-]/g, ''),
    googleAnalyticsId: (pixels.googleAnalyticsId || '').trim().replace(/[^a-zA-Z0-9_-]/g, ''),
  };

  p.pixels = sanitizedPixels;
  if (p.data && typeof p.data === 'object') {
    (p.data as Record<string, unknown>).pixels = sanitizedPixels;
  }
  if (p.data) {
    p.compiledHtml = generateStandaloneHtml({
      ...p.data,
      slug: p.slug,
      pixels: sanitizedPixels,
    });
  }
  p.updatedAt = new Date().toISOString();

  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function publishPage(
  userId: string,
  pageId: string,
  slug: string,
  customDomain?: string,
  compiledHtml?: string,
  isAdmin = false
): StoredPage {
  const original = pages.get(pageId);
  if (!original || (original.userId !== userId && !isAdmin)) {
    throw new Error('Page not found or permission denied.');
  }

  const p = { ...original };
  const cleanSlug = slugify(slug);
  if (!cleanSlug) {
    throw new Error('A valid page URL slug is required.');
  }

  if (!isSlugAvailable(cleanSlug, pageId)) {
    throw new Error(`The slug "${cleanSlug}" is already taken by another live funnel. Please choose another.`);
  }

  const now = new Date().toISOString();
  p.slug = cleanSlug;
  p.isPublished = true;
  p.publishedAt = p.publishedAt || now;
  p.updatedAt = now;

  if (customDomain !== undefined) {
    const trimmed = customDomain.trim();
    if (!trimmed) {
      p.customDomain = null;
      p.domainStatus = 'not_connected';
    } else {
      const validation = validateAndNormalizeCustomDomain(trimmed);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid custom domain format.');
      }
      if (isDomainClaimedByAnotherPage(validation.normalizedDomain, pageId)) {
        throw new Error(`The domain "${validation.normalizedDomain}" is already connected to another page.`);
      }
      if (p.customDomain !== validation.normalizedDomain) {
        p.customDomain = validation.normalizedDomain;
        p.domainProof = crypto.randomBytes(18).toString('hex');
        p.domainVerifiedAt = null;
        p.domainStatus = 'pending_dns';
      }
    }
  }

  p.expectedDnsIp = VPS_IP;
  p.expectedDnsCname = CNAME_TARGET;

  if (compiledHtml) {
    p.compiledHtml = compiledHtml;
  }
  if (typeof p.viewsCount !== 'number') {
    p.viewsCount = 0;
  }
  if (typeof p.ordersCount !== 'number') {
    p.ordersCount = 0;
  }

  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function unpublishPage(userId: string, pageId: string, isAdmin = false): StoredPage {
  const p = pages.get(pageId);
  if (!p || (p.userId !== userId && !isAdmin)) {
    throw new Error('Page not found or permission denied.');
  }

  p.isPublished = false;
  p.updatedAt = new Date().toISOString();
  pages.set(pageId, p);
  savePagesToDisk(pages);
  return p;
}

export function getPublishedPageBySlug(slug: string): StoredPage | null {
  let decoded = (slug || '').trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw if malformed URI
  }
  const normalized = decoded.toLowerCase();
  const slugifiedTarget = slugify(decoded);

  // 1. Prioritize explicitly published pages matching the slug
  for (const p of pages.values()) {
    if (!p.isPublished) continue;
    const pageSlug = (p.slug || '').trim().toLowerCase();
    const pageSlugified = slugify(pageSlug);
    if (
      p.id.toLowerCase() === normalized || pageSlug === normalized ||
      pageSlug === slugifiedTarget ||
      pageSlugified === normalized ||
      pageSlugified === slugifiedTarget
    ) {
      return p;
    }
  }

  return null;
}

export function getActivePageByCustomDomain(host: string): StoredPage | null {
  const normalized = (host || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.$/, '');
  if (!normalized) return null;

  // O(1) lookup via activeDomainToSlugCache
  const cachedSlug =
    activeDomainToSlugCache.get(normalized) ||
    activeDomainToSlugCache.get(normalized.replace(/^www\./, ''));
  if (cachedSlug) {
    const bySlug = getPublishedPageBySlug(cachedSlug);
    if (bySlug && bySlug.isPublished && bySlug.customDomain?.toLowerCase() === normalized && bySlug.domainStatus === 'active') {
      return bySlug;
    }
  }

  // Fallback linear scan for active custom domains
  const bare = normalized.replace(/^www\./, '');
  for (const p of pages.values()) {
    if (p.isPublished && p.customDomain && p.domainStatus === 'active') {
      const pageDom = p.customDomain.trim().toLowerCase();
      if (pageDom === normalized) {
        activeDomainToSlugCache.set(normalized, p.slug);
        return p;
      }
    }
  }
  return null;
}

export function getPublishedPageByDomain(domain: string): StoredPage | null {
  return getActivePageByCustomDomain(domain);
}

export function incrementPageViews(slug: string): number {
  const p = getPublishedPageBySlug(slug);
  if (!p) return 0;
  p.viewsCount = (p.viewsCount || 0) + 1;
  savePagesToDisk(pages);
  return p.viewsCount;
}

export function incrementPageOrders(slug: string): number {
  const p = getPublishedPageBySlug(slug);
  if (!p) return 0;
  p.ordersCount = (p.ordersCount || 0) + 1;
  savePagesToDisk(pages);
  return p.ordersCount;
}

/* ---------------- LIVE COD ORDERS TRACKING & MULTI-TENANCY ---------------- */

export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface CustomerOrder {
  id: string;
  userId?: string;
  userEmail?: string;
  storeName?: string;
  pageSlug?: string;
  pageTitle?: string;
  funnelId?: string;
  customerName: string;
  customerPhone: string;
  customerCountry?: string;
  customerCity: string;
  customerAddress?: string;
  customerNotes?: string;
  productName: string;
  price: number;
  quantity: number;
  currency: string;
  paymentMethod?: 'cod' | 'paypal';
  paypalOrderId?: string;
  status: OrderStatus;
  createdAt: string;
  bundleName?: string;
  bundlePrice?: number | string;
}

function loadOrdersFromDisk(): CustomerOrder[] {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error('Invalid order storage. Restore a known-good backup.');
  return parsed as CustomerOrder[];
}

const orders: CustomerOrder[] = loadOrdersFromDisk();

function saveOrdersToDisk(list: CustomerOrder[]): void {
  if (!writeJsonFileAtomic(ORDERS_FILE, list)) throw new Error('Unable to persist order. Please retry.');
}

export function getAllOrders(): CustomerOrder[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOrdersForUser(userId?: string, isAdmin?: boolean): CustomerOrder[] {
  if (isAdmin && !userId) {
    return getAllOrders();
  }
  if (!userId) {
    return [];
  }

  // Ownership is immutable. Names, emails and slugs are display data, not ACLs.
  return orders.filter((order) => order.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllPagesAdmin(): StoredPage[] {
  return Array.from(pages.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getGlobalPlatformStats() {
  const allUsers = getAllUsers();
  const allOrders = getAllOrders();
  const allPages = Array.from(pages.values());
  const allPayments = getAllManualPayments();

  const totalMerchants = allUsers.filter((u) => u.role !== 'admin').length;
  const activeMerchants = allUsers.filter((u) => u.role !== 'admin' && u.status === 'active').length;
  const suspendedMerchants = allUsers.filter((u) => u.status === 'suspended').length;

  const totalGMV = allOrders.reduce((sum, o) => sum + (o.price || 0), 0);
  const totalOrdersCount = allOrders.length;
  const totalFunnelsCount = allPages.length;

  let mrrMAD = 0;
  for (const u of allUsers) {
    if (u.role === 'admin') continue;
    if (u.plan_id === 'starter') mrrMAD += 99;
    else if (u.plan_id === 'pro') mrrMAD += 179;
    else if (u.plan_id === 'enterprise') mrrMAD += 349;
  }

  const pendingPayments = allPayments.filter((p) => p.status === 'pending');
  const pendingPaymentsCount = pendingPayments.length;
  const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    totalMerchants,
    activeMerchants,
    suspendedMerchants,
    totalGMV,
    totalOrdersCount,
    totalFunnelsCount,
    mrrMAD,
    pendingPaymentsCount,
    pendingPaymentsAmount,
  };
}

export function recordCodOrder(orderData: {
  customerName: string;
  phone: string;
  country?: string;
  customerCountry?: string;
  city?: string;
  address?: string;
  productName?: string;
  price?: number | string;
  quantity?: number;
  funnelId?: string;
  pageSlug?: string;
  userId?: string;
  notes?: string;
  paymentMethod?: 'cod' | 'paypal';
  status?: OrderStatus;
  currency?: string;
  paypalOrderId?: string;
}): CustomerOrder {
  const randomSuffix = crypto.randomUUID();
  const prefix = orderData.paymentMethod === 'paypal' ? '#PP' : '#COD';
  const orderId = `${prefix}-${randomSuffix}`;

  const numPrice =
    typeof orderData.price === 'number'
      ? orderData.price
      : parseFloat(String(orderData.price || '299').replace(/[^0-9.]/g, '')) || 299;

  let resolvedUserId = orderData.userId;
  let resolvedStoreName: string | undefined;
  let resolvedUserEmail: string | undefined;

  if (orderData.pageSlug) {
    const page = getPublishedPageBySlug(orderData.pageSlug);
    if (page && page.userId && (!resolvedUserId || resolvedUserId === page.userId)) {
      resolvedUserId = page.userId;
      const owner = users.get(page.userId);
      if (owner) {
        resolvedStoreName = owner.store_name;
        resolvedUserEmail = owner.email;
      }
    }
  } else if (orderData.funnelId) {
    const page = pages.get(orderData.funnelId);
    if (page && page.userId && (!resolvedUserId || resolvedUserId === page.userId)) {
      resolvedUserId = page.userId;
      const owner = users.get(page.userId);
      if (owner) {
        resolvedStoreName = owner.store_name;
        resolvedUserEmail = owner.email;
      }
    }
  }

  const validStatuses: OrderStatus[] = ['pending', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  const initialStatus: OrderStatus =
    orderData.status && validStatuses.includes(orderData.status)
      ? orderData.status
      : orderData.paymentMethod === 'paypal'
      ? 'paid'
      : 'pending';

  const resolvedCountry = (orderData.customerCountry || orderData.country || 'Morocco').trim();

  const newOrder: CustomerOrder = {
    id: orderId,
    userId: resolvedUserId,
    userEmail: resolvedUserEmail,
    storeName: resolvedStoreName,
    funnelId: orderData.funnelId,
    pageSlug: orderData.pageSlug || '',
    customerName: (orderData.customerName || 'زبون').trim(),
    customerPhone: (orderData.phone || '').trim(),
    customerCountry: resolvedCountry,
    customerCity: (orderData.city || 'الدار البيضاء').trim(),
    customerAddress: orderData.address?.trim() || '',
    customerNotes: orderData.notes?.trim() || '',
    productName: (orderData.productName || 'منتج مميز').trim(),
    price: numPrice,
    quantity: orderData.quantity || 1,
    currency: orderData.currency || 'MAD',
    paymentMethod: orderData.paymentMethod || 'cod',
    paypalOrderId: orderData.paypalOrderId,
    status: initialStatus,
    createdAt: new Date().toISOString(),
    bundleName: `${orderData.quantity || 1}x ${orderData.productName || 'المنتج'}`,
    bundlePrice: numPrice,
  };

  // Persist before acknowledging or changing the in-memory collection.
  saveOrdersToDisk([newOrder, ...orders]);
  orders.unshift(newOrder);

  if (orderData.pageSlug) {
    const page = getPublishedPageBySlug(orderData.pageSlug);
    if (page) {
      page.ordersCount = (page.ordersCount || 0) + 1;
      savePagesToDisk(pages);
    }
  }

  return newOrder;
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  notes?: string,
  requestingUserId?: string,
  isAdmin: boolean = false
): CustomerOrder | null {
  const index = orders.findIndex((o) => o.id === orderId);
  if (index === -1) return null;

  if (!isAdmin) {
    if (!requestingUserId) {
      throw new Error('Unauthorized: Authentication required to update order.');
    }
    const userOrders = getOrdersForUser(requestingUserId, false);
    const ownsOrder = userOrders.some((o) => o.id === orderId);
    if (!ownsOrder) {
      throw new Error('Forbidden: You do not have permission to modify this order.');
    }
  }

  if (status) {
    orders[index].status = status;
  }
  if (notes !== undefined) {
    orders[index].customerNotes = notes;
  }
  saveOrdersToDisk(orders);
  return orders[index];
}

export function recordPageOrder(orderData: {
  pageSlug: string;
  pageTitle?: string;
  customerName: string;
  customerPhone: string;
  customerCity?: string;
  customerAddress?: string;
  customerNotes?: string;
  bundleName?: string;
  bundlePrice?: number | string;
  userId?: string;
}): { success: boolean; orderId: string; page?: StoredPage } {
  const numPrice =
    typeof orderData.bundlePrice === 'number'
      ? orderData.bundlePrice
      : parseFloat(String(orderData.bundlePrice || '299').replace(/[^0-9.]/g, '')) || 299;

  const created = recordCodOrder({
    customerName: orderData.customerName,
    phone: orderData.customerPhone,
    city: orderData.customerCity,
    address: orderData.customerAddress,
    productName: orderData.pageTitle || orderData.bundleName || 'منتج متجر CodWorth',
    price: numPrice,
    quantity: 1,
    pageSlug: orderData.pageSlug,
    userId: orderData.userId,
    notes: orderData.customerNotes,
  });

  let page: StoredPage | null = null;
  if (orderData.pageSlug) {
    page = getPublishedPageBySlug(orderData.pageSlug);
  }

  return { success: true, orderId: created.id, page: page || undefined };
}

export function getPageOrders(slug: string, ownerId: string): CustomerOrder[] {
  return orders.filter((o) => o.userId === ownerId && o.pageSlug === slug);
}

/* ---------------- PLATFORM SETTINGS & DYNAMIC MOROCCAN BANKS STORE (data/settings.json) ---------------- */

function loadSettingsFromDisk(): PlatformSettings {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const initialSettings: PlatformSettings = { bankAccounts: [], updatedAt: new Date().toISOString() };
    if (!writeJsonFileAtomic(SETTINGS_FILE, initialSettings)) {
      throw new Error('Unable to initialize settings.json.');
    }
    return initialSettings;
  }
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('settings.json is corrupt. Restore a verified backup before editing bank accounts.'); }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Partial<PlatformSettings>).bankAccounts)) {
    throw new Error('settings.json has an invalid structure. Restore a verified backup.');
  }
  const settings = parsed as Partial<PlatformSettings>;
  return {
    bankAccounts: settings.bankAccounts as MoroccanBankAccount[],
    updatedAt: settings.updatedAt || new Date().toISOString(),
  };
}

let platformSettings: PlatformSettings = loadSettingsFromDisk();

export function getPlatformSettings(): PlatformSettings {
  platformSettings = loadSettingsFromDisk();
  return platformSettings;
}

export function getBankAccounts(onlyActive: boolean = false): MoroccanBankAccount[] {
  const current = getPlatformSettings();
  if (onlyActive) {
    return current.bankAccounts.filter((b) => b.isActive !== false);
  }
  return current.bankAccounts;
}

export function saveBankAccounts(accounts?: MoroccanBankAccount[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const now = new Date().toISOString();
    const sourceAccounts = Array.isArray(accounts) ? accounts : platformSettings.bankAccounts;

    const normalized: MoroccanBankAccount[] = sourceAccounts.map((acc, index) => {
      const methodId = acc.methodId || inferMoroccanPaymentMethod(acc.name || acc.bankName);
      return {
        id: acc.id?.trim() || `bank-${methodId.toLowerCase()}-${index + 1}`,
        methodId,
        name: (acc.name ?? '').trim(),
        bankName: (acc.bankName ?? acc.name ?? '').trim(),
        subtitle: (acc.subtitle ?? '').trim(),
        badge: (acc.badge ?? '').trim(),
        rib: acc.rib ? acc.rib.trim() : '',
        beneficiary: (acc.beneficiary ?? '').trim(),
        cin: acc.cin ? acc.cin.trim() : undefined,
        phone: acc.phone ? acc.phone.trim() : undefined,
        instructions: (acc.instructions ?? '').trim(),
        isActive: acc.isActive !== false,
        updatedAt: now,
      };
    });

    const nextSettings: PlatformSettings = {
      bankAccounts: normalized,
      updatedAt: now,
    };
    if (!writeJsonFileAtomic(SETTINGS_FILE, nextSettings)) return false;
    platformSettings = nextSettings;
    return true;
  } catch (err) {
    console.error('Failed to write bank accounts to data/settings.json:', err);
    return false;
  }
}

export function upsertBankAccount(
  input: Partial<MoroccanBankAccount> & { id?: string; name?: string; beneficiary?: string }
): { success: boolean; bank: MoroccanBankAccount } {
  const current = getBankAccounts(false);
  const now = new Date().toISOString();
  const targetId = input.id?.trim() || `bank-${Date.now().toString().slice(-6)}`;
  const existingIndex = current.findIndex((b) => b.id === targetId);
  const existing = existingIndex >= 0 ? current[existingIndex] : undefined;

  const resolvedName = input.name !== undefined ? input.name.trim() : existing?.name || '';
  const resolvedBankName =
    input.bankName !== undefined ? input.bankName.trim() : existing?.bankName || resolvedName;
  const methodId =
    input.methodId || existing?.methodId || inferMoroccanPaymentMethod(resolvedName || resolvedBankName);

  const record: MoroccanBankAccount = {
    id: targetId,
    methodId,
    name: resolvedName,
    bankName: resolvedBankName,
    subtitle: input.subtitle !== undefined ? input.subtitle.trim() : existing?.subtitle || '',
    badge: input.badge !== undefined ? input.badge.trim() : existing?.badge || '',
    rib: input.rib !== undefined ? input.rib.trim() : existing?.rib || '',
    beneficiary: input.beneficiary !== undefined ? input.beneficiary.trim() : existing?.beneficiary || '',
    cin: input.cin !== undefined ? (input.cin.trim() || undefined) : existing?.cin,
    phone: input.phone !== undefined ? (input.phone.trim() || undefined) : existing?.phone,
    instructions:
      input.instructions !== undefined ? input.instructions.trim() : existing?.instructions || '',
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : existing?.isActive !== false,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    current[existingIndex] = record;
  } else {
    current.push(record);
  }

  const saved = saveBankAccounts(current);
  return { success: saved, bank: record };
}

export function deleteBankAccount(id: string): boolean {
  const current = getBankAccounts(false);
  const filtered = current.filter((b) => b.id !== id);
  if (filtered.length === current.length) return false;
  return saveBankAccounts(filtered);
}

/* ---------------- DYNAMIC SUBSCRIPTION PLANS & COUPONS STORE ---------------- */

export function getPlans(): SubscriptionPlanConfig[] {
  if (!fs.existsSync(PLANS_FILE)) {
    return DEFAULT_SUBSCRIPTION_PLANS.map((p) => ({ ...p, features: [...p.features] }));
  }
  const raw = fs.readFileSync(PLANS_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('plans.json is corrupt. Restore a verified backup before changing subscriptions.'); }
  if (!Array.isArray(parsed)) throw new Error('plans.json must contain an array.');
  if (parsed.length === 0) return DEFAULT_SUBSCRIPTION_PLANS.map((p) => ({ ...p, features: [...p.features] }));
  return parsed.map((p) => {
    const fallback = DEFAULT_SUBSCRIPTION_PLANS.find((d) => d.id === p.id) || DEFAULT_SUBSCRIPTION_PLANS[0];
    return {
      id: p.id as 'starter' | 'pro' | 'enterprise',
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : fallback.name,
      nameAr: typeof p.nameAr === 'string' && p.nameAr.trim() ? p.nameAr.trim() : fallback.nameAr,
      priceMAD: typeof p.priceMAD === 'number' && Number.isFinite(p.priceMAD) && p.priceMAD > 0
        ? Math.round(p.priceMAD * 100) / 100 : fallback.priceMAD,
      features: Array.isArray(p.features)
        ? p.features.map((feature: unknown) => String(feature ?? '').trim()).filter(Boolean)
        : fallback.features,
    };
  });
}

export function savePlans(plansInput: SubscriptionPlanConfig[]): SubscriptionPlanConfig[] {
  const current = getPlans();
  const byId = new Map<string, SubscriptionPlanConfig>();
  for (const c of current) {
    byId.set(c.id, c);
  }

  for (const incoming of plansInput) {
    if (!incoming || !['starter', 'pro', 'enterprise'].includes(incoming.id)) {
      continue;
    }
    const existing =
      byId.get(incoming.id) ||
      DEFAULT_SUBSCRIPTION_PLANS.find((d) => d.id === incoming.id)!;

    const cleanPrice = Number(incoming.priceMAD);
    const cleanFeatures = Array.isArray(incoming.features)
      ? incoming.features.map((f) => String(f ?? '').trim()).filter(Boolean)
      : existing.features;

    byId.set(incoming.id, {
      id: incoming.id,
      name:
        typeof incoming.name === 'string' && incoming.name.trim()
          ? incoming.name.trim()
          : existing.name,
      nameAr:
        typeof incoming.nameAr === 'string' && incoming.nameAr.trim()
          ? incoming.nameAr.trim()
          : existing.nameAr,
      priceMAD:
        Number.isFinite(cleanPrice) && cleanPrice > 0
          ? Math.round(cleanPrice * 100) / 100
          : existing.priceMAD,
      features: cleanFeatures.length > 0 ? cleanFeatures : existing.features,
    });
  }

  const ordered: SubscriptionPlanConfig[] = (['starter', 'pro', 'enterprise'] as const).map(
    (id) => byId.get(id) || DEFAULT_SUBSCRIPTION_PLANS.find((d) => d.id === id)!
  );

  if (!writeJsonFileAtomic(PLANS_FILE, ordered)) throw new Error('Failed to persist plans.');
  return ordered;
}

export function getCoupons(): SaaSCoupon[] {
  if (!fs.existsSync(COUPONS_FILE)) return [];
  const raw = fs.readFileSync(COUPONS_FILE, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('coupons.json is corrupt. Restore a verified backup before processing discounts.'); }
  if (!Array.isArray(parsed)) throw new Error('coupons.json must contain an array.');
  return parsed
    .filter((coupon) => coupon && typeof coupon.code === 'string' && coupon.code.trim())
    .map((coupon) => ({
      code: String(coupon.code).trim().toUpperCase(),
      discountType: coupon.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Math.max(0, Number(coupon.discountValue) || 0),
      maxUses: Math.max(1, Math.floor(Number(coupon.maxUses) || 1)),
      redemptionIds: Array.isArray(coupon.redemptionIds) ? coupon.redemptionIds.filter((id: unknown) => typeof id === 'string') : [],
      currentUses: Math.max(0, Math.floor(Number(coupon.currentUses) || 0)),
      expiresAt: String(coupon.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()),
      isActive: coupon.isActive !== false,
      createdAt: coupon.createdAt ? String(coupon.createdAt) : undefined,
    }));
}

export function saveCoupons(coupons: SaaSCoupon[]): SaaSCoupon[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!writeJsonFileAtomic(COUPONS_FILE, coupons)) throw new Error('Unable to save coupons.');
  return coupons;
}

export function createCoupon(input: {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number;
  expiresAt: string;
  isActive?: boolean;
}): SaaSCoupon {
  const normalizedCode = input.code.trim().toUpperCase();
  if (!normalizedCode || !/^[A-Z0-9_-]{2,32}$/.test(normalizedCode)) {
    throw new Error('Coupon code must be 2–32 characters (letters, numbers, dashes, or underscores).');
  }

  const discountType: 'percentage' | 'fixed' =
    input.discountType === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = Number(input.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new Error('Discount value must be greater than 0.');
  }
  if (discountType === 'percentage' && discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%.');
  }

  const maxUses = Math.floor(Number(input.maxUses));
  if (!Number.isFinite(maxUses) || maxUses < 1) {
    throw new Error('Max uses must be at least 1.');
  }

  const parsedExpiry = new Date(input.expiresAt);
  if (Number.isNaN(parsedExpiry.getTime())) {
    throw new Error('Invalid expiry date.');
  }

  const allCoupons = getCoupons();
  const existingIdx = allCoupons.findIndex((c) => c.code === normalizedCode);

  const newCoupon: SaaSCoupon = {
    code: normalizedCode,
    discountType,
    discountValue: Math.round(discountValue * 100) / 100,
    maxUses,
    currentUses: existingIdx >= 0 ? allCoupons[existingIdx].currentUses : 0,
    expiresAt: parsedExpiry.toISOString(),
    isActive: input.isActive !== false,
    createdAt: existingIdx >= 0 ? allCoupons[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    allCoupons[existingIdx] = newCoupon;
  } else {
    allCoupons.unshift(newCoupon);
  }

  saveCoupons(allCoupons);
  return newCoupon;
}

export function deleteOrDisableCoupon(code: string): boolean {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) return false;

  const allCoupons = getCoupons();
  const filtered = allCoupons.filter((c) => c.code !== normalizedCode);
  if (filtered.length === allCoupons.length) {
    return false;
  }
  saveCoupons(filtered);
  return true;
}

export function incrementCouponUsage(code: string, redemptionId?: string): SaaSCoupon | null {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) return null;

  const allCoupons = getCoupons();
  const target = allCoupons.find((c) => c.code === normalizedCode);
  if (!target) return null;

  if (redemptionId) {
    if (target.redemptionIds?.includes(redemptionId)) return target;
    target.redemptionIds = [...(target.redemptionIds || []), redemptionId];
  }
  target.currentUses = (target.currentUses || 0) + 1;
  if (target.currentUses >= target.maxUses) {
    target.isActive = false;
  }
  saveCoupons(allCoupons);
  return target;
}

export function validateAndCalculateCoupon(
  couponCode: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
):
  | {
      valid: true;
      coupon: SaaSCoupon;
      plan: SubscriptionPlanConfig;
      originalPrice: number;
      finalPrice: number;
      discountAmount: number;
      error?: undefined;
    }
  | {
      valid: false;
      coupon?: undefined;
      plan?: SubscriptionPlanConfig;
      originalPrice: number;
      finalPrice: number;
      discountAmount: number;
      error: string;
    } {
  const cleanPlanId = (planId || '')
    .trim()
    .toLowerCase()
    .replace(/_(monthly|yearly)$/, '')
    .replace(/^plan:/, '')
    .split(':')[0] as 'starter' | 'pro' | 'enterprise';

  const plans = getPlans();
  const plan = plans.find((p) => p.id === cleanPlanId);
  if (!plan) {
    return {
      valid: false,
      originalPrice: 0,
      finalPrice: 0,
      discountAmount: 0,
      error: 'الباقة المحددة غير صالحة (Invalid subscription plan).',
    };
  }

  const baseMonthlyMAD = plan.priceMAD;
  const originalPrice =
    billingCycle === 'yearly'
      ? Math.round(baseMonthlyMAD * 0.8) * 12
      : baseMonthlyMAD;

  const normalizedCode = (couponCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return {
      valid: false,
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      error: 'يرجى إدخال كود الخصم (Coupon code is required).',
    };
  }

  const coupons = getCoupons();
  const coupon = coupons.find((c) => c.code === normalizedCode);

  if (!coupon || !coupon.isActive) {
    return {
      valid: false,
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      error: 'كود الخصم غير صالح أو غير مفعل (Invalid or inactive coupon code).',
    };
  }

  const expiresMs = new Date(coupon.expiresAt).getTime();
  if (Number.isNaN(expiresMs) || Date.now() > expiresMs) {
    return {
      valid: false,
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      error: 'انتهت صلاحية كود الخصم (Coupon has expired).',
    };
  }

  if (coupon.currentUses >= coupon.maxUses) {
    return {
      valid: false,
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      error: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون (Coupon usage limit reached).',
    };
  }

  let rawDiscount = 0;
  if (coupon.discountType === 'percentage') {
    rawDiscount = Math.round(((originalPrice * coupon.discountValue) / 100) * 100) / 100;
  } else {
    rawDiscount = Math.round(coupon.discountValue * 100) / 100;
  }

  // Ensure finalPrice is at least 1 MAD so PayPal order creation succeeds with a positive amount
  const finalPrice = Math.max(1, Math.round((originalPrice - rawDiscount) * 100) / 100);
  const discountAmount = Math.max(0, Math.round((originalPrice - finalPrice) * 100) / 100);

  return {
    valid: true,
    coupon,
    plan,
    originalPrice,
    finalPrice,
    discountAmount,
  };
}

/* ---------------- FORENSIC LOGIN AUDIT LOG (data/security_login_audit.json) ---------------- */

function loadSecurityLoginAuditFromDisk(): SecurityLoginAuditEntry[] {
  try {
    if (!fs.existsSync(SECURITY_LOGIN_AUDIT_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(SECURITY_LOGIN_AUDIT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return capSecurityAuditEntries(parsed as SecurityLoginAuditEntry[], MAX_SECURITY_LOGIN_AUDIT_ENTRIES);
    }
  } catch (err) {
    console.warn('[SECURITY AUDIT] Failed to read data/security_login_audit.json:', err);
  }
  return [];
}

let securityLoginAuditLogs: SecurityLoginAuditEntry[] = loadSecurityLoginAuditFromDisk();

function saveSecurityLoginAuditToDisk(entries: SecurityLoginAuditEntry[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const capped = capSecurityAuditEntries(entries, MAX_SECURITY_LOGIN_AUDIT_ENTRIES);
    const tmpFile = `${SECURITY_LOGIN_AUDIT_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(capped, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpFile, SECURITY_LOGIN_AUDIT_FILE);
  } catch (err) {
    console.error('[SECURITY AUDIT] Failed to write data/security_login_audit.json:', err);
  }
}

/**
 * Appends a redacted forensic authentication entry to data/security_login_audit.json
 * and enforces the 5,000-entry rolling cap to prevent disk bloat.
 */
export function recordSecurityLoginAudit(params: {
  userEmail: string;
  ipAddress: string;
  location?: string;
  userAgent: string;
  authMethod: SecurityAuthMethod;
  status: SecurityLoginStatus;
  failureReason?: string | null;
}): SecurityLoginAuditEntry {
  const uaInfo = parseUserAgentInfo(params.userAgent);
  const rawEntry: SecurityLoginAuditEntry = {
    id: `sec-login-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    userEmail: (params.userEmail || 'unknown').trim().toLowerCase().slice(0, 254),
    ipAddress: (params.ipAddress || '0.0.0.0').trim().slice(0, 64),
    location: params.location ? String(params.location).trim().slice(0, 100) : 'Public Network',
    userAgent: uaInfo.userAgent,
    deviceSummary: uaInfo.deviceSummary,
    authMethod: params.authMethod,
    status: params.status,
    failureReason:
      params.status === 'FAILED'
        ? (params.failureReason || 'authentication_failed').trim().slice(0, 120)
        : null,
  };

  const sanitizedEntry = redactForensicSensitiveData(
    rawEntry as unknown as Record<string, unknown>
  ) as unknown as SecurityLoginAuditEntry;

  securityLoginAuditLogs = capSecurityAuditEntries(
    [sanitizedEntry, ...loadSecurityLoginAuditFromDisk()],
    MAX_SECURITY_LOGIN_AUDIT_ENTRIES
  );
  saveSecurityLoginAuditToDisk(securityLoginAuditLogs);

  return sanitizedEntry;
}

/**
 * Retrieves forensic login audit entries for the Owner's Security & Forensics panel.
 */
export function getSecurityLoginAuditLogs(options?: {
  limit?: number;
  search?: string;
  status?: 'ALL' | 'SUCCESS' | 'FAILED';
}): SecurityLoginAuditEntry[] {
  securityLoginAuditLogs = loadSecurityLoginAuditFromDisk();
  let filtered = securityLoginAuditLogs;

  if (options?.status && (options.status === 'SUCCESS' || options.status === 'FAILED')) {
    filtered = filtered.filter((entry) => entry.status === options.status);
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (entry) =>
        entry.userEmail.toLowerCase().includes(q) ||
        entry.ipAddress.toLowerCase().includes(q) ||
        (entry.failureReason && entry.failureReason.toLowerCase().includes(q)) ||
        (entry.deviceSummary && entry.deviceSummary.toLowerCase().includes(q))
    );
  }

  const maxLimit = Math.min(
    MAX_SECURITY_LOGIN_AUDIT_ENTRIES,
    Math.max(1, Number(options?.limit) || 500)
  );
  return filtered.slice(0, maxLimit);
}

/**
 * Updates a user's lastLoginIp, lastLoginAt, lastLoginLocation, and lastLoginUserAgent
 * upon successful authentication.
 */
export function recordUserLoginMetadata(
  userId: string,
  ipAddress: string,
  location?: string,
  userAgent?: string
): UserProfile | null {
  const user = users.get(userId);
  if (!user) return null;

  user.lastLoginIp = (ipAddress || '0.0.0.0').trim();
  user.lastLoginAt = new Date().toISOString();
  if (location) {
    user.lastLoginLocation = location.trim();
  }
  if (userAgent) {
    const uaInfo = parseUserAgentInfo(userAgent);
    user.lastLoginUserAgent = uaInfo.deviceSummary;
  }

  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}




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
} from '../src/types/user';
import {
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  inferMoroccanPaymentMethod,
} from '../src/utils/currencyAndBanks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.resolve(DATA_DIR, 'payments.json');
const PAGES_FILE = path.resolve(DATA_DIR, 'pages.json');
const ORDERS_FILE = path.resolve(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');

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
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
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
    phone: '+212 722-256897',
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
  };
}

export function ensureDataFiles(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      const ownerUser = createDefaultOwnerUser();
      fs.writeFileSync(USERS_FILE, JSON.stringify(ownerUser ? [ownerUser] : [], null, 2), 'utf-8');
    }

    if (!fs.existsSync(PAYMENTS_FILE)) {
      fs.writeFileSync(PAYMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }

    if (!fs.existsSync(PAGES_FILE)) {
      fs.writeFileSync(PAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
    }

    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }

    if (!fs.existsSync(SETTINGS_FILE)) {
      const initialSettings: PlatformSettings = {
        bankAccounts: [],
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(initialSettings, null, 2), 'utf-8');
    }

    console.log('[BOOT] Data files verified (existing files preserved).');
  } catch (err) {
    console.error('[BOOT] Failed to verify or initialize data files:', err);
  }
}

function loadUsersFromDisk(): Map<string, StoredUser> {
  const usersMap = new Map<string, StoredUser>();
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: StoredUser[] = JSON.parse(data);
      if (Array.isArray(list)) {
        for (const u of list) {
          if (u && u.id) {
            usersMap.set(u.id, u);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse users.json:', e);
    }
  }

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

  if (modified) {
    saveUsersToDisk(usersMap);
  }
  return usersMap;
}

function saveUsersToDisk(usersMap: Map<string, StoredUser>): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write users to disk:', err);
    return false;
  }
}

ensureDataFiles();
const users = loadUsersFromDisk();

/* ---------------- MANUAL PAYMENTS STORE ---------------- */

function loadPaymentsFromDisk(): Map<string, ManualPaymentRequest> {
  const map = new Map<string, ManualPaymentRequest>();
  if (fs.existsSync(PAYMENTS_FILE)) {
    try {
      const data = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
      const list: ManualPaymentRequest[] = JSON.parse(data);
      for (const p of list) {
        map.set(p.id, p);
      }
    } catch (e) {
      console.warn('Failed to parse payments.json, re-initializing store:', e);
    }
  }
  return map;
}

function savePaymentsToDisk(paymentsMap: Map<string, ManualPaymentRequest>) {
  try {
    const list = Array.from(paymentsMap.values());
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write payments to disk:', err);
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
    phone: '+212 722-256897',
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
    if (initialPassword) {
      const { hash, salt } = hashPasswordWithSalt(initialPassword);
      existing.password_hash = hash;
      existing.password_salt = salt;
      existing.mustChangePassword = false;
      existing.initialPasswordBootstrapped = false;
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
  const owner: StoredUser = {
    id,
    email: normalized,
    full_name: 'Platform Owner',
    store_name: 'CodWorth HQ (المالك)',
    phone: '+212 722-256897',
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
    initialPasswordBootstrapped: usedEnvBootstrap,
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
      (o) => o.userId === u.id || o.userEmail === u.email || (o.storeName && o.storeName === u.store_name)
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
  users.set(userId, user);
  saveUsersToDisk(users);
  return toSafeProfile(user);
}

export function deleteUser(userId: string): boolean {
  const exists = users.has(userId);
  if (!exists) return false;
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
  const passwordHash = hashPassword(data.password || 'password123', salt);
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
  const isSuperAdminEmail = Boolean(configuredOwner && normalized === configuredOwner);

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
    created_at: new Date().toISOString(),
    pages_created_count: 0,
    orders_count: 0,
    subscription_status: isSuperAdminEmail ? 'active' : 'free',
    subscription_tier: isSuperAdminEmail ? 'enterprise_tier' : 'free_tier',
    password_hash: passwordHash,
    password_salt: salt,
  };

  users.set(id, newUser);
  saveUsersToDisk(users);
  return newUser;
}

const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = hashPassword('constant_time_dummy_reference_password', DUMMY_SALT);

export function timingSafeVerifyPassword(user: StoredUser | undefined, attempt: string): boolean {
  const candidate = typeof attempt === 'string' ? attempt : '';
  const saltToUse = user?.password_salt || DUMMY_SALT;
  const expectedHex = user?.password_hash || DUMMY_HASH;
  const computedHex = hashPassword(candidate, saltToUse);

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const computedBuf = Buffer.from(computedHex, 'hex');

  if (expectedBuf.length !== computedBuf.length) {
    return false;
  }
  const matches = crypto.timingSafeEqual(expectedBuf, computedBuf);
  return Boolean(user && candidate.length > 0 && matches);
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
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const entries = Array.from(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

loadSessionsFromDisk();

function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf-8').digest('hex');
}

export function createSession(userId: string): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  sessions.set(tokenHash, { userId, expiresAt });
  saveSessionsToDisk();
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
  return users.get(session.userId);
}

export function deleteSession(token: string): void {
  if (!token || typeof token !== 'string') return;
  const tokenHash = hashSessionToken(token.trim());
  sessions.delete(tokenHash);
  saveSessionsToDisk();
}


export function incrementUserUsage(userId: string): { user: UserProfile; allowed: boolean } {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const isPro = user.subscription_status === 'active';
  const MAX_FREE_PAGES = 2;

  if (!isPro && user.pages_created_count >= MAX_FREE_PAGES) {
    return { user: toSafeProfile(user), allowed: false };
  }

  user.pages_created_count += 1;
  saveUsersToDisk(users);
  return { user: toSafeProfile(user), allowed: true };
}

export function updateUserSubscription(
  userId: string,
  status: SubscriptionStatus,
  tier: SubscriptionTier,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  currentPeriodEnd?: string
): UserProfile {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  user.subscription_status = status;
  user.subscription_tier = tier;
  if (status === 'active') {
    user.status = 'active';
  }
  if (stripeCustomerId) user.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) user.stripe_subscription_id = stripeSubscriptionId;
  if (currentPeriodEnd) user.current_period_end = currentPeriodEnd;

  saveUsersToDisk(users);
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
  if (fs.existsSync(PAGES_FILE)) {
    try {
      const data = fs.readFileSync(PAGES_FILE, 'utf-8');
      const list: StoredPage[] = JSON.parse(data);
      let repaired = false;
      for (const p of list) {
        if (!p.slug || p.slug === '404' || p.slug.includes('404-page')) {
          p.slug = slugify(p.title || 'landing-page');
          if (p.data && typeof p.data === 'object') {
            (p.data as Record<string, unknown>).slug = p.slug;
          }
          repaired = true;
        }
        pagesMap.set(p.id, p);
      }
      if (repaired) {
        savePagesToDisk(pagesMap);
      }
    } catch (e) {
      console.warn('Failed to parse pages.json, re-initializing store:', e);
    }
  }
  return pagesMap;
}

function savePagesToDisk(pagesMap: Map<string, StoredPage>): void {
  try {
    const list = Array.from(pagesMap.values());
    fs.writeFileSync(PAGES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write pages to disk:', err);
  }
}

const pages = loadPagesFromDisk();

export function saveUserPage(
  userId: string,
  pageInput: {
    id?: string;
    title?: string;
    slug?: string;
    customDomain?: string;
    isPublished?: boolean;
    compiledHtml?: string;
    data: unknown;
  }
): { page: StoredPage; isNew: boolean } {
  const now = new Date().toISOString();
  const dataRecord =
    typeof pageInput.data === 'object' && pageInput.data !== null
      ? (pageInput.data as Record<string, unknown>)
      : {};
  const dataTitle = typeof dataRecord.title === 'string' ? dataRecord.title : undefined;

  if (pageInput.id && pages.has(pageInput.id)) {
    const existing = pages.get(pageInput.id)!;
    if (existing.userId !== userId) {
      throw new Error('Forbidden: You do not have permission to modify this page.');
    }
    existing.title = pageInput.title || dataTitle || existing.title;
    const candidateExistingSlug =
      pageInput.slug && !pageInput.slug.includes('404')
        ? slugify(pageInput.slug)
        : existing.slug && !existing.slug.includes('404')
        ? existing.slug
        : slugify(existing.title);
    existing.slug = candidateExistingSlug;
    existing.data = pageInput.data;
    if (pageInput.customDomain !== undefined) existing.customDomain = pageInput.customDomain;
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

  const newPage: StoredPage = {
    id: pageId,
    userId,
    title,
    slug,
    customDomain: pageInput.customDomain,
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

export function getUserPageById(userId: string, pageId: string): StoredPage | null {
  const p = pages.get(pageId);
  if (!p || p.userId !== userId) {
    return null;
  }
  return p;
}

export function deleteUserPage(userId: string, pageId: string): boolean {
  const p = pages.get(pageId);
  if (!p || p.userId !== userId) {
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
    customDomain: undefined,
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

/* ---------------- PUBLISHING & HOSTING HELPERS ---------------- */

export function isSlugAvailable(slug: string, excludePageId?: string): boolean {
  const normalized = slugify(slug);
  for (const p of pages.values()) {
    if (p.id !== excludePageId && p.isPublished && p.slug.trim().toLowerCase() === normalized) {
      return false;
    }
  }
  return true;
}

export function publishPage(
  userId: string,
  pageId: string,
  slug: string,
  customDomain?: string,
  compiledHtml?: string
): StoredPage {
  const p = pages.get(pageId);
  if (!p || p.userId !== userId) {
    throw new Error('Page not found or permission denied.');
  }

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
    const cleanDomain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    p.customDomain = cleanDomain || undefined;
  }

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

export function unpublishPage(userId: string, pageId: string): StoredPage {
  const p = pages.get(pageId);
  if (!p || p.userId !== userId) {
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
      pageSlug === normalized ||
      pageSlug === slugifiedTarget ||
      pageSlugified === normalized ||
      pageSlugified === slugifiedTarget
    ) {
      return p;
    }
  }

  // 2. Fallback to any saved page matching the slug or ID so saved funnel links always resolve
  for (const p of pages.values()) {
    const pageSlug = (p.slug || '').trim().toLowerCase();
    const pageSlugified = slugify(pageSlug);
    if (
      pageSlug === normalized ||
      pageSlug === slugifiedTarget ||
      pageSlugified === normalized ||
      pageSlugified === slugifiedTarget ||
      p.id.toLowerCase() === normalized
    ) {
      return p;
    }
  }

  return null;
}

export function getPublishedPageByDomain(domain: string): StoredPage | null {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  for (const p of pages.values()) {
    if (p.isPublished && p.customDomain && p.customDomain.trim().toLowerCase() === normalized) {
      return p;
    }
  }
  return null;
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
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        return parsed as CustomerOrder[];
      }
    } catch {
      // Return empty array if corrupted
    }
  }
  return [];
}

const orders: CustomerOrder[] = loadOrdersFromDisk();

function saveOrdersToDisk(list: CustomerOrder[]): void {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save orders to disk:', e);
  }
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

  const userSlugs = new Set<string>();
  for (const p of pages.values()) {
    if (p.userId === userId && p.slug) {
      userSlugs.add(p.slug.toLowerCase());
    }
  }

  const u = users.get(userId);
  const userEmail = u?.email?.toLowerCase();
  const storeName = u?.store_name?.toLowerCase();

  return orders
    .filter((o) => {
      if (o.userId === userId) return true;
      if (userEmail && o.userEmail?.toLowerCase() === userEmail) return true;
      if (storeName && o.storeName?.toLowerCase() === storeName) return true;
      if (o.pageSlug && userSlugs.has(o.pageSlug.toLowerCase())) return true;
      return false;
    })
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
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
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
    if (page && page.userId) {
      resolvedUserId = page.userId;
      const owner = users.get(page.userId);
      if (owner) {
        resolvedStoreName = owner.store_name;
        resolvedUserEmail = owner.email;
      }
    }
  } else if (orderData.funnelId) {
    const page = pages.get(orderData.funnelId);
    if (page && page.userId) {
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

  const newOrder: CustomerOrder = {
    id: orderId,
    userId: resolvedUserId,
    userEmail: resolvedUserEmail,
    storeName: resolvedStoreName,
    funnelId: orderData.funnelId,
    pageSlug: orderData.pageSlug || '',
    customerName: (orderData.customerName || 'زبون').trim(),
    customerPhone: (orderData.phone || '').trim(),
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

  orders.unshift(newOrder);
  if (orders.length > 500) {
    orders.pop();
  }
  saveOrdersToDisk(orders);

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

export function getPageOrders(slug: string): CustomerOrder[] {
  return orders.filter((o) => o.pageSlug === slug);
}

/* ---------------- PLATFORM SETTINGS & DYNAMIC MOROCCAN BANKS STORE (data/settings.json) ---------------- */

function loadSettingsFromDisk(): PlatformSettings {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PlatformSettings>;
      if (parsed && Array.isArray(parsed.bankAccounts)) {
        return {
          bankAccounts: parsed.bankAccounts,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.error('Failed to read or parse data/settings.json:', err);
  }

  const initialSettings: PlatformSettings = {
    bankAccounts: [],
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(initialSettings, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to create data/settings.json:', err);
  }

  return initialSettings;
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

    platformSettings = {
      bankAccounts: normalized,
      updatedAt: now,
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(platformSettings, null, 2), 'utf-8');
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


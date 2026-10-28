import express, { Request, Response, NextFunction, Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import helmet from 'helmet';
import { z } from 'zod';
import {
  findUserByEmail,
  findUserById,
  getUserByToken,
  timingSafeVerifyPassword,
  hashPasswordWithSalt,
  updateUserPassword,
  invalidateAllUserSessions,
  setOwnerMustChangePassword,
  bootstrapOwnerFromEnv,
  StoredUser,
} from './db';
import {
  sendSandboxResetEmail,
  sendSandboxTestEmail,
  sendAdminNotificationEmail,
} from './mailer';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const AUDIT_LOG_FILE = path.resolve(DATA_DIR, 'sandbox_audit.json');
const SANDBOX_SESSIONS_FILE = path.resolve(DATA_DIR, 'sandbox_sessions.json');
const SANDBOX_RESET_TOKENS_FILE = path.resolve(DATA_DIR, 'sandbox_reset_tokens.json');
const DEPLOY_LOCK_FILE = path.resolve(DATA_DIR, 'sandbox_deploy_lock.json');
const SERVER_COMMAND_LOCK_FILE = path.resolve(DATA_DIR, 'sandbox_command_lock.json');

/* ---------------- CONSTANTS ---------------- */

export const SANDBOX_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes max duration
export const SANDBOX_REVERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes re-verification window
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 5; // 5 attempts per 15m per IP and per email
export const CONSECUTIVE_FAILURES_FOR_LOCKOUT = 10; // 10 consecutive failed attempts -> 30m lockout
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const RESET_TOKEN_TTL_MS = 20 * 60 * 1000; // 20 minutes
export const DEPLOY_COOLDOWN_MS = 5 * 60 * 1000; // 1 deploy per 5 minutes
export const DEPLOY_LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes safety TTL for lock
export const AUDIT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB rotation threshold
export const RECOVERY_FIXED_PAD_MS = 350; // Fixed 350ms constant-time target for recovery requests
export const SERVER_COMMAND_TIMEOUT_MS = 10_000; // Hard 10-second execution timeout
export const SERVER_COMMAND_MAX_BUFFER_BYTES = 1024 * 1024; // Hard 1 MB output cap
export const SERVER_COMMAND_RATE_WINDOW_MS = 60 * 1000; // 1-minute sliding window
export const MAX_SERVER_COMMANDS_PER_MINUTE = 3; // Strict max 3 commands per minute
export const SERVER_COMMAND_LOCK_STALE_MS = 15 * 1000; // 15s stale lock recovery (> 10s timeout)
export const RESTRICTED_VPS_WORKDIR = '/var/www/funnelcraft';

/* ---------------- TYPES ---------------- */

export type AuditAction =
  | 'login_success'
  | 'login_failure'
  | 'account_lockout'
  | 'owner_password_bootstrapped'
  | 'owner_password_changed'
  | 'recovery_request'
  | 'recovery_verify_failure'
  | 'password_change'
  | 'reverify_success'
  | 'reverify_failure'
  | 'deploy_trigger'
  | 'check_failure'
  | 'deploy_result'
  | 'server_command'
  | 'logout';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  ip: string;
  userAgent: string;
  action: AuditAction;
  result: 'success' | 'failure' | 'blocked';
  commandId?: string;
  executionTimeMs?: number;
  exitCode?: number;
  metadata: Record<string, unknown>;
}

export interface SandboxSession {
  sessionIdHash: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  lastVerifiedAt: number;
  ip: string;
  userAgent: string;
}

export interface SandboxResetTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  requestedIp: string;
}

export interface PreDeployCheckResult {
  name: 'typecheck' | 'tests' | 'build' | 'branch';
  command: string;
  passed: boolean;
  durationMs: number;
  summary: string;
}

export interface PreDeploySuiteResult {
  allPassed: boolean;
  commitSha: string;
  branch: string;
  checks: PreDeployCheckResult[];
}

export interface GitHubDispatchResult {
  dispatched: boolean;
  status: number;
  actionsUrl: string;
  workflowId: string;
  commitSha: string;
  errorSummary?: string;
}

interface DeployLockState {
  inProgress: boolean;
  lockedAt: number;
  actorEmail: string;
  lastCompletedDeployAt: number;
}

/* ---------------- ZOD VALIDATION SCHEMAS ---------------- */

const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();

const reverifySchema = z
  .object({
    password: z.string().min(1).max(256),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .max(128, 'New password must not exceed 128 characters.'),
  })
  .strict();

const recoveryRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();

const recoveryVerifyQuerySchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid token format'),
});

const recoveryResetSchema = z
  .object({
    token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid token format'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
  })
  .strict();

const serverCommandSchema = z
  .object({
    commandId: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(256),
  })
  .strict();

/* ---------------- SECRET REDACTION & UNIFIED RESPONSE ---------------- */

const EXPLICIT_SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'csrftoken',
  'x-csrf-token',
  'x-sandbox-token',
  'authorization',
  'cookie',
  'set-cookie',
  'github_deploy_pat',
  'smtp_pass',
]);

const SENSITIVE_KEY_PATTERN =
  /password|newpassword|currentpassword|secret|token|csrf|pat|authorization|cookie|key|credential|hash|salt|smtp_pass/i;

function redactSensitiveStringValue(val: string): string {
  return val
    .replace(/(ghp_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+)/g, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/sandbox_sid=[a-f0-9]+/gi, 'sandbox_sid=[REDACTED]')
    .replace(/sandbox_csrf=[a-f0-9]+/gi, 'sandbox_csrf=[REDACTED]')
    .slice(0, 300);
}

export function redactSecrets(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const output: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = k.trim().toLowerCase();
    if (EXPLICIT_SENSITIVE_KEYS.has(normalizedKey) || SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
      output[k] = '[REDACTED]';
    } else if (Array.isArray(v)) {
      output[k] = v.map((item) =>
        typeof item === 'string'
          ? redactSensitiveStringValue(item)
          : item && typeof item === 'object'
          ? redactSecrets(item)
          : item
      );
    } else if (v && typeof v === 'object') {
      output[k] = redactSecrets(v);
    } else if (typeof v === 'string') {
      output[k] = redactSensitiveStringValue(v);
    } else {
      output[k] = v;
    }
  }
  return output;
}

export function sendUnifiedResponse(
  res: Response,
  status: number,
  payload: {
    ok: boolean;
    code: string;
    message: string;
    [key: string]: unknown;
  }
): Response {
  return res.status(status).json(payload);
}

/* ---------------- DURABLE ATOMIC AUDIT TRAIL (DEFECT 7) ---------------- */

/**
 * Startup fail-closed check: verifies DATA_DIR is writable.
 * If the directory cannot be created or written to, logs a fatal error and throws.
 */
export function verifyAuditStorageWritable(targetDir: string = DATA_DIR): void {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.accessSync(targetDir, fs.constants.W_OK);
    const probeFile = path.join(
      targetDir,
      `.sandbox_write_probe_${process.pid}_${crypto.randomUUID()}`
    );
    fs.writeFileSync(probeFile, 'ok', { encoding: 'utf-8', mode: 0o600 });
    fs.unlinkSync(probeFile);
  } catch (err) {
    console.error('[FATAL] Sandbox audit data directory is not writable. Refusing to start.');
    throw new Error(
      `FATAL: Sandbox audit storage directory is not writable (${
        err instanceof Error ? err.message : 'io_error'
      })`
    );
  }
}

verifyAuditStorageWritable();

function loadAuditLogsFromDisk(): AuditLogEntry[] {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let auditLogs: AuditLogEntry[] = loadAuditLogsFromDisk();

export function rotateAuditLogIfNeeded(maxBytes: number = AUDIT_MAX_FILE_BYTES): string | null {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return null;
  }
  const stats = fs.statSync(AUDIT_LOG_FILE);
  if (stats.size >= maxBytes) {
    const rotatedPath = path.resolve(DATA_DIR, `sandbox_audit.${Date.now()}.json`);
    fs.renameSync(AUDIT_LOG_FILE, rotatedPath);
    auditLogs = [];
    return rotatedPath;
  }
  return null;
}

function saveAuditLogsAtomically(): void {
  verifyAuditStorageWritable();
  rotateAuditLogIfNeeded();

  const serialized = JSON.stringify(auditLogs, null, 2);
  const serializedBytes = Buffer.byteLength(serialized, 'utf-8');

  // If the new payload itself exceeds the 10 MB threshold and a file exists, rotate first
  if (serializedBytes >= AUDIT_MAX_FILE_BYTES && fs.existsSync(AUDIT_LOG_FILE)) {
    const rotatedPath = path.resolve(DATA_DIR, `sandbox_audit.${Date.now()}.json`);
    fs.renameSync(AUDIT_LOG_FILE, rotatedPath);
    auditLogs = auditLogs.slice(-1);
  }

  const finalPayload = JSON.stringify(auditLogs, null, 2);
  const tmpFile = `${AUDIT_LOG_FILE}.tmp.${process.pid}.${crypto.randomUUID()}`;
  const fd = fs.openSync(tmpFile, 'w', 0o600);
  try {
    fs.writeFileSync(fd, finalPayload, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpFile, AUDIT_LOG_FILE);
}

export function recordAuditLog(params: {
  actorEmail: string;
  ip: string;
  userAgent?: string;
  action: AuditAction;
  result: 'success' | 'failure' | 'blocked';
  commandId?: string;
  executionTimeMs?: number;
  exitCode?: number;
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorEmail: (params.actorEmail || 'anonymous').toLowerCase().trim(),
    ip: params.ip || '0.0.0.0',
    userAgent: redactSensitiveStringValue(params.userAgent || 'unknown').slice(0, 250),
    action: params.action,
    result: params.result,
    ...(params.commandId !== undefined ? { commandId: params.commandId } : {}),
    ...(params.executionTimeMs !== undefined ? { executionTimeMs: params.executionTimeMs } : {}),
    ...(params.exitCode !== undefined ? { exitCode: params.exitCode } : {}),
    metadata: redactSecrets(params.metadata || {}),
  };
  auditLogs.push(entry);
  saveAuditLogsAtomically();
  return entry;
}

export function getAuditLogs(limit = 100): AuditLogEntry[] {
  return auditLogs.slice(-limit).reverse();
}

export function clearAuditLogsForTest(): void {
  auditLogs = [];
  saveAuditLogsAtomically();
}

/* ---------------- CLIENT IP & COOKIE HELPERS ---------------- */

export function getRequestIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf-8').digest('hex');
}

function timingSafeHexEqual(hexA: string, hexB: string): boolean {
  if (typeof hexA !== 'string' || typeof hexB !== 'string') return false;
  if (hexA.length !== hexB.length || hexA.length === 0 || hexA.length % 2 !== 0) return false;
  try {
    const bufA = Buffer.from(hexA, 'hex');
    const bufB = Buffer.from(hexB, 'hex');
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/* ---------------- SESSION-BOUND CSRF PROTECTION (DEFECT 5) ---------------- */

interface CsrfTokenRecord {
  sandboxSid: string; // Bound sandbox_sid raw token (or '' when pre-authentication)
  expiresAt: number;
}

const csrfStore = new Map<string, CsrfTokenRecord>(); // sha256(csrfToken) -> CsrfTokenRecord

export function extractRawSandboxToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sandbox_sid && /^[a-f0-9]{64}$/i.test(cookies.sandbox_sid)) {
    return cookies.sandbox_sid.trim();
  }
  const headerToken = req.headers['x-sandbox-token'];
  if (typeof headerToken === 'string' && /^[a-f0-9]{64}$/i.test(headerToken.trim())) {
    return headerToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (/^[a-f0-9]{64}$/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function issueCsrfToken(req: Request, res: Response): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const currentSandboxSid = extractRawSandboxToken(req) || '';
  const expiresAt = Date.now() + SANDBOX_SESSION_TTL_MS;

  csrfStore.set(tokenHash, {
    sandboxSid: currentSandboxSid,
    expiresAt,
  });

  // Prune expired CSRF entries
  const now = Date.now();
  for (const [hash, rec] of csrfStore.entries()) {
    if (now > rec.expiresAt) csrfStore.delete(hash);
  }

  res.append(
    'Set-Cookie',
    `sandbox_csrf=${rawToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`
  );
  return rawToken;
}

export function bindCsrfTokenToSession(rawCsrfToken: string, newSandboxSid: string): void {
  if (!rawCsrfToken || !/^[a-f0-9]{64}$/i.test(rawCsrfToken)) return;
  const tokenHash = sha256Hex(rawCsrfToken.trim());
  const rec = csrfStore.get(tokenHash);
  if (rec && Date.now() <= rec.expiresAt) {
    rec.sandboxSid = newSandboxSid;
    csrfStore.set(tokenHash, rec);
  }
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const headerToken =
    typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'].trim() : '';

  if (!headerToken || !/^[a-f0-9]{64}$/i.test(headerToken)) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'Invalid or missing CSRF token.',
    });
  }

  const tokenHash = sha256Hex(headerToken);
  const record = csrfStore.get(tokenHash);
  if (!record || Date.now() > record.expiresAt) {
    csrfStore.delete(tokenHash);
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'Invalid or expired CSRF token.',
    });
  }

  // Verify the CSRF token's bound sandbox_sid matches the current request's sandbox_sid
  const currentRequestSid = extractRawSandboxToken(req) || '';
  if (record.sandboxSid !== currentRequestSid) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'CSRF token is bound to a different session.',
    });
  }

  // If browser sent sandbox_csrf cookie, enforce exact timing-safe equality with header token
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sandbox_csrf && !timingSafeHexEqual(cookies.sandbox_csrf, headerToken)) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'CSRF token cookie mismatch.',
    });
  }

  return next();
}

/* ---------------- RATE LIMITING & BRUTE-FORCE LOCKOUT ---------------- */

interface AttemptRecord {
  windowTimestamps: number[];
  consecutiveFailures: number;
  lockedUntil: number;
}

const ipAttempts = new Map<string, AttemptRecord>();
const emailAttempts = new Map<string, AttemptRecord>();

function getOrCreateAttemptRecord(store: Map<string, AttemptRecord>, key: string): AttemptRecord {
  let rec = store.get(key);
  if (!rec) {
    rec = { windowTimestamps: [], consecutiveFailures: 0, lockedUntil: 0 };
    store.set(key, rec);
  }
  return rec;
}

function pruneWindow(rec: AttemptRecord, now: number): void {
  rec.windowTimestamps = rec.windowTimestamps.filter((ts) => now - ts < LOGIN_WINDOW_MS);
}

export function checkLoginAllowed(
  ip: string,
  email: string
): { allowed: boolean; reason?: 'locked' | 'rate_limited'; retryAfterSeconds?: number } {
  const now = Date.now();
  const normalizedEmail = email.trim().toLowerCase();

  const ipRec = getOrCreateAttemptRecord(ipAttempts, ip);
  const emailRec = getOrCreateAttemptRecord(emailAttempts, normalizedEmail);

  pruneWindow(ipRec, now);
  pruneWindow(emailRec, now);

  if (ipRec.lockedUntil > now) {
    return {
      allowed: false,
      reason: 'locked',
      retryAfterSeconds: Math.ceil((ipRec.lockedUntil - now) / 1000),
    };
  }
  if (emailRec.lockedUntil > now) {
    return {
      allowed: false,
      reason: 'locked',
      retryAfterSeconds: Math.ceil((emailRec.lockedUntil - now) / 1000),
    };
  }

  if (
    ipRec.windowTimestamps.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW ||
    emailRec.windowTimestamps.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW
  ) {
    return {
      allowed: false,
      reason: 'rate_limited',
      retryAfterSeconds: Math.ceil(LOGIN_WINDOW_MS / 1000),
    };
  }

  return { allowed: true };
}

export function recordLoginFailure(ip: string, email: string, userAgent?: string): {
  lockedOut: boolean;
  rateLimited: boolean;
} {
  const now = Date.now();
  const normalizedEmail = email.trim().toLowerCase();

  const ipRec = getOrCreateAttemptRecord(ipAttempts, ip);
  const emailRec = getOrCreateAttemptRecord(emailAttempts, normalizedEmail);

  pruneWindow(ipRec, now);
  pruneWindow(emailRec, now);

  ipRec.windowTimestamps.push(now);
  emailRec.windowTimestamps.push(now);

  ipRec.consecutiveFailures += 1;
  emailRec.consecutiveFailures += 1;

  let lockedOut = false;
  if (
    ipRec.consecutiveFailures >= CONSECUTIVE_FAILURES_FOR_LOCKOUT ||
    emailRec.consecutiveFailures >= CONSECUTIVE_FAILURES_FOR_LOCKOUT
  ) {
    ipRec.lockedUntil = now + LOCKOUT_DURATION_MS;
    emailRec.lockedUntil = now + LOCKOUT_DURATION_MS;
    lockedOut = true;
    recordAuditLog({
      actorEmail: normalizedEmail,
      ip,
      userAgent,
      action: 'account_lockout',
      result: 'blocked',
      metadata: {
        reason: 'consecutive_failed_attempts_threshold',
        lockDurationMinutes: 30,
      },
    });
  }

  const rateLimited =
    ipRec.windowTimestamps.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW ||
    emailRec.windowTimestamps.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW;

  return { lockedOut, rateLimited };
}

export function resetLoginFailures(ip: string, email: string): void {
  const normalizedEmail = email.trim().toLowerCase();
  ipAttempts.delete(ip);
  emailAttempts.delete(normalizedEmail);
}

export function resetRateLimitsForTest(): void {
  ipAttempts.clear();
  emailAttempts.clear();
}

/* ---------------- SANDBOX 30-MINUTE SESSION STORE ---------------- */

function loadSandboxSessionsFromDisk(): Map<string, SandboxSession> {
  const map = new Map<string, SandboxSession>();
  if (!fs.existsSync(SANDBOX_SESSIONS_FILE)) return map;
  try {
    const raw = fs.readFileSync(SANDBOX_SESSIONS_FILE, 'utf-8');
    const list: SandboxSession[] = JSON.parse(raw);
    const now = Date.now();
    if (Array.isArray(list)) {
      for (const s of list) {
        if (s && s.sessionIdHash && s.expiresAt > now) {
          map.set(s.sessionIdHash, s);
        }
      }
    }
  } catch {
    // ignore corrupt file
  }
  return map;
}

const sandboxSessions = loadSandboxSessionsFromDisk();

function saveSandboxSessionsToDisk(): void {
  try {
    const list = Array.from(sandboxSessions.values());
    const tmp = `${SANDBOX_SESSIONS_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, SANDBOX_SESSIONS_FILE);
  } catch {
    // ignore write error
  }
}

export function createSandboxSession(
  user: StoredUser,
  ip: string,
  userAgent: string,
  res: Response
): { rawToken: string; session: SandboxSession } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionIdHash = sha256Hex(rawToken);
  const now = Date.now();
  const session: SandboxSession = {
    sessionIdHash,
    userId: user.id,
    email: user.email.toLowerCase().trim(),
    createdAt: now,
    expiresAt: now + SANDBOX_SESSION_TTL_MS,
    lastVerifiedAt: now,
    ip,
    userAgent: (userAgent || 'unknown').slice(0, 250),
  };

  sandboxSessions.set(sessionIdHash, session);
  saveSandboxSessionsToDisk();

  res.append(
    'Set-Cookie',
    `sandbox_sid=${rawToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`
  );

  return { rawToken, session };
}

export function invalidateAllSandboxSessions(): void {
  sandboxSessions.clear();
  saveSandboxSessionsToDisk();
}

export function deleteSandboxSessionByRawToken(rawToken: string): void {
  if (!rawToken) return;
  const hash = sha256Hex(rawToken);
  sandboxSessions.delete(hash);
  saveSandboxSessionsToDisk();
}

export function getActiveSandboxSession(req: Request): {
  session: SandboxSession;
  user: StoredUser;
  rawToken: string;
} | null {
  const rawToken = extractRawSandboxToken(req);
  if (!rawToken) return null;

  const hash = sha256Hex(rawToken);
  const session = sandboxSessions.get(hash);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sandboxSessions.delete(hash);
    saveSandboxSessionsToDisk();
    return null;
  }

  const user = findUserById(session.userId);
  if (!user) {
    sandboxSessions.delete(hash);
    saveSandboxSessionsToDisk();
    return null;
  }

  return { session, user, rawToken };
}

/* ---------------- OWNER AUTHORIZATION MIDDLEWARE (DEFECT 6 & DEFECT 8) ---------------- */

export interface SandboxAuthRequest extends Request {
  user?: { email?: string; role?: string; id?: string };
  sandboxUser?: StoredUser;
  sandboxSession?: SandboxSession;
  sandboxRawToken?: string;
}

export function isStrictOwnerUser(
  user: { email?: string; role?: string } | undefined
): boolean {
  const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!configuredOwnerEmail || !user || typeof user.email !== 'string') {
    return false;
  }
  return (
    user.role === 'admin' &&
    user.email.trim().toLowerCase() === configuredOwnerEmail
  );
}

/**
 * Server-side middleware enforcing:
 * 1. Fail-closed 403 if process.env.OWNER_EMAIL is unset or empty (Defect 8)
 * 2. Strict owner criteria: role === 'admin' AND email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase() (403 if non-owner)
 * 3. Valid authenticated 30-minute Sandbox session (401 if unauthenticated)
 * 4. Forced password change gate: if user.mustChangePassword === true, returns 403 PASSWORD_CHANGE_REQUIRED on all routes except /auth/logout and /auth/change-password (Defect 6)
 */
export function requireOwner(req: SandboxAuthRequest, res: Response, next: NextFunction) {
  const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!configuredOwnerEmail) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'FORBIDDEN_OWNER_NOT_CONFIGURED',
      message: 'Owner access is disabled because OWNER_EMAIL is not configured.',
    });
  }

  // If upstream middleware attached req.user whose email or role does not match OWNER_EMAIL, reject 403
  if (req.user && !isStrictOwnerUser(req.user)) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'FORBIDDEN_NOT_OWNER',
      message: 'Access restricted to the platform owner.',
    });
  }

  const activeSandbox = getActiveSandboxSession(req);

  if (activeSandbox) {
    if (!isStrictOwnerUser(activeSandbox.user)) {
      return sendUnifiedResponse(res, 403, {
        ok: false,
        code: 'FORBIDDEN_NOT_OWNER',
        message: 'Access restricted to the platform owner.',
      });
    }

    // Defect 6: Enforce forced password change after initial bootstrap login
    if (activeSandbox.user.mustChangePassword === true) {
      const allowedPaths = new Set(['/auth/logout', '/auth/change-password']);
      if (!allowedPaths.has(req.path)) {
        return sendUnifiedResponse(res, 403, {
          ok: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Initial bootstrap password must be changed before accessing Sandbox.',
        });
      }
    }

    req.sandboxUser = activeSandbox.user;
    req.sandboxSession = activeSandbox.session;
    req.sandboxRawToken = activeSandbox.rawToken;
    return next();
  }

  // Check if caller presented a standard platform Bearer token (e.g., a merchant or non-owner admin)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const platformUser = getUserByToken(bearerToken);
    if (platformUser) {
      if (!isStrictOwnerUser(platformUser)) {
        return sendUnifiedResponse(res, 403, {
          ok: false,
          code: 'FORBIDDEN_NOT_OWNER',
          message: 'Access restricted to the platform owner.',
        });
      }
      return sendUnifiedResponse(res, 401, {
        ok: false,
        code: 'SANDBOX_SESSION_REQUIRED',
        message: 'Dedicated Sandbox authentication session required.',
      });
    }
  }

  return sendUnifiedResponse(res, 401, {
    ok: false,
    code: 'UNAUTHENTICATED',
    message: 'Authentication required.',
  });
}

/* ---------------- PASSWORD RECOVERY TOKEN STORE (SHA-256 ONLY) ---------------- */

function loadResetTokensFromDisk(): Map<string, SandboxResetTokenRecord> {
  const map = new Map<string, SandboxResetTokenRecord>();
  if (!fs.existsSync(SANDBOX_RESET_TOKENS_FILE)) return map;
  try {
    const raw = fs.readFileSync(SANDBOX_RESET_TOKENS_FILE, 'utf-8');
    const list: SandboxResetTokenRecord[] = JSON.parse(raw);
    if (Array.isArray(list)) {
      for (const rec of list) {
        if (rec && rec.tokenHash) {
          map.set(rec.tokenHash, rec);
        }
      }
    }
  } catch {
    // ignore corrupt file
  }
  return map;
}

const resetTokens = loadResetTokensFromDisk();

function saveResetTokensToDisk(): void {
  try {
    const list = Array.from(resetTokens.values());
    const tmp = `${SANDBOX_RESET_TOKENS_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, SANDBOX_RESET_TOKENS_FILE);
  } catch {
    // ignore write error
  }
}

export function verifySandboxResetToken(rawToken: string): SandboxResetTokenRecord | null {
  if (!rawToken || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return null;
  }
  const candidateHash = sha256Hex(rawToken.trim());
  const now = Date.now();

  for (const record of resetTokens.values()) {
    if (timingSafeHexEqual(record.tokenHash, candidateHash)) {
      if (record.used || now > record.expiresAt) {
        return null;
      }
      return record;
    }
  }
  return null;
}

/* ---------------- DEPLOY LOCK & PRE-DEPLOY CHECKS ---------------- */

function loadDeployLockFromDisk(): DeployLockState {
  if (!fs.existsSync(DEPLOY_LOCK_FILE)) {
    return { inProgress: false, lockedAt: 0, actorEmail: '', lastCompletedDeployAt: 0 };
  }
  try {
    const raw = fs.readFileSync(DEPLOY_LOCK_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DeployLockState;
    if (parsed && typeof parsed.inProgress === 'boolean') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { inProgress: false, lockedAt: 0, actorEmail: '', lastCompletedDeployAt: 0 };
}

let deployLockState: DeployLockState = loadDeployLockFromDisk();

function saveDeployLockToDisk(): void {
  try {
    const tmp = `${DEPLOY_LOCK_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(deployLockState, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    fs.renameSync(tmp, DEPLOY_LOCK_FILE);
  } catch {
    // ignore
  }
}

export function isDeployCurrentlyInProgress(): boolean {
  const diskState = loadDeployLockFromDisk();
  if (diskState.inProgress) {
    if (Date.now() - diskState.lockedAt > DEPLOY_LOCK_STALE_MS) {
      deployLockState.inProgress = false;
      saveDeployLockToDisk();
      return false;
    }
    return true;
  }
  return deployLockState.inProgress;
}

export function resetDeployStateForTest(): void {
  deployLockState = {
    inProgress: false,
    lockedAt: 0,
    actorEmail: '',
    lastCompletedDeployAt: 0,
  };
  saveDeployLockToDisk();
}

export function setDeployInProgressForTest(inProgress: boolean, actorEmail = 'owner@test'): void {
  deployLockState.inProgress = inProgress;
  deployLockState.lockedAt = inProgress ? Date.now() : 0;
  deployLockState.actorEmail = inProgress ? actorEmail : '';
  saveDeployLockToDisk();
}

function sanitizeCliOutput(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\/app\/applet\//g, '')
    .replace(/\/home\/[^\s/]+\//g, '')
    .replace(/(ghp_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+)/g, '[REDACTED]')
    .trim()
    .slice(0, 400);
}

async function runSingleCheck(
  name: PreDeployCheckResult['name'],
  cmd: string,
  args: string[],
  displayCommand: string
): Promise<PreDeployCheckResult> {
  const start = Date.now();
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd: path.resolve(__dirname, '..'),
      timeout: 120_000,
      env: { ...process.env, CI: 'true' },
    });
    return {
      name,
      command: displayCommand,
      passed: true,
      durationMs: Date.now() - start,
      summary: sanitizeCliOutput(stdout) || 'Passed with zero errors.',
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    const rawMsg = execErr.stderr || execErr.stdout || execErr.message || 'Check failed';
    return {
      name,
      command: displayCommand,
      passed: false,
      durationMs: Date.now() - start,
      summary: sanitizeCliOutput(rawMsg) || 'Check failed.',
    };
  }
}

export async function defaultPreDeployChecksRunner(): Promise<PreDeploySuiteResult> {
  const checks: PreDeployCheckResult[] = [];

  const tscCheck = await runSingleCheck('typecheck', 'npx', ['tsc', '--noEmit'], 'npx tsc --noEmit');
  checks.push(tscCheck);

  const testCheck = await runSingleCheck('tests', 'npm', ['test'], 'npm test');
  checks.push(testCheck);

  const buildCheck = await runSingleCheck('build', 'npm', ['run', 'build'], 'npm run build');
  checks.push(buildCheck);

  const branchStart = Date.now();
  let currentBranch = 'unknown';
  let commitSha = 'unknown';
  try {
    const branchOut = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 10_000,
    });
    currentBranch = branchOut.stdout.trim();

    const shaOut = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 10_000,
    });
    commitSha = shaOut.stdout.trim();
  } catch {
    currentBranch = process.env.GIT_BRANCH || 'unknown';
    commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
  }

  const branchPassed = currentBranch === 'main';
  checks.push({
    name: 'branch',
    command: 'git rev-parse --abbrev-ref HEAD === "main"',
    passed: branchPassed,
    durationMs: Date.now() - branchStart,
    summary: branchPassed
      ? 'Current branch verified as "main".'
      : `Current branch is "${currentBranch}"; deployment requires "main".`,
  });

  const allPassed = checks.every((c) => c.passed);
  return {
    allPassed,
    commitSha,
    branch: currentBranch,
    checks,
  };
}

const DEPLOY_SCRIPT_PATH = path.resolve(__dirname, '../deploy.sh');

export interface LocalDeployExecutionResult {
  executed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  logs: string;
  commitSha: string;
  errorSummary?: string;
}

function sanitizeDeployLogs(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/(ghp_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+)/g, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .trim()
    .slice(0, 32_000);
}

export async function defaultLocalDeployRunner(params: {
  commitSha: string;
  actorEmail: string;
}): Promise<LocalDeployExecutionResult> {
  if (!fs.existsSync(DEPLOY_SCRIPT_PATH)) {
    return {
      executed: false,
      exitCode: 127,
      stdout: '',
      stderr: 'deploy.sh script not found in project root.',
      logs: '[ERROR] deploy.sh script not found in project root.',
      commitSha: params.commitSha,
      errorSummary: 'Local deployment script (deploy.sh) is missing.',
    };
  }

  try {
    fs.chmodSync(DEPLOY_SCRIPT_PATH, 0o755);
  } catch {
    // ignore chmod error if filesystem does not permit mode change
  }

  try {
    const { stdout, stderr } = await execFileAsync('bash', [DEPLOY_SCRIPT_PATH], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        CI: 'true',
        DEPLOY_TRIGGERED_BY: params.actorEmail,
        DEPLOY_COMMIT_SHA: params.commitSha,
      },
    });

    const cleanStdout = sanitizeDeployLogs(stdout);
    const cleanStderr = sanitizeDeployLogs(stderr);
    const combinedLogs = [cleanStdout, cleanStderr].filter(Boolean).join('\n');

    return {
      executed: true,
      exitCode: 0,
      stdout: cleanStdout,
      stderr: cleanStderr,
      logs: combinedLogs || 'Local deployment script completed successfully.',
      commitSha: params.commitSha,
    };
  } catch (err: unknown) {
    const execErr = err as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const cleanStdout = sanitizeDeployLogs(execErr.stdout || '');
    const cleanStderr = sanitizeDeployLogs(
      execErr.stderr || execErr.message || 'deploy.sh execution failed.'
    );
    const combinedLogs = [cleanStdout, cleanStderr].filter(Boolean).join('\n');

    return {
      executed: false,
      exitCode: typeof execErr.code === 'number' ? execErr.code : 1,
      stdout: cleanStdout,
      stderr: cleanStderr,
      logs: combinedLogs || '[ERROR] Local deployment script failed.',
      commitSha: params.commitSha,
      errorSummary: 'Local deploy.sh script exited with an error.',
    };
  }
}

/* ============================================================================
 * ZERO-TRUST SERVER CONTROL CONSOLE (NO SHELL EXECUTION, STEP-UP AUTH)
 * ============================================================================
 *
 * VPS LEAST-PRIVILEGE (NON-ROOT USER) HARDENING GUIDE:
 * ----------------------------------------------------------------------------
 * Never run the Node.js / PM2 process as `root` on a production VPS. To isolate
 * the application and ensure that any child process spawned by `execFile` runs
 * with minimal OS privileges:
 *
 * 1. Create a dedicated system user and group with no interactive login shell:
 *      sudo groupadd --system funnelcraft
 *      sudo useradd --system --gid funnelcraft --create-home \
 *        --home-dir /home/funnelcraft --shell /usr/sbin/nologin funnelcraft
 *
 * 2. Grant ownership of the application directory `/var/www/funnelcraft` only:
 *      sudo mkdir -p /var/www/funnelcraft
 *      sudo chown -R funnelcraft:funnelcraft /var/www/funnelcraft
 *      sudo chmod 750 /var/www/funnelcraft
 *      sudo chmod 600 /var/www/funnelcraft/.env
 *
 * 3. Start the PM2 daemon and application under the non-root `funnelcraft` UID/GID:
 *      pm2 start npm --name "funnelcraft-api" \
 *        --cwd /var/www/funnelcraft \
 *        --uid funnelcraft --gid funnelcraft \
 *        -- start
 *      pm2 save
 *
 * 4. Enable the systemd startup unit scoped exclusively to `funnelcraft`:
 *      sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u funnelcraft --hp /home/funnelcraft
 * ============================================================================
 */

export interface AllowedCommandSpec {
  id: string;
  label: string;
  description: string;
  binary: string;
  args: readonly string[];
}

/**
 * Strict, immutable command whitelist.
 * User input NEVER interpolates into a command string or shell.
 * Only keys present on ALLOWED_COMMANDS can be invoked via `execFile(binary, args)`.
 */
export const ALLOWED_COMMANDS: Readonly<Record<string, AllowedCommandSpec>> = Object.freeze({
  PM2_STATUS: {
    id: 'PM2_STATUS',
    label: 'PM2 Process Status (pm2 list)',
    description: 'Displays status, uptime, CPU, and memory for managed PM2 processes.',
    binary: 'pm2',
    args: Object.freeze(['list', '--no-color']),
  },
  GET_PM2_STATUS: {
    id: 'GET_PM2_STATUS',
    label: 'PM2 Process Status (pm2 list)',
    description: 'Displays status, uptime, CPU, and memory for managed PM2 processes.',
    binary: 'pm2',
    args: Object.freeze(['list', '--no-color']),
  },
  PM2_LOGS: {
    id: 'PM2_LOGS',
    label: 'PM2 Recent Logs (last 50 lines, nostream)',
    description: 'Fetches the last 50 log lines from funnelcraft-api without streaming.',
    binary: 'pm2',
    args: Object.freeze(['logs', 'funnelcraft-api', '--lines', '50', '--nostream', '--no-color']),
  },
  DISK_SPACE: {
    id: 'DISK_SPACE',
    label: 'Disk Space & Filesystem Usage (df -h)',
    description: 'Reports human-readable disk usage across mounted filesystems.',
    binary: 'df',
    args: Object.freeze(['-h']),
  },
  GIT_LOG: {
    id: 'GIT_LOG',
    label: 'Recent Git Commits (git log -n 10 --oneline)',
    description: 'Shows the 10 most recent git commits on the current branch.',
    binary: 'git',
    args: Object.freeze(['log', '-n', '10', '--oneline', '--decorate']),
  },
  RESTART_APP: {
    id: 'RESTART_APP',
    label: 'Restart Application (pm2 restart funnelcraft-api)',
    description: 'Gracefully restarts the funnelcraft-api PM2 process with updated env.',
    binary: 'pm2',
    args: Object.freeze(['restart', 'funnelcraft-api', '--update-env']),
  },
});

const STRIPPED_SENSITIVE_ENV_KEYS = new Set([
  'SMTP_PASS',
  'SMTP_USER',
  'JWT_SECRET',
  'GITHUB_DEPLOY_PAT',
  'OWNER_INITIAL_PASSWORD',
  'GOOGLE_MAILER_CLIENT_ID',
  'GOOGLE_MAILER_CLIENT_SECRET',
  'GOOGLE_MAILER_REFRESH_TOKEN',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYPAL_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
]);

const SENSITIVE_ENV_KEY_REGEX =
  /pass|password|secret|token|key|pat|credential|private|cookie|auth|dsn/i;

/**
 * Builds a minimal, secret-stripped environment object for child processes.
 * Explicitly removes `SMTP_PASS`, `JWT_SECRET`, OAuth tokens, and any key matching secret patterns.
 */
export function buildSanitizedChildEnv(): NodeJS.ProcessEnv {
  const safeAllowlist = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM', 'PM2_HOME'];
  const sanitized: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV || 'production',
    CI: 'true',
  };

  for (const key of safeAllowlist) {
    const val = process.env[key];
    if (
      typeof val === 'string' &&
      !STRIPPED_SENSITIVE_ENV_KEYS.has(key) &&
      !SENSITIVE_ENV_KEY_REGEX.test(key)
    ) {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export function resolveRestrictedCommandCwd(): string {
  const configuredDir = (process.env.SANDBOX_COMMAND_CWD || RESTRICTED_VPS_WORKDIR).trim();
  if (fs.existsSync(configuredDir)) {
    return configuredDir;
  }
  return path.resolve(__dirname, '..');
}

interface ServerCommandLockState {
  inProgress: boolean;
  lockedAt: number;
  actorEmail: string;
  commandId: string;
}

function loadServerCommandLockFromDisk(): ServerCommandLockState {
  if (!fs.existsSync(SERVER_COMMAND_LOCK_FILE)) {
    return { inProgress: false, lockedAt: 0, actorEmail: '', commandId: '' };
  }
  try {
    const raw = fs.readFileSync(SERVER_COMMAND_LOCK_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ServerCommandLockState;
    if (parsed && typeof parsed.inProgress === 'boolean') {
      return parsed;
    }
  } catch {
    // ignore corrupt lock file
  }
  return { inProgress: false, lockedAt: 0, actorEmail: '', commandId: '' };
}

let serverCommandLockState: ServerCommandLockState = loadServerCommandLockFromDisk();

function saveServerCommandLockToDisk(): void {
  try {
    const tmp = `${SERVER_COMMAND_LOCK_FILE}.tmp.${process.pid}.${crypto.randomUUID()}`;
    fs.writeFileSync(tmp, JSON.stringify(serverCommandLockState, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    fs.renameSync(tmp, SERVER_COMMAND_LOCK_FILE);
  } catch {
    // ignore write error
  }
}

export function isServerCommandLocked(): boolean {
  const diskState = loadServerCommandLockFromDisk();
  if (diskState.inProgress) {
    if (Date.now() - diskState.lockedAt > SERVER_COMMAND_LOCK_STALE_MS) {
      serverCommandLockState = { inProgress: false, lockedAt: 0, actorEmail: '', commandId: '' };
      saveServerCommandLockToDisk();
      return false;
    }
    return true;
  }
  if (serverCommandLockState.inProgress) {
    if (Date.now() - serverCommandLockState.lockedAt > SERVER_COMMAND_LOCK_STALE_MS) {
      serverCommandLockState = { inProgress: false, lockedAt: 0, actorEmail: '', commandId: '' };
      saveServerCommandLockToDisk();
      return false;
    }
    return true;
  }
  return false;
}

function acquireServerCommandLock(actorEmail: string, commandId: string): boolean {
  if (isServerCommandLocked()) {
    return false;
  }
  serverCommandLockState = {
    inProgress: true,
    lockedAt: Date.now(),
    actorEmail,
    commandId,
  };
  saveServerCommandLockToDisk();
  return true;
}

function releaseServerCommandLock(): void {
  serverCommandLockState = {
    inProgress: false,
    lockedAt: 0,
    actorEmail: '',
    commandId: '',
  };
  saveServerCommandLockToDisk();
}

// Strict rate limiter: Max 3 commands per minute
const serverCommandTimestamps: number[] = [];

export function checkServerCommandRateLimit(): {
  allowed: boolean;
  retryAfterSeconds?: number;
  remainingInWindow: number;
} {
  const now = Date.now();
  while (
    serverCommandTimestamps.length > 0 &&
    now - serverCommandTimestamps[0] >= SERVER_COMMAND_RATE_WINDOW_MS
  ) {
    serverCommandTimestamps.shift();
  }

  if (serverCommandTimestamps.length >= MAX_SERVER_COMMANDS_PER_MINUTE) {
    const oldest = serverCommandTimestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + SERVER_COMMAND_RATE_WINDOW_MS - now) / 1000)
    );
    return {
      allowed: false,
      retryAfterSeconds,
      remainingInWindow: 0,
    };
  }

  serverCommandTimestamps.push(now);
  return {
    allowed: true,
    remainingInWindow: Math.max(0, MAX_SERVER_COMMANDS_PER_MINUTE - serverCommandTimestamps.length),
  };
}

export function resetServerCommandStateForTest(): void {
  serverCommandTimestamps.length = 0;
  releaseServerCommandLock();
}

export interface ServerCommandExecutionResult {
  executed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timedOut?: boolean;
}

export async function defaultServerCommandRunner(
  spec: AllowedCommandSpec
): Promise<ServerCommandExecutionResult> {
  const start = Date.now();
  const restrictedCwd = resolveRestrictedCommandCwd();
  const sanitizedEnv = buildSanitizedChildEnv();

  try {
    const { stdout, stderr } = await execFileAsync(spec.binary, [...spec.args], {
      cwd: restrictedCwd,
      timeout: SERVER_COMMAND_TIMEOUT_MS,
      maxBuffer: SERVER_COMMAND_MAX_BUFFER_BYTES,
      killSignal: 'SIGKILL',
      windowsHide: true,
      shell: false,
      env: sanitizedEnv,
    });

    return {
      executed: true,
      exitCode: 0,
      stdout: sanitizeDeployLogs(stdout || ''),
      stderr: sanitizeDeployLogs(stderr || ''),
      executionTimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const execErr = err as {
      code?: number | string;
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const duration = Date.now() - start;
    const timedOut =
      Boolean(execErr.killed) ||
      execErr.signal === 'SIGKILL' ||
      duration >= SERVER_COMMAND_TIMEOUT_MS;
    const exitCode =
      typeof execErr.code === 'number' ? execErr.code : timedOut ? 124 : 1;

    return {
      executed: false,
      exitCode,
      stdout: sanitizeDeployLogs(execErr.stdout || ''),
      stderr: sanitizeDeployLogs(
        timedOut
          ? `[TIMEOUT] Command exceeded the hard 10-second execution limit and was terminated (SIGKILL).\n${
              execErr.stderr || ''
            }`
          : execErr.stderr || execErr.message || 'Command execution failed.'
      ),
      executionTimeMs: duration,
      timedOut,
    };
  }
}

/* ---------------- DEPENDENCY OVERRIDES FOR AUTOMATED TESTING ---------------- */

interface SandboxDependencies {
  runPreDeployChecks: () => Promise<PreDeploySuiteResult>;
  executeLocalDeploy: (params: {
    commitSha: string;
    actorEmail: string;
  }) => Promise<LocalDeployExecutionResult>;
  executeServerCommand: (spec: AllowedCommandSpec) => Promise<ServerCommandExecutionResult>;
  sendCommandAlertEmail: (subject: string, htmlContent: string) => Promise<boolean>;
  triggerGitHubDeploy?: (params: {
    commitSha: string;
    actorEmail: string;
  }) => Promise<{
    dispatched: boolean;
    status: number;
    actionsUrl?: string;
    workflowId?: string;
    commitSha: string;
    errorSummary?: string;
    logs?: string;
    stdout?: string;
    stderr?: string;
  }>;
  sendRecoveryEmail: (to: string, resetUrl: string, ip: string) => Promise<boolean>;
  simulateInternalError: boolean;
}

const activeDependencies: SandboxDependencies = {
  runPreDeployChecks: defaultPreDeployChecksRunner,
  executeLocalDeploy: defaultLocalDeployRunner,
  executeServerCommand: defaultServerCommandRunner,
  sendCommandAlertEmail: sendAdminNotificationEmail,
  triggerGitHubDeploy: undefined,
  sendRecoveryEmail: sendSandboxResetEmail,
  simulateInternalError: false,
};

export function setSandboxDependenciesForTest(overrides: Partial<SandboxDependencies>): void {
  Object.assign(activeDependencies, overrides);
}

export function resetSandboxDependencies(): void {
  activeDependencies.runPreDeployChecks = defaultPreDeployChecksRunner;
  activeDependencies.executeLocalDeploy = defaultLocalDeployRunner;
  activeDependencies.executeServerCommand = defaultServerCommandRunner;
  activeDependencies.sendCommandAlertEmail = sendAdminNotificationEmail;
  activeDependencies.triggerGitHubDeploy = undefined;
  activeDependencies.sendRecoveryEmail = sendSandboxResetEmail;
  activeDependencies.simulateInternalError = false;
}

/* ---------------- HIGH-PRECISION CONSTANT-TIME EXECUTION PAD (DEFECT 3) ---------------- */

/**
 * Pads execution to a precise target duration in milliseconds using process.hrtime.bigint().
 * Uses a coarse timer up to (targetDurationMs - 4ms) followed by a sub-millisecond spin-wait
 * so branch execution times converge with < 1ms median variance.
 */
export async function enforceMinimumDuration(
  startNs: bigint,
  minDurationMs: number
): Promise<void> {
  const targetNs = startNs + BigInt(Math.round(minDurationMs * 1_000_000));
  const nowNs = process.hrtime.bigint();
  if (nowNs >= targetNs) {
    return;
  }

  const remainingMs = Number(targetNs - nowNs) / 1_000_000;
  if (remainingMs > 4) {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(remainingMs - 3)));
  }

  while (process.hrtime.bigint() < targetNs) {
    // Sub-millisecond precision alignment loop
  }
}

/* ---------------- OWNER BOOTSTRAP HELPER (DEFECT 6) ---------------- */

export function initializeOwnerBootstrapWithAudit(ip = '127.0.0.1'): {
  user: StoredUser | null;
  bootstrapped: boolean;
  warningLogged: boolean;
} {
  const result = bootstrapOwnerFromEnv();
  if (result.bootstrapped && result.user) {
    recordAuditLog({
      actorEmail: result.user.email,
      ip,
      userAgent: 'system-bootstrap',
      action: 'owner_password_bootstrapped',
      result: 'success',
      metadata: {
        mustChangeOnFirstLogin: true,
      },
    });
  }
  return result;
}

/* ---------------- EXPRESS SECURITY HEADERS & ROUTER ---------------- */

export const sandboxSecurityHeaders = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
    noSniff: true,
  }),
  (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  },
];

/**
 * Server-side route guard for GET /sandbox.
 * Redirects unauthenticated or non-owner requests to /sandbox/login with 302 Found and zero content leaked.
 */
export function sandboxPageServerGuard(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const active = getActiveSandboxSession(req);
  if (!active || !isStrictOwnerUser(active.user)) {
    return res.redirect(302, '/sandbox/login');
  }
  return next();
}

function asyncHandler(
  fn: (req: SandboxAuthRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: SandboxAuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createSandboxRouter(): Router {
  const router = express.Router();

  // Apply strict security headers to all /api/sandbox/* routes
  router.use(...sandboxSecurityHeaders);

  // 1. GET /api/sandbox/csrf — Issue CSRF token bound to active sandbox_sid
  router.get('/csrf', (req: Request, res: Response) => {
    const csrfToken = issueCsrfToken(req, res);
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'CSRF_ISSUED',
      message: 'CSRF token issued.',
      csrfToken,
    });
  });

  // Enforce CSRF token validation on all mutating (POST/PUT/PATCH/DELETE) requests
  router.use(requireCsrf);

  // 2. POST /api/sandbox/auth/login — Constant-time Owner-only login with rate limit, lockout & bootstrap detection
  router.post(
    '/auth/login',
    asyncHandler(async (req: Request, res: Response) => {
      const startNs = process.hrtime.bigint();
      const ip = getRequestIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        await enforceMinimumDuration(startNs, 90);
        return sendUnifiedResponse(res, 400, {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Invalid login request payload.',
        });
      }

      const { email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      const gate = checkLoginAllowed(ip, normalizedEmail);
      if (!gate.allowed) {
        recordAuditLog({
          actorEmail: normalizedEmail,
          ip,
          userAgent,
          action: gate.reason === 'locked' ? 'account_lockout' : 'login_failure',
          result: 'blocked',
          metadata: {
            reason: gate.reason,
            retryAfterSeconds: gate.retryAfterSeconds,
          },
        });
        await enforceMinimumDuration(startNs, 90);
        return sendUnifiedResponse(res, 429, {
          ok: false,
          code: gate.reason === 'locked' ? 'ACCOUNT_LOCKED' : 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
          retryAfterSeconds: gate.retryAfterSeconds,
        });
      }

      // If no owner record exists yet and OWNER_INITIAL_PASSWORD is set, bootstrap once
      if (
        normalizedEmail === (process.env.OWNER_EMAIL || '').trim().toLowerCase() &&
        !findUserByEmail(normalizedEmail) &&
        (process.env.OWNER_INITIAL_PASSWORD || '').trim()
      ) {
        initializeOwnerBootstrapWithAudit(ip);
      }

      const candidateUser = findUserByEmail(normalizedEmail);
      const passwordMatches = timingSafeVerifyPassword(candidateUser, password);
      const isOwner = isStrictOwnerUser(candidateUser);

      if (!passwordMatches || !isOwner || !candidateUser) {
        const failureState = recordLoginFailure(ip, normalizedEmail, userAgent);
        recordAuditLog({
          actorEmail: normalizedEmail,
          ip,
          userAgent,
          action: 'login_failure',
          result: 'failure',
          metadata: {
            lockedOut: failureState.lockedOut,
            rateLimited: failureState.rateLimited,
          },
        });
        await enforceMinimumDuration(startNs, 90);
        return sendUnifiedResponse(res, 401, {
          ok: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        });
      }

      // Defect 6: On first successful login with OWNER_INITIAL_PASSWORD, enforce mustChangePassword: true
      const envInitialPass = (process.env.OWNER_INITIAL_PASSWORD || '').trim();
      if (
        candidateUser.initialPasswordBootstrapped ||
        (envInitialPass && password === envInitialPass)
      ) {
        setOwnerMustChangePassword(candidateUser.id, true);
        candidateUser.mustChangePassword = true;
        recordAuditLog({
          actorEmail: candidateUser.email,
          ip,
          userAgent,
          action: 'owner_password_bootstrapped',
          result: 'success',
          metadata: {
            mustChangePassword: true,
          },
        });
      }

      resetLoginFailures(ip, normalizedEmail);
      const { rawToken, session } = createSandboxSession(candidateUser, ip, userAgent, res);

      // Bind the CSRF token used for login to the newly issued sandbox_sid
      const usedCsrf =
        typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'].trim() : '';
      if (usedCsrf) {
        bindCsrfTokenToSession(usedCsrf, rawToken);
      }

      recordAuditLog({
        actorEmail: candidateUser.email,
        ip,
        userAgent,
        action: 'login_success',
        result: 'success',
        metadata: {
          sessionExpiresAt: new Date(session.expiresAt).toISOString(),
          mustChangePassword: Boolean(candidateUser.mustChangePassword),
        },
      });

      await enforceMinimumDuration(startNs, 90);
      return sendUnifiedResponse(res, 200, {
        ok: true,
        code: 'AUTH_SUCCESS',
        message: 'Owner sandbox session established.',
        sessionToken: rawToken,
        expiresAt: session.expiresAt,
        lastVerifiedAt: session.lastVerifiedAt,
        mustChangePassword: Boolean(candidateUser.mustChangePassword),
        owner: {
          email: candidateUser.email,
          fullName: candidateUser.full_name,
          role: candidateUser.role,
        },
      });
    })
  );

  // 3. POST /api/sandbox/auth/logout — Destroy sandbox session
  router.post('/auth/logout', requireOwner, (req: SandboxAuthRequest, res: Response) => {
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    if (req.sandboxRawToken) {
      deleteSandboxSessionByRawToken(req.sandboxRawToken);
    }
    res.append(
      'Set-Cookie',
      'sandbox_sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    );
    recordAuditLog({
      actorEmail: req.sandboxUser?.email || 'owner',
      ip,
      userAgent,
      action: 'logout',
      result: 'success',
    });
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'LOGGED_OUT',
      message: 'Sandbox session terminated.',
    });
  });

  // 4. POST /api/sandbox/auth/change-password — Clear mustChangePassword flag after OWNER_INITIAL_PASSWORD login (Defect 6)
  router.post('/auth/change-password', requireOwner, (req: SandboxAuthRequest, res: Response) => {
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success || !req.sandboxUser) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Valid currentPassword and newPassword (min 8 chars) are required.',
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'New password must differ from the current password.',
      });
    }

    const validCurrent = timingSafeVerifyPassword(req.sandboxUser, currentPassword);
    if (!validCurrent) {
      return sendUnifiedResponse(res, 401, {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Current password verification failed.',
      });
    }

    const { hash, salt } = hashPasswordWithSalt(newPassword);
    updateUserPassword(req.sandboxUser.email, hash, salt);
    setOwnerMustChangePassword(req.sandboxUser.id, false);
    req.sandboxUser.mustChangePassword = false;

    recordAuditLog({
      actorEmail: req.sandboxUser.email,
      ip,
      userAgent,
      action: 'owner_password_changed',
      result: 'success',
      metadata: {
        clearedMustChangePassword: true,
      },
    });

    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'PASSWORD_CHANGED',
      message: 'Owner password updated and bootstrap restriction cleared.',
    });
  });

  // 5. POST /api/sandbox/auth/reverify — Re-verify owner password to extend 30m session
  router.post('/auth/reverify', requireOwner, (req: SandboxAuthRequest, res: Response) => {
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const parsed = reverifySchema.safeParse(req.body);
    if (!parsed.success || !req.sandboxUser || !req.sandboxSession) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Password is required for session re-verification.',
      });
    }

    const valid = timingSafeVerifyPassword(req.sandboxUser, parsed.data.password);
    if (!valid) {
      recordAuditLog({
        actorEmail: req.sandboxUser.email,
        ip,
        userAgent,
        action: 'reverify_failure',
        result: 'failure',
      });
      return sendUnifiedResponse(res, 401, {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Password verification failed.',
      });
    }

    const now = Date.now();
    req.sandboxSession.lastVerifiedAt = now;
    req.sandboxSession.expiresAt = now + SANDBOX_SESSION_TTL_MS;
    sandboxSessions.set(req.sandboxSession.sessionIdHash, req.sandboxSession);
    saveSandboxSessionsToDisk();

    recordAuditLog({
      actorEmail: req.sandboxUser.email,
      ip,
      userAgent,
      action: 'reverify_success',
      result: 'success',
      metadata: {
        expiresAt: new Date(req.sandboxSession.expiresAt).toISOString(),
      },
    });

    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'SESSION_REVERIFIED',
      message: 'Sandbox session re-verified for 30 minutes.',
      expiresAt: req.sandboxSession.expiresAt,
      lastVerifiedAt: req.sandboxSession.lastVerifiedAt,
    });
  });

  // 5b. POST /api/sandbox/auth/test-email — Trigger a diagnostic SMTP test email to the Owner (requires requireCsrf + requireOwner)
  router.post(
    '/auth/test-email',
    requireOwner,
    asyncHandler(async (req: SandboxAuthRequest, res: Response) => {
      const ip = getRequestIp(req);
      const ownerEmail =
        req.sandboxUser?.email || (process.env.OWNER_EMAIL || '').trim().toLowerCase();

      const result = await sendSandboxTestEmail(ownerEmail, ip);

      if (!result.ok) {
        return sendUnifiedResponse(res, 502, {
          ok: false,
          code: 'SMTP_TEST_FAILED',
          message: result.error || 'SMTP test email failed to send.',
          error: result.error,
          smtpHost: result.smtpHost,
          smtpPort: result.smtpPort,
          smtpUser: result.smtpUser,
          recipient: ownerEmail,
        });
      }

      return sendUnifiedResponse(res, 200, {
        ok: true,
        code: 'SMTP_TEST_SENT',
        message: `Test email sent successfully to ${ownerEmail} (Message ID: ${result.messageId}).`,
        messageId: result.messageId,
        smtpHost: result.smtpHost,
        smtpPort: result.smtpPort,
        smtpUser: result.smtpUser,
        recipient: ownerEmail,
      });
    })
  );

  // 6. POST /api/sandbox/recovery/request — Owner-only password recovery with awaited SMTP delivery & error logging
  router.post(
    '/recovery/request',
    asyncHandler(async (req: Request, res: Response) => {
      const startNs = process.hrtime.bigint();
      const jitterRange = Number(process.env.SANDBOX_RECOVERY_JITTER_MS || 0);
      const targetPadMs =
        RECOVERY_FIXED_PAD_MS + (jitterRange > 0 ? crypto.randomInt(0, jitterRange) : 0);

      const ip = getRequestIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';

      const parsed = recoveryRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        await enforceMinimumDuration(startNs, targetPadMs);
        return sendUnifiedResponse(res, 400, {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'A valid email address is required.',
        });
      }

      const requestedEmail = parsed.data.email.toLowerCase().trim();
      const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
      const user = findUserByEmail(requestedEmail);

      // Perform identical cryptographic work on both branches
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);
      const now = Date.now();

      const isAuthorizedOwner = Boolean(
        configuredOwnerEmail &&
          requestedEmail === configuredOwnerEmail &&
          user &&
          user.role === 'admin'
      );

      let emailDelivered = false;
      if (isAuthorizedOwner && user) {
        for (const [k, existing] of resetTokens.entries()) {
          if (existing.userId === user.id) {
            resetTokens.delete(k);
          }
        }

        const record: SandboxResetTokenRecord = {
          tokenHash,
          userId: user.id,
          email: user.email,
          createdAt: now,
          expiresAt: now + RESET_TOKEN_TTL_MS,
          used: false,
          requestedIp: ip,
        };
        resetTokens.set(tokenHash, record);
        saveResetTokensToDisk();

        const appOrigin =
          process.env.APP_URL ||
          (typeof req.headers.origin === 'string' ? req.headers.origin : 'https://codworth.me');
        const resetUrl = `${appOrigin.replace(/\/$/, '')}/reset?token=${rawToken}`;

        try {
          emailDelivered = await activeDependencies.sendRecoveryEmail(user.email, resetUrl, ip);
          if (!emailDelivered) {
            console.error(
              `[MAILER ERROR] sendRecoveryEmail returned false for owner ${user.email}. Check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.`
            );
          }
        } catch (mailErr) {
          console.error('[MAILER ERROR] Exception while sending recovery email:', mailErr);
        }
      } else {
        // Perform identical disk write work on non-owner branch so I/O latency is symmetrical
        saveResetTokensToDisk();
      }

      recordAuditLog({
        actorEmail: requestedEmail,
        ip,
        userAgent,
        action: 'recovery_request',
        result: 'success',
        metadata: {
          dispatchedToOwner: isAuthorizedOwner,
          emailDelivered,
        },
      });

      await enforceMinimumDuration(startNs, targetPadMs);
      return sendUnifiedResponse(res, 200, {
        ok: true,
        code: 'RECOVERY_ACCEPTED',
        message: 'If the email is authorized, a recovery link has been sent.',
      });
    })
  );

  // 7. GET /api/sandbox/recovery/verify — Verify recovery token server-side before rendering /reset form
  router.get('/recovery/verify', (req: Request, res: Response) => {
    const parsed = recoveryVerifyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Recovery token is invalid or expired.',
      });
    }

    const record = verifySandboxResetToken(parsed.data.token);
    if (!record) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Recovery token is invalid or expired.',
      });
    }

    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'TOKEN_VALID',
      message: 'Recovery token verified.',
      expiresAt: record.expiresAt,
    });
  });

  // 8. POST /api/sandbox/recovery/reset — Single-use password reset & global session invalidation
  router.post('/recovery/reset', (req: Request, res: Response) => {
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const parsed = recoveryResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid reset token or password format.',
      });
    }

    const { token, newPassword } = parsed.data;
    const record = verifySandboxResetToken(token);
    if (!record) {
      recordAuditLog({
        actorEmail: 'unknown',
        ip,
        userAgent,
        action: 'recovery_verify_failure',
        result: 'failure',
        metadata: { reason: 'invalid_expired_or_used_token' },
      });
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Recovery token is invalid, expired, or has already been used.',
      });
    }

    const ownerUser = findUserById(record.userId);
    if (!ownerUser || !isStrictOwnerUser(ownerUser)) {
      resetTokens.delete(record.tokenHash);
      saveResetTokensToDisk();
      return sendUnifiedResponse(res, 403, {
        ok: false,
        code: 'FORBIDDEN_NOT_OWNER',
        message: 'Recovery is restricted to the platform owner.',
      });
    }

    record.used = true;
    resetTokens.delete(record.tokenHash);
    saveResetTokensToDisk();

    const { hash, salt } = hashPasswordWithSalt(newPassword);
    updateUserPassword(ownerUser.email, hash, salt);

    invalidateAllSandboxSessions();
    invalidateAllUserSessions(ownerUser.id);
    resetLoginFailures(ip, ownerUser.email);

    res.append(
      'Set-Cookie',
      'sandbox_sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    );

    recordAuditLog({
      actorEmail: ownerUser.email,
      ip,
      userAgent,
      action: 'password_change',
      result: 'success',
      metadata: {
        sessionsInvalidated: true,
      },
    });

    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'PASSWORD_UPDATED',
      message: 'Owner password updated and all active sessions have been invalidated.',
    });
  });

  // 9. GET /api/sandbox/status — Owner-only Sandbox status & session metadata
  router.get(
    '/status',
    requireOwner,
    asyncHandler(async (req: SandboxAuthRequest, res: Response) => {
      if (activeDependencies.simulateInternalError) {
        throw new Error(
          'Simulated internal fault at /app/applet/server/db.ts:142 table=users_secret_table uid=user-admin-owner-001'
        );
      }

      const now = Date.now();
      const session = req.sandboxSession!;
      const user = req.sandboxUser!;

      const cooldownRemainingMs = Math.max(
        0,
        deployLockState.lastCompletedDeployAt + DEPLOY_COOLDOWN_MS - now
      );

      return sendUnifiedResponse(res, 200, {
        ok: true,
        code: 'OK',
        message: 'Sandbox status retrieved.',
        owner: {
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          mustChangePassword: Boolean(user.mustChangePassword),
        },
        session: {
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastVerifiedAt: session.lastVerifiedAt,
          remainingSeconds: Math.max(0, Math.floor((session.expiresAt - now) / 1000)),
          requiresReverifySoon: now - session.lastVerifiedAt >= SANDBOX_REVERIFY_WINDOW_MS,
        },
        deployment: {
          inProgress: isDeployCurrentlyInProgress(),
          cooldownRemainingSeconds: Math.ceil(cooldownRemainingMs / 1000),
          lastDeployAt: deployLockState.lastCompletedDeployAt
            ? new Date(deployLockState.lastCompletedDeployAt).toISOString()
            : null,
        },
        environment: {
          mode: 'sandbox',
          deployScriptConfigured: fs.existsSync(DEPLOY_SCRIPT_PATH),
          ownerEmailConfigured: Boolean(process.env.OWNER_EMAIL),
        },
      });
    })
  );

  // 10. GET /api/sandbox/audit — Owner-only Audit Trail retrieval
  router.get('/audit', requireOwner, (_req: SandboxAuthRequest, res: Response) => {
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'OK',
      message: 'Audit log entries retrieved.',
      entries: getAuditLogs(100),
    });
  });

  // 11. POST /api/sandbox/deploy — Owner-only Local VPS Deploy gate with mandatory server-side checks + deploy.sh execution
  router.post(
    '/deploy',
    requireOwner,
    asyncHandler(async (req: SandboxAuthRequest, res: Response) => {
      const ip = getRequestIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';
      const owner = req.sandboxUser!;

      if (!req.sandboxSession || Date.now() > req.sandboxSession.expiresAt) {
        return sendUnifiedResponse(res, 401, {
          ok: false,
          code: 'SESSION_EXPIRED',
          message: 'Sandbox session expired. Please re-authenticate.',
        });
      }

      if (
        !req.body ||
        typeof req.body !== 'object' ||
        (req.body as Record<string, unknown>).confirm !== 'DEPLOY'
      ) {
        return sendUnifiedResponse(res, 400, {
          ok: false,
          code: 'CONFIRMATION_REQUIRED',
          message: 'Exact confirmation literal "DEPLOY" is required.',
        });
      }

      if (isDeployCurrentlyInProgress()) {
        return sendUnifiedResponse(res, 409, {
          ok: false,
          code: 'DEPLOY_IN_PROGRESS',
          message: 'A deployment is already in progress.',
        });
      }

      const now = Date.now();
      if (
        deployLockState.lastCompletedDeployAt > 0 &&
        now - deployLockState.lastCompletedDeployAt < DEPLOY_COOLDOWN_MS
      ) {
        const retryAfterSeconds = Math.ceil(
          (deployLockState.lastCompletedDeployAt + DEPLOY_COOLDOWN_MS - now) / 1000
        );
        return sendUnifiedResponse(res, 429, {
          ok: false,
          code: 'DEPLOY_RATE_LIMITED',
          message: 'Deploy rate limit exceeded (maximum 1 deploy per 5 minutes).',
          retryAfterSeconds,
        });
      }

      deployLockState.inProgress = true;
      deployLockState.lockedAt = now;
      deployLockState.actorEmail = owner.email;
      saveDeployLockToDisk();

      try {
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'deploy_trigger',
          result: 'success',
          metadata: { stage: 'predeploy_checks_started', mode: 'local_vps_script' },
        });

        const suite = await activeDependencies.runPreDeployChecks();

        const precheckLogLines = suite.checks.map(
          (c) =>
            `[CHECK ${c.passed ? 'PASS' : 'FAIL'}] ${c.command} (${c.durationMs}ms)\n  -> ${c.summary}`
        );

        if (!suite.allPassed) {
          const failedChecks = suite.checks.filter((c) => !c.passed).map((c) => c.name);
          recordAuditLog({
            actorEmail: owner.email,
            ip,
            userAgent,
            action: 'check_failure',
            result: 'failure',
            metadata: {
              commitSha: suite.commitSha,
              branch: suite.branch,
              failedChecks,
            },
          });

          return sendUnifiedResponse(res, 422, {
            ok: false,
            code: 'PREDEPLOY_CHECKS_FAILED',
            message: 'Mandatory server-side checks failed. deploy.sh was not executed.',
            commitSha: suite.commitSha,
            branch: suite.branch,
            checks: suite.checks,
            stdout: '',
            stderr: precheckLogLines.join('\n'),
            logs: precheckLogLines.join('\n'),
          });
        }

        // Execute local deploy.sh script (or test override if provided)
        let localResult: LocalDeployExecutionResult;
        if (activeDependencies.triggerGitHubDeploy) {
          const legacyRes = await activeDependencies.triggerGitHubDeploy({
            commitSha: suite.commitSha,
            actorEmail: owner.email,
          });
          localResult = {
            executed: legacyRes.dispatched,
            exitCode: legacyRes.dispatched ? 0 : 1,
            stdout: legacyRes.stdout || 'Local deploy.sh executed.',
            stderr: legacyRes.stderr || legacyRes.errorSummary || '',
            logs:
              legacyRes.logs ||
              [...precheckLogLines, legacyRes.stdout || 'Local deploy.sh executed successfully.']
                .filter(Boolean)
                .join('\n'),
            commitSha: suite.commitSha,
            errorSummary: legacyRes.errorSummary,
          };
        } else {
          localResult = await activeDependencies.executeLocalDeploy({
            commitSha: suite.commitSha,
            actorEmail: owner.email,
          });
        }

        const fullTerminalLogs = [...precheckLogLines, '', localResult.logs]
          .filter((section) => section !== undefined)
          .join('\n')
          .trim();

        if (!localResult.executed) {
          recordAuditLog({
            actorEmail: owner.email,
            ip,
            userAgent,
            action: 'deploy_result',
            result: 'failure',
            metadata: {
              commitSha: suite.commitSha,
              branch: suite.branch,
              exitCode: localResult.exitCode,
              errorSummary: localResult.errorSummary || 'Local deploy.sh execution failed',
            },
          });

          return sendUnifiedResponse(res, 502, {
            ok: false,
            code: 'LOCAL_DEPLOY_FAILED',
            message: localResult.errorSummary || 'Local deploy.sh execution failed.',
            commitSha: suite.commitSha,
            branch: suite.branch,
            checks: suite.checks,
            exitCode: localResult.exitCode,
            stdout: localResult.stdout,
            stderr: localResult.stderr,
            logs: fullTerminalLogs,
          });
        }

        deployLockState.lastCompletedDeployAt = Date.now();
        saveDeployLockToDisk();

        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'deploy_result',
          result: 'success',
          metadata: {
            commitSha: suite.commitSha,
            branch: suite.branch,
            script: 'deploy.sh',
            exitCode: localResult.exitCode,
          },
        });

        return sendUnifiedResponse(res, 200, {
          ok: true,
          code: 'DEPLOY_TRIGGERED',
          message: 'All mandatory checks passed and local VPS deploy.sh executed successfully.',
          commitSha: suite.commitSha,
          branch: suite.branch,
          checks: suite.checks,
          exitCode: localResult.exitCode,
          stdout: localResult.stdout,
          stderr: localResult.stderr,
          logs: fullTerminalLogs,
          triggeredAt: new Date(deployLockState.lastCompletedDeployAt).toISOString(),
        });
      } finally {
        deployLockState.inProgress = false;
        deployLockState.lockedAt = 0;
        deployLockState.actorEmail = '';
        saveDeployLockToDisk();
      }
    })
  );

  // 12. POST /api/sandbox/server/command — Zero-Trust Server Control Console (requires requireCsrf + requireOwner + Step-Up Password + Strict Whitelist)
  router.post(
    '/server/command',
    requireOwner,
    asyncHandler(async (req: SandboxAuthRequest, res: Response) => {
      const requestStart = Date.now();
      const ip = getRequestIp(req);
      const userAgent =
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown';
      const owner = req.sandboxUser!;

      if (!req.sandboxSession || Date.now() > req.sandboxSession.expiresAt) {
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'blocked',
          commandId: 'UNKNOWN',
          executionTimeMs: Date.now() - requestStart,
          exitCode: -1,
          metadata: {
            actorEmail: owner.email,
            commandId: 'UNKNOWN',
            ip,
            userAgent,
            executionTimeMs: Date.now() - requestStart,
            exitCode: -1,
            reason: 'session_expired',
          },
        });
        return sendUnifiedResponse(res, 401, {
          ok: false,
          code: 'SESSION_EXPIRED',
          message: 'Sandbox session expired. Please re-authenticate.',
        });
      }

      // 1. Validate request payload schema ({ commandId, password })
      const parsed = serverCommandSchema.safeParse(req.body);
      if (!parsed.success) {
        const rawCmdId =
          req.body && typeof req.body === 'object' && typeof req.body.commandId === 'string'
            ? req.body.commandId.slice(0, 64)
            : 'INVALID_PAYLOAD';
        const elapsed = Date.now() - requestStart;
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'failure',
          commandId: rawCmdId,
          executionTimeMs: elapsed,
          exitCode: -1,
          metadata: {
            actorEmail: owner.email,
            commandId: rawCmdId,
            ip,
            userAgent,
            executionTimeMs: elapsed,
            exitCode: -1,
            reason: 'validation_error',
          },
        });
        return sendUnifiedResponse(res, 400, {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Both commandId and your current owner password are required.',
        });
      }

      const { commandId, password } = parsed.data;

      // 2. Step-Up Authentication: Verify Owner Password on EVERY execution
      
      const dbUser = findUserByEmail(owner.email);
      const passwordValid = dbUser ? timingSafeVerifyPassword(dbUser, password) : false;

      if (!passwordValid) {
        const elapsed = Date.now() - requestStart;
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'failure',
          commandId,
          executionTimeMs: elapsed,
          exitCode: -1,
          metadata: {
            actorEmail: owner.email,
            commandId,
            ip,
            userAgent,
            executionTimeMs: elapsed,
            exitCode: -1,
            reason: 'step_up_password_invalid',
          },
        });
        return sendUnifiedResponse(res, 401, {
          ok: false,
          code: 'STEP_UP_AUTH_FAILED',
          message: 'Step-up password verification failed. Command execution denied.',
        });
      }

      // 3. Strict Command Whitelisting (No Shell Execution)
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_COMMANDS, commandId)) {
        const elapsed = Date.now() - requestStart;
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'blocked',
          commandId,
          executionTimeMs: elapsed,
          exitCode: 126,
          metadata: {
            actorEmail: owner.email,
            commandId,
            ip,
            userAgent,
            executionTimeMs: elapsed,
            exitCode: 126,
            reason: 'command_not_whitelisted',
          },
        });
        return sendUnifiedResponse(res, 403, {
          ok: false,
          code: 'COMMAND_NOT_ALLOWED',
          message: `Command ID "${commandId}" is not in the strict ALLOWED_COMMANDS whitelist.`,
        });
      }

      // 4. Rate Limiting: Max 3 commands per minute
      const rateGate = checkServerCommandRateLimit();
      if (!rateGate.allowed) {
        const elapsed = Date.now() - requestStart;
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'blocked',
          commandId,
          executionTimeMs: elapsed,
          exitCode: -1,
          metadata: {
            actorEmail: owner.email,
            commandId,
            ip,
            userAgent,
            executionTimeMs: elapsed,
            exitCode: -1,
            reason: 'rate_limit_exceeded',
            retryAfterSeconds: rateGate.retryAfterSeconds,
          },
        });
        return sendUnifiedResponse(res, 429, {
          ok: false,
          code: 'COMMAND_RATE_LIMITED',
          message: `Rate limit exceeded (max 3 commands per minute). Retry in ${rateGate.retryAfterSeconds}s.`,
          retryAfterSeconds: rateGate.retryAfterSeconds,
        });
      }

      // 5. Distributed Lock: Prevent concurrent command execution
      if (!acquireServerCommandLock(owner.email, commandId)) {
        const elapsed = Date.now() - requestStart;
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: 'blocked',
          commandId,
          executionTimeMs: elapsed,
          exitCode: -1,
          metadata: {
            actorEmail: owner.email,
            commandId,
            ip,
            userAgent,
            executionTimeMs: elapsed,
            exitCode: -1,
            reason: 'concurrent_lock_active',
          },
        });
        return sendUnifiedResponse(res, 409, {
          ok: false,
          code: 'COMMAND_LOCKED',
          message: 'Another server command is currently executing. Please wait.',
        });
      }

      const commandSpec = ALLOWED_COMMANDS[commandId];

      try {
        // 6. Execute command via execFile (10s timeout, 1MB maxBuffer, restricted CWD, stripped env)
        const execResult = await activeDependencies.executeServerCommand(commandSpec);

        // 7. Record Immutable Audit Trail in sandbox_audit.json
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'server_command',
          result: execResult.executed ? 'success' : 'failure',
          commandId,
          executionTimeMs: execResult.executionTimeMs,
          exitCode: execResult.exitCode,
          metadata: {
            actorEmail: owner.email,
            commandId,
            commandLabel: commandSpec.label,
            ip,
            userAgent,
            executionTimeMs: execResult.executionTimeMs,
            exitCode: execResult.exitCode,
            timedOut: Boolean(execResult.timedOut),
          },
        });

        // 8. Instant Email Alert to Owner after ANY command is executed successfully
        if (execResult.executed) {
          try {
            await activeDependencies.sendCommandAlertEmail(
              `[Security Alert] Server Command Executed: ${commandId}`,
              `
              <div style="text-align:left;direction:ltr;font-family:monospace;background:#020617;padding:16px;border-radius:10px;border:1px solid #1e293b;color:#e2e8f0;">
                <p style="margin:0 0 10px 0;color:#10b981;font-weight:bold;">
                  ⚡ Sandbox Server Control Console — Command Executed
                </p>
                <p style="margin:4px 0;"><strong>Command ID:</strong> ${commandId} (${commandSpec.label})</p>
                <p style="margin:4px 0;"><strong>Actor Email:</strong> ${owner.email}</p>
                <p style="margin:4px 0;"><strong>IP Address:</strong> ${ip}</p>
                <p style="margin:4px 0;"><strong>User-Agent:</strong> ${redactSensitiveStringValue(userAgent)}</p>
                <p style="margin:4px 0;"><strong>Execution Time:</strong> ${execResult.executionTimeMs}ms</p>
                <p style="margin:4px 0;"><strong>Exit Code:</strong> ${execResult.exitCode}</p>
                <p style="margin:4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              </div>
              `.trim()
            );
          } catch (alertErr) {
            console.error('[MAILER ERROR] Failed to send server command alert email:', alertErr);
          }
        }

        if (!execResult.executed) {
          return sendUnifiedResponse(res, 502, {
            ok: false,
            code: execResult.timedOut ? 'COMMAND_TIMEOUT' : 'COMMAND_EXECUTION_FAILED',
            message: execResult.timedOut
              ? `Command "${commandId}" timed out after 10 seconds and was terminated.`
              : `Command "${commandId}" exited with code ${execResult.exitCode}.`,
            commandId,
            commandLabel: commandSpec.label,
            exitCode: execResult.exitCode,
            executionTimeMs: execResult.executionTimeMs,
            stdout: execResult.stdout,
            stderr: execResult.stderr,
          });
        }

        return sendUnifiedResponse(res, 200, {
          ok: true,
          code: 'COMMAND_EXECUTED',
          message: `Command "${commandId}" executed successfully in ${execResult.executionTimeMs}ms.`,
          commandId,
          commandLabel: commandSpec.label,
          exitCode: execResult.exitCode,
          executionTimeMs: execResult.executionTimeMs,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          remainingCommandsInMinute: rateGate.remainingInWindow,
        });
      } finally {
        releaseServerCommandLock();
      }
    })
  );

  // Global Error Handler under /api/sandbox/* — Never leaks stack traces, paths, or internal identifiers (Defect 10)
  router.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    return sendUnifiedResponse(res, 500, {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    });
  });

  return router;
}

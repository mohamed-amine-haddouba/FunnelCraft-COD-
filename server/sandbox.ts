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
  StoredUser,
} from './db';
import { sendSandboxResetEmail } from './mailer';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const AUDIT_LOG_FILE = path.resolve(DATA_DIR, 'sandbox_audit.json');
const SANDBOX_SESSIONS_FILE = path.resolve(DATA_DIR, 'sandbox_sessions.json');
const SANDBOX_RESET_TOKENS_FILE = path.resolve(DATA_DIR, 'sandbox_reset_tokens.json');
const DEPLOY_LOCK_FILE = path.resolve(DATA_DIR, 'sandbox_deploy_lock.json');

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

/* ---------------- TYPES ---------------- */

export type AuditAction =
  | 'login_success'
  | 'login_failure'
  | 'account_lockout'
  | 'recovery_request'
  | 'recovery_verify_failure'
  | 'password_change'
  | 'reverify_success'
  | 'reverify_failure'
  | 'deploy_trigger'
  | 'check_failure'
  | 'deploy_result'
  | 'logout';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  ip: string;
  userAgent: string;
  action: AuditAction;
  result: 'success' | 'failure' | 'blocked';
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

/* ---------------- SECRET REDACTION & UNIFIED RESPONSE ---------------- */

const SENSITIVE_KEY_PATTERN = /password|secret|token|pat|authorization|cookie|key|credential|hash|salt/i;

export function redactSecrets(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const output: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      output[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      output[k] = redactSecrets(v);
    } else if (typeof v === 'string') {
      output[k] = v.slice(0, 300);
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

/* ---------------- AUDIT TRAIL PERSISTENCE ---------------- */

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAuditLogsFromDisk(): AuditLogEntry[] {
  ensureDataDir();
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

function saveAuditLogsToDisk(): void {
  try {
    ensureDataDir();
    if (auditLogs.length > 2000) {
      auditLogs = auditLogs.slice(-2000);
    }
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(auditLogs, null, 2), 'utf-8');
  } catch {
    // Fail silently on disk error without leaking paths
  }
}

export function recordAuditLog(params: {
  actorEmail: string;
  ip: string;
  userAgent?: string;
  action: AuditAction;
  result: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorEmail: (params.actorEmail || 'anonymous').toLowerCase().trim(),
    ip: params.ip || '0.0.0.0',
    userAgent: (params.userAgent || 'unknown').slice(0, 250),
    action: params.action,
    result: params.result,
    metadata: redactSecrets(params.metadata || {}),
  };
  auditLogs.push(entry);
  saveAuditLogsToDisk();
  return entry;
}

export function getAuditLogs(limit = 100): AuditLogEntry[] {
  return auditLogs.slice(-limit).reverse();
}

export function clearAuditLogsForTest(): void {
  auditLogs = [];
  saveAuditLogsToDisk();
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

/* ---------------- CSRF PROTECTION ---------------- */

const csrfTokens = new Map<string, number>(); // tokenHash -> expiresAt

export function issueCsrfToken(res: Response): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = Date.now() + SANDBOX_SESSION_TTL_MS;
  csrfTokens.set(tokenHash, expiresAt);

  // Clean up expired CSRF tokens
  const now = Date.now();
  for (const [hash, exp] of csrfTokens.entries()) {
    if (now > exp) csrfTokens.delete(hash);
  }

  res.append(
    'Set-Cookie',
    `sandbox_csrf=${rawToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`
  );
  return rawToken;
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
  const expiresAt = csrfTokens.get(tokenHash);
  if (!expiresAt || Date.now() > expiresAt) {
    csrfTokens.delete(tokenHash);
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'Invalid or expired CSRF token.',
    });
  }

  // If the browser also sent the sandbox_csrf cookie, enforce exact timing-safe match
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sandbox_csrf && !timingSafeHexEqual(cookies.sandbox_csrf, headerToken)) {
    return sendUnifiedResponse(res, 403, {
      ok: false,
      code: 'CSRF_INVALID',
      message: 'CSRF token mismatch.',
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
  ensureDataDir();
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
    ensureDataDir();
    const list = Array.from(sandboxSessions.values());
    fs.writeFileSync(SANDBOX_SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
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

export function extractRawSandboxToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sandbox_sid && /^[a-f0-9]{64}$/i.test(cookies.sandbox_sid)) {
    return cookies.sandbox_sid;
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

/* ---------------- OWNER AUTHORIZATION MIDDLEWARE ---------------- */

export interface SandboxAuthRequest extends Request {
  sandboxUser?: StoredUser;
  sandboxSession?: SandboxSession;
  sandboxRawToken?: string;
}

export function isStrictOwnerUser(user: StoredUser | undefined): boolean {
  const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!configuredOwnerEmail || !user) {
    return false;
  }
  return (
    user.role === 'admin' &&
    user.email.trim().toLowerCase() === configuredOwnerEmail
  );
}

/**
 * Server-side middleware enforcing:
 * 1. Valid authenticated session (401 if unauthenticated)
 * 2. Strict owner criteria: role === 'admin' AND email === process.env.OWNER_EMAIL (403 if merchant or non-owner)
 * 3. Session maximum duration: 30 minutes
 */
export function requireOwner(req: SandboxAuthRequest, res: Response, next: NextFunction) {
  const activeSandbox = getActiveSandboxSession(req);

  if (activeSandbox) {
    if (!isStrictOwnerUser(activeSandbox.user)) {
      return sendUnifiedResponse(res, 403, {
        ok: false,
        code: 'FORBIDDEN_NOT_OWNER',
        message: 'Access restricted to the platform owner.',
      });
    }
    req.sandboxUser = activeSandbox.user;
    req.sandboxSession = activeSandbox.session;
    req.sandboxRawToken = activeSandbox.rawToken;
    return next();
  }

  // Check if caller presented a standard platform Bearer token (e.g., a logged-in merchant attempting access)
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
      // Even if platform user is owner, Sandbox requires a dedicated 30-minute Sandbox session
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
  ensureDataDir();
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
    ensureDataDir();
    const list = Array.from(resetTokens.values());
    fs.writeFileSync(SANDBOX_RESET_TOKENS_FILE, JSON.stringify(list, null, 2), 'utf-8');
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
  ensureDataDir();
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
    ensureDataDir();
    fs.writeFileSync(DEPLOY_LOCK_FILE, JSON.stringify(deployLockState, null, 2), 'utf-8');
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

  // 1. TypeScript check: npx tsc --noEmit
  const tscCheck = await runSingleCheck('typecheck', 'npx', ['tsc', '--noEmit'], 'npx tsc --noEmit');
  checks.push(tscCheck);

  // 2. Unit & security tests: npm test
  const testCheck = await runSingleCheck('tests', 'npm', ['test'], 'npm test');
  checks.push(testCheck);

  // 3. Production build: npm run build
  const buildCheck = await runSingleCheck('build', 'npm', ['run', 'build'], 'npm run build');
  checks.push(buildCheck);

  // 4. Current Git branch === 'main'
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

export async function defaultGitHubDispatchRunner(params: {
  commitSha: string;
  actorEmail: string;
}): Promise<GitHubDispatchResult> {
  const pat = (process.env.GITHUB_DEPLOY_PAT || '').trim();
  const repoOwner = (process.env.GITHUB_REPO_OWNER || '').trim();
  const repoName = (process.env.GITHUB_REPO_NAME || 'FunnelCraft-COD').trim();
  const workflowId = (process.env.GITHUB_WORKFLOW_ID || 'deploy-production.yml').trim();
  const actionsUrl =
    repoOwner && repoName
      ? `https://github.com/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/actions`
      : 'https://github.com/actions';

  if (!pat || !repoOwner || !repoName) {
    return {
      dispatched: false,
      status: 503,
      actionsUrl,
      workflowId,
      commitSha: params.commitSha,
      errorSummary: 'GitHub deployment credentials are not configured on the server.',
    };
  }

  const dispatchUrl = `https://api.github.com/repos/${encodeURIComponent(
    repoOwner
  )}/${encodeURIComponent(repoName)}/actions/workflows/${encodeURIComponent(
    workflowId
  )}/dispatches`;

  try {
    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'FunnelCraft-COD-Sandbox-Deployer',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          triggered_by: params.actorEmail,
          commit_sha: params.commitSha,
        },
      }),
    });

    if (response.status === 204 || response.status === 200) {
      return {
        dispatched: true,
        status: response.status,
        actionsUrl,
        workflowId,
        commitSha: params.commitSha,
      };
    }

    return {
      dispatched: false,
      status: response.status,
      actionsUrl,
      workflowId,
      commitSha: params.commitSha,
      errorSummary: `GitHub API returned status ${response.status}.`,
    };
  } catch {
    return {
      dispatched: false,
      status: 502,
      actionsUrl,
      workflowId,
      commitSha: params.commitSha,
      errorSummary: 'Failed to reach GitHub Actions API.',
    };
  }
}

/* ---------------- DEPENDENCY OVERRIDES FOR AUTOMATED TESTING ---------------- */

interface SandboxDependencies {
  runPreDeployChecks: () => Promise<PreDeploySuiteResult>;
  triggerGitHubDeploy: (params: {
    commitSha: string;
    actorEmail: string;
  }) => Promise<GitHubDispatchResult>;
  sendRecoveryEmail: (to: string, resetUrl: string, ip: string) => Promise<boolean>;
}

const activeDependencies: SandboxDependencies = {
  runPreDeployChecks: defaultPreDeployChecksRunner,
  triggerGitHubDeploy: defaultGitHubDispatchRunner,
  sendRecoveryEmail: sendSandboxResetEmail,
};

export function setSandboxDependenciesForTest(overrides: Partial<SandboxDependencies>): void {
  Object.assign(activeDependencies, overrides);
}

export function resetSandboxDependencies(): void {
  activeDependencies.runPreDeployChecks = defaultPreDeployChecksRunner;
  activeDependencies.triggerGitHubDeploy = defaultGitHubDispatchRunner;
  activeDependencies.sendRecoveryEmail = sendSandboxResetEmail;
}

/* ---------------- CONSTANT-TIME EXECUTION PAD ---------------- */

async function enforceMinimumDuration(startTimeMs: number, minDurationMs: number): Promise<void> {
  const elapsed = Date.now() - startTimeMs;
  if (elapsed < minDurationMs) {
    await new Promise((resolve) => setTimeout(resolve, minDurationMs - elapsed));
  }
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

export function createSandboxRouter(): Router {
  const router = express.Router();

  // Apply strict security headers to all /api/sandbox/* routes
  router.use(...sandboxSecurityHeaders);

  // 1. GET /api/sandbox/csrf — Issue CSRF token bound to HttpOnly; Secure; SameSite=Strict cookie
  router.get('/csrf', (_req: Request, res: Response) => {
    const csrfToken = issueCsrfToken(res);
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'CSRF_ISSUED',
      message: 'CSRF token issued.',
      csrfToken,
    });
  });

  // Enforce CSRF token validation on all mutating (POST/PUT/PATCH/DELETE) requests
  router.use(requireCsrf);

  // 2. POST /api/sandbox/auth/login — Constant-time Owner-only login with rate limit & lockout
  router.post('/auth/login', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      await enforceMinimumDuration(startTime, 90);
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid login request payload.',
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit (5 attempts / 15m per IP & per email) and 30m lockout
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
      await enforceMinimumDuration(startTime, 90);
      return sendUnifiedResponse(res, 429, {
        ok: false,
        code: gate.reason === 'locked' ? 'ACCOUNT_LOCKED' : 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    // Always perform constant-time password verification even if email does not exist or is not owner
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
      await enforceMinimumDuration(startTime, 90);
      return sendUnifiedResponse(res, 401, {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // Successful owner login
    resetLoginFailures(ip, normalizedEmail);
    const { rawToken, session } = createSandboxSession(candidateUser, ip, userAgent, res);

    recordAuditLog({
      actorEmail: candidateUser.email,
      ip,
      userAgent,
      action: 'login_success',
      result: 'success',
      metadata: {
        sessionExpiresAt: new Date(session.expiresAt).toISOString(),
      },
    });

    await enforceMinimumDuration(startTime, 90);
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'AUTH_SUCCESS',
      message: 'Owner sandbox session established.',
      sessionToken: rawToken,
      expiresAt: session.expiresAt,
      lastVerifiedAt: session.lastVerifiedAt,
      owner: {
        email: candidateUser.email,
        fullName: candidateUser.full_name,
        role: candidateUser.role,
      },
    });
  });

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

  // 4. POST /api/sandbox/auth/reverify — Re-verify owner password to extend 30m session
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

  // 5. POST /api/sandbox/recovery/request — Constant-time Owner-only password recovery
  router.post('/recovery/request', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const parsed = recoveryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      await enforceMinimumDuration(startTime, 110);
      return sendUnifiedResponse(res, 400, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'A valid email address is required.',
      });
    }

    const requestedEmail = parsed.data.email.toLowerCase().trim();
    const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const user = findUserByEmail(requestedEmail);

    // Always generate 32 random bytes and compute SHA-256 hash so CPU work is identical
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const now = Date.now();

    const isAuthorizedOwner = Boolean(
      configuredOwnerEmail &&
        requestedEmail === configuredOwnerEmail &&
        user &&
        user.role === 'admin'
    );

    if (isAuthorizedOwner && user) {
      // Invalidate any previous unused recovery tokens for the owner
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
        await activeDependencies.sendRecoveryEmail(user.email, resetUrl, ip);
      } catch {
        // Never leak mailer errors
      }
    }

    recordAuditLog({
      actorEmail: requestedEmail,
      ip,
      userAgent,
      action: 'recovery_request',
      result: 'success',
      metadata: {
        dispatchedToOwner: isAuthorizedOwner,
      },
    });

    await enforceMinimumDuration(startTime, 110);
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'RECOVERY_ACCEPTED',
      message: 'If the email is authorized, a recovery link has been sent.',
    });
  });

  // 6. GET /api/sandbox/recovery/verify — Verify recovery token server-side before rendering /reset form
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

  // 7. POST /api/sandbox/recovery/reset — Single-use password reset & global session invalidation
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

    // Immediately mark single-use token as used and remove from store
    record.used = true;
    resetTokens.delete(record.tokenHash);
    saveResetTokensToDisk();

    // Update password only (never email or role)
    const { hash, salt } = hashPasswordWithSalt(newPassword);
    updateUserPassword(ownerUser.email, hash, salt);

    // Invalidate all active Sandbox sessions and platform sessions
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

  // 8. GET /api/sandbox/status — Owner-only Sandbox status & session metadata
  router.get('/status', requireOwner, (req: SandboxAuthRequest, res: Response) => {
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
        githubConfigured: Boolean(
          process.env.GITHUB_DEPLOY_PAT && process.env.GITHUB_REPO_OWNER
        ),
        ownerEmailConfigured: Boolean(process.env.OWNER_EMAIL),
      },
    });
  });

  // 9. GET /api/sandbox/audit — Owner-only Audit Trail retrieval
  router.get('/audit', requireOwner, (_req: SandboxAuthRequest, res: Response) => {
    return sendUnifiedResponse(res, 200, {
      ok: true,
      code: 'OK',
      message: 'Audit log entries retrieved.',
      entries: getAuditLogs(100),
    });
  });

  // 10. POST /api/sandbox/deploy — Owner-only Deploy gate with mandatory server-side checks
  router.post('/deploy', requireOwner, async (req: SandboxAuthRequest, res: Response) => {
    const ip = getRequestIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const owner = req.sandboxUser!;

    // Re-verification check: ensure session has not exceeded 30m TTL
    if (!req.sandboxSession || Date.now() > req.sandboxSession.expiresAt) {
      return sendUnifiedResponse(res, 401, {
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'Sandbox session expired. Please re-authenticate.',
      });
    }

    // Strict confirmation check: body.confirm === "DEPLOY"
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

    // Prevent concurrent deployments (distributed file lock + in-memory flag)
    if (isDeployCurrentlyInProgress()) {
      return sendUnifiedResponse(res, 409, {
        ok: false,
        code: 'DEPLOY_IN_PROGRESS',
        message: 'A deployment is already in progress.',
      });
    }

    // Rate limit: maximum 1 deploy per 5 minutes
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

    // Acquire deployment lock
    deployLockState.inProgress = true;
    deployLockState.lockedAt = now;
    deployLockState.actorEmail = owner.email;
    saveDeployLockToDisk();

    const repoOwner = (process.env.GITHUB_REPO_OWNER || '').trim();
    const repoName = (process.env.GITHUB_REPO_NAME || 'FunnelCraft-COD').trim();
    const fallbackActionsUrl =
      repoOwner && repoName
        ? `https://github.com/${encodeURIComponent(repoOwner)}/${encodeURIComponent(
            repoName
          )}/actions`
        : 'https://github.com/actions';

    try {
      recordAuditLog({
        actorEmail: owner.email,
        ip,
        userAgent,
        action: 'deploy_trigger',
        result: 'success',
        metadata: { stage: 'predeploy_checks_started' },
      });

      // Run mandatory server-side checks BEFORE triggering GitHub
      const suite = await activeDependencies.runPreDeployChecks();

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
          message: 'Mandatory server-side checks failed. Deployment was not triggered.',
          commitSha: suite.commitSha,
          branch: suite.branch,
          checks: suite.checks,
          actionsUrl: fallbackActionsUrl,
        });
      }

      // All checks passed -> Trigger GitHub Actions workflow dispatch
      const dispatchResult = await activeDependencies.triggerGitHubDeploy({
        commitSha: suite.commitSha,
        actorEmail: owner.email,
      });

      if (!dispatchResult.dispatched) {
        recordAuditLog({
          actorEmail: owner.email,
          ip,
          userAgent,
          action: 'deploy_result',
          result: 'failure',
          metadata: {
            commitSha: suite.commitSha,
            branch: suite.branch,
            status: dispatchResult.status,
            errorSummary: dispatchResult.errorSummary || 'GitHub dispatch failed',
          },
        });

        return sendUnifiedResponse(res, 502, {
          ok: false,
          code: 'GITHUB_DISPATCH_FAILED',
          message: dispatchResult.errorSummary || 'Failed to trigger GitHub Actions workflow.',
          commitSha: suite.commitSha,
          branch: suite.branch,
          checks: suite.checks,
          actionsUrl: dispatchResult.actionsUrl,
        });
      }

      // Record successful deployment timestamp for the 5-minute rate limit
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
          workflowId: dispatchResult.workflowId,
        },
      });

      return sendUnifiedResponse(res, 200, {
        ok: true,
        code: 'DEPLOY_TRIGGERED',
        message: 'All mandatory checks passed. GitHub Actions deployment triggered.',
        commitSha: suite.commitSha,
        branch: suite.branch,
        checks: suite.checks,
        actionsUrl: dispatchResult.actionsUrl,
        triggeredAt: new Date(deployLockState.lastCompletedDeployAt).toISOString(),
      });
    } finally {
      deployLockState.inProgress = false;
      deployLockState.lockedAt = 0;
      deployLockState.actorEmail = '';
      saveDeployLockToDisk();
    }
  });

  return router;
}

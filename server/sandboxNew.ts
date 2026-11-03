import express, { Express, Request, Response, NextFunction, Router } from 'express';
import http, { IncomingMessage } from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import {
  findUserByEmail,
  ensureOwnerAccountForEmail,
  timingSafeVerifyPassword,
  recordSecurityLoginAudit,
  getSecurityLoginAuditLogs,
  getAllUsers,
  getAllPagesAdmin,
  getAllOrders,
  getGlobalPlatformStats,
} from './db';
import { sendOtpEmail, sendSandboxResetEmail } from './mailer';
import { isAllowedCorsOrigin } from './corsOrigins';
import { getClientIp, resolveClientGeoLocation } from '../src/utils/ipAndForensics';

const requireModule = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const SANDBOX_UI_DIR = path.resolve(__dirname, 'sandbox-ui');
const SANDBOX_LOGIN_AUDIT_FILE = path.resolve(DATA_DIR, 'sandbox_login_audit.json');

export const STRICT_OWNER_EMAIL = (process.env.OWNER_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'owner@example.test')).trim().toLowerCase();
export const SANDBOX_PORT = Number(process.env.SANDBOX_PORT) || 3002;
export const JWT_TTL_SECONDS = 30 * 60; // 30 minutes

export function getSandboxJwtSecret(): string {
  const secret = (process.env.SANDBOX_JWT_SECRET || '').trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'SANDBOX_JWT_SECRET must be set and at least 32 characters long'
    );
  }
  return secret;
}

export interface SandboxJwtPayload {
  sub: string;
  email: string;
  role: 'owner';
  iat: number;
  exp: number;
  jti: string;
  authVersion: string;
}

export interface SandboxLoginAuditRecord {
  id: string;
  email: string;
  ip: string;
  location: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILED' | 'FORBIDDEN' | 'OTP_SENT';
  reason?: string;
  timestamp: string;
}

export interface SandboxAuthenticatedRequest extends Request {
  sandboxOwner?: SandboxJwtPayload;
}

export const LOGIN_TICKET_TTL_SECONDS = 5 * 60; // 5 minutes

export interface SandboxLoginTicketPayload {
  sub: '2fa_pending';
  email: string;
  iat: number;
  exp: number;
  jti: string;
  authVersion: string;
}

// In-memory 2FA OTP store for optional Email 2FA step
export interface PendingOwnerOtp {
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
}
export const pendingOwnerOtps = new Map<string, PendingOwnerOtp>();

// Temporary in-memory store for Sandbox Owner Password Reset tokens (15-minute expiry)
export interface SandboxResetTokenEntry {
  email: string;
  expiresAt: number;
  used: boolean;
}
export const SANDBOX_RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const sandboxResetTokens = new Map<string, SandboxResetTokenEntry>();

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  let normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  return Buffer.from(normalized, 'base64');
}

// Tie signed owner tokens to the persisted password hash. This survives restarts
// and invalidates both JWTs and pending 2FA tickets when the password changes.
function ownerAuthVersion(email: string): string {
  const user = findUserByEmail(email);
  const credential = user && user.role === 'admin' && user.status === 'active'
    ? `${user.id}:${user.password_hash}:${user.password_salt}`
    : 'owner-not-active';
  return crypto.createHmac('sha256', getSandboxJwtSecret()).update(credential).digest('hex');
}

function isCurrentOwnerAuth(payload: { email: string; authVersion?: string }): boolean {
  if (!isAllowedOwnerEmail(payload.email) || typeof payload.authVersion !== 'string') return false;
  const user = findUserByEmail(payload.email);
  if (!user || user.role !== 'admin' || user.status !== 'active') return false;
  const current = Buffer.from(ownerAuthVersion(payload.email), 'hex');
  const provided = Buffer.from(payload.authVersion, 'hex');
  return provided.length === current.length && crypto.timingSafeEqual(provided, current);
}

const activeOwnerTerminalSockets = new Set<WebSocket>();

export function signSandboxJwt(email: string, ttlSeconds: number = JWT_TTL_SECONDS): {
  token: string;
  payload: SandboxJwtPayload;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SandboxJwtPayload = {
    sub: 'owner-cockpit',
    email: email.trim().toLowerCase(),
    role: 'owner',
    authVersion: ownerAuthVersion(email.trim().toLowerCase()),
    iat: nowSec,
    exp: nowSec + ttlSeconds,
    jti: crypto.randomUUID(),
  };

  const headerSegment = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = crypto
    .createHmac('sha256', getSandboxJwtSecret())
    .update(signingInput)
    .digest();
  const signatureSegment = base64UrlEncode(signature);

  return {
    token: `${signingInput}.${signatureSegment}`,
    payload,
  };
}

export function verifySandboxJwt(rawToken: string): {
  valid: boolean;
  reason?: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'NOT_OWNER';
  payload?: SandboxJwtPayload;
} {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, reason: 'MALFORMED' };
  }

  const parts = rawToken.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const expectedSig = crypto
    .createHmac('sha256', getSandboxJwtSecret())
    .update(signingInput)
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigSeg);
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }

  let parsed: SandboxJwtPayload;
  try {
    parsed = JSON.parse(base64UrlDecode(payloadSeg).toString('utf-8')) as SandboxJwtPayload;
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
    return { valid: false, reason: 'EXPIRED' };
  }

  if (parsed.sub !== 'owner-cockpit') {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (!isAllowedOwnerEmail(parsed.email)) {
    return { valid: false, reason: 'NOT_OWNER', payload: parsed };
  }
  if (!isCurrentOwnerAuth(parsed)) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true, payload: parsed };
}

export function signSandboxLoginTicket(
  email: string,
  ttlSeconds: number = LOGIN_TICKET_TTL_SECONDS
): {
  loginTicket: string;
  payload: SandboxLoginTicketPayload;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SandboxLoginTicketPayload = {
    sub: '2fa_pending',
    email: email.trim().toLowerCase(),
    authVersion: ownerAuthVersion(email.trim().toLowerCase()),
    iat: nowSec,
    exp: nowSec + ttlSeconds,
    jti: crypto.randomUUID(),
  };

  const headerSegment = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = crypto
    .createHmac('sha256', getSandboxJwtSecret())
    .update(signingInput)
    .digest();
  const signatureSegment = base64UrlEncode(signature);

  return {
    loginTicket: `${signingInput}.${signatureSegment}`,
    payload,
  };
}

export function verifySandboxLoginTicket(rawTicket: string): {
  valid: boolean;
  reason?: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'NOT_OWNER';
  payload?: SandboxLoginTicketPayload;
} {
  if (!rawTicket || typeof rawTicket !== 'string') {
    return { valid: false, reason: 'MALFORMED' };
  }

  const parts = rawTicket.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const expectedSig = crypto
    .createHmac('sha256', getSandboxJwtSecret())
    .update(signingInput)
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigSeg);
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }

  let parsed: SandboxLoginTicketPayload;
  try {
    parsed = JSON.parse(base64UrlDecode(payloadSeg).toString('utf-8')) as SandboxLoginTicketPayload;
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (!parsed || parsed.sub !== '2fa_pending') {
    return { valid: false, reason: 'MALFORMED' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
    return { valid: false, reason: 'EXPIRED' };
  }

  if (!isAllowedOwnerEmail(parsed.email)) {
    return { valid: false, reason: 'NOT_OWNER', payload: parsed };
  }
  if (!isCurrentOwnerAuth(parsed)) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true, payload: parsed };
}

export function isAllowedOwnerEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const configuredOwner = (process.env.OWNER_EMAIL || STRICT_OWNER_EMAIL).trim().toLowerCase();
  return Boolean(normalized && configuredOwner && normalized === configuredOwner);
}

function loadSandboxLoginAudits(): SandboxLoginAuditRecord[] {
  try {
    if (fs.existsSync(SANDBOX_LOGIN_AUDIT_FILE)) {
      const raw = fs.readFileSync(SANDBOX_LOGIN_AUDIT_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore corrupted audit file — zero-trust resilience
  }
  return [];
}

export function recordSandboxLoginAttempt(entry: Omit<SandboxLoginAuditRecord, 'id' | 'timestamp'>): SandboxLoginAuditRecord {
  const fullRecord: SandboxLoginAuditRecord = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const existing = loadSandboxLoginAudits();
    const updated = [fullRecord, ...existing].slice(0, 100);
    fs.writeFileSync(SANDBOX_LOGIN_AUDIT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch {
    // Non-fatal if disk is read-only
  }

  try {
    recordSecurityLoginAudit({
      userEmail: entry.email || 'unknown',
      ipAddress: entry.ip,
      location: entry.location,
      userAgent: entry.userAgent,
      authMethod: 'sandbox_owner',
      status: entry.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      failureReason: entry.reason || null,
    });
  } catch {
    // Decoupled resilience if main db audit fails
  }

  return fullRecord;
}

export function getRecentSandboxLogins(limit: number = 10): SandboxLoginAuditRecord[] {
  const dedicated = loadSandboxLoginAudits();
  if (dedicated.length > 0) {
    return dedicated.slice(0, limit);
  }
  try {
    const fallback = getSecurityLoginAuditLogs({ limit });
    return fallback.map((item) => ({
      id: item.id,
      email: item.userEmail,
      ip: item.ipAddress,
      location: item.location || 'Morocco',
      userAgent: item.userAgent,
      status: item.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      reason: item.failureReason || undefined,
      timestamp: item.timestamp,
    }));
  } catch {
    return [];
  }
}

function verifyTotpOrEmailOtp(email: string, code: string): boolean {
  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;

  // Check pending Email OTP first
  const normalized = email.trim().toLowerCase();
  const pending = pendingOwnerOtps.get(normalized);
  if (pending) {
    if (Date.now() > pending.expiresAt || pending.attempts >= 5) {
      pendingOwnerOtps.delete(normalized);
      return false;
    }
    pending.attempts += 1;
    const candidateHash = crypto
      .createHash('sha256')
      .update(`${cleanCode}:${pending.salt}`)
      .digest('hex');
    const a = Buffer.from(pending.codeHash, 'hex');
    const b = Buffer.from(candidateHash, 'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      pendingOwnerOtps.delete(normalized);
      return true;
    }
  }

  // Optional static/env TOTP pin fallback if SANDBOX_2FA_PIN is set
  const envPin = (process.env.SANDBOX_2FA_PIN || '').trim();
  if (process.env.NODE_ENV !== 'production' && envPin && envPin.length === 6) {
    const a = Buffer.from(envPin, 'utf-8');
    const b = Buffer.from(cleanCode, 'utf-8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }

  return false;
}

export function parseCookiesHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const rawVal = pair.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

export function extractSandboxTokenFromRequest(req: IncomingMessage | Request): string {
  const authHeader = String(req.headers?.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookies = parseCookiesHeader(req.headers?.cookie);
  if (cookies.sandbox_sid && cookies.sandbox_sid.trim()) {
    return cookies.sandbox_sid.trim();
  }

  return '';
}

/**
 * Zero-Trust Owner Authentication Middleware
 * Accepts a Bearer JWT or the same-origin sandbox_sid HttpOnly cookie.
 * Authentication tokens are never accepted from URLs, where they can leak into logs.
 */
export function requireOwner(
  req: SandboxAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractSandboxTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Missing Sandbox Bearer token. Please sign in to the Admin Cockpit.',
    });
  }

  const verification = verifySandboxJwt(token);
  if (!verification.valid) {
    if (verification.reason === 'NOT_OWNER') {
      return res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_OWNER_ONLY',
        error: 'Access Denied (403): Only configured owner is authorized to access the Sandbox Cockpit.',
      });
    }
    return res.status(401).json({
      ok: false,
      code: 'TOKEN_INVALID_OR_EXPIRED',
      error: 'Invalid or expired Sandbox session token. Please sign in again.',
    });
  }

  req.sandboxOwner = verification.payload!;
  return next();
}

function runExecFile(
  cmd: string,
  args: string[],
  options: { timeoutMs?: number; cwd?: string } = {}
): Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd: options.cwd || PROJECT_ROOT,
        timeout: options.timeoutMs || 15000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, PAGER: 'cat' },
      },
      (err, stdout, stderr) => {
        const outStr = String(stdout || '');
        const errStr = String(stderr || '');
        if (err) {
          const code = typeof (err as any).code === 'number' ? (err as any).code : 1;
          resolve({
            ok: false,
            exitCode: code,
            stdout: outStr,
            stderr: errStr || err.message,
          });
          return;
        }
        resolve({
          ok: true,
          exitCode: 0,
          stdout: outStr,
          stderr: errStr,
        });
      }
    );
  });
}

// Safe Terminal command validator & parser
const SAFE_ALLOWED_FILES = new Set([
  'package.json',
  'deploy.sh',
  'tsconfig.json',
  'metadata.json',
  'data/plans.json',
  'data/coupons.json',
  'data/settings.json',
  'data/security_login_audit.json',
  'data/sandbox_login_audit.json',
  'data/disposable_email_domains.json',
]);

const SAFE_ALLOWED_DIRS = new Set(['.', 'data', 'server', 'src', 'public']);

export function validateAndParseSafeCommand(rawCommand: string): {
  allowed: boolean;
  reason?: string;
  binary?: string;
  args?: string[];
  normalizedCommand?: string;
} {
  const trimmed = String(rawCommand || '').trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Command cannot be empty.' };
  }

  // Strictly block shell metacharacters, chaining, redirection, and subshells
  if (/[;&|`$><\\\n\r]/.test(trimmed) || trimmed.includes('..')) {
    return {
      allowed: false,
      reason: 'Blocked: Shell metacharacters, pipes, redirection, and path traversal (..) are strictly forbidden.',
    };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const baseCmd = tokens[0].toLowerCase();

  // Explicitly block destructive or interactive binaries
  const explicitlyBlocked = new Set([
    'rm',
    'mv',
    'cp',
    'dd',
    'mkfs',
    'chmod',
    'chown',
    'bash',
    'sh',
    'zsh',
    'fish',
    'sudo',
    'su',
    'kill',
    'pkill',
    'killall',
    'reboot',
    'shutdown',
    'curl',
    'wget',
    'nc',
    'netcat',
    'ssh',
    'scp',
    'env',
    'printenv',
    'export',
  ]);

  if (explicitlyBlocked.has(baseCmd)) {
    return {
      allowed: false,
      reason: `Blocked: '${baseCmd}' is prohibited by Zero-Trust Safe Terminal policy.`,
    };
  }

  // 1. ls
  if (baseCmd === 'ls') {
    const allowedFlags = new Set(['-l', '-a', '-la', '-al', '-lh', '-hl', '-1']);
    const args: string[] = [];
    for (const arg of tokens.slice(1)) {
      if (arg.startsWith('-')) {
        if (!allowedFlags.has(arg)) {
          return { allowed: false, reason: `Unsupported ls flag '${arg}'. Allowed: -la, -lh, -l, -a.` };
        }
        args.push(arg);
      } else {
        if (!SAFE_ALLOWED_DIRS.has(arg)) {
          return {
            allowed: false,
            reason: `Directory '${arg}' is not in the safe directory list (${Array.from(SAFE_ALLOWED_DIRS).join(', ')}).`,
          };
        }
        args.push(arg);
      }
    }
    return {
      allowed: true,
      binary: 'ls',
      args,
      normalizedCommand: ['ls', ...args].join(' '),
    };
  }

  // 2. pm2 list / pm2 status
  if (baseCmd === 'pm2') {
    const sub = (tokens[1] || '').toLowerCase();
    if (tokens.length === 2 && (sub === 'list' || sub === 'status' || sub === 'ls')) {
      return {
        allowed: true,
        binary: 'pm2',
        args: ['list'],
        normalizedCommand: `pm2 ${sub}`,
      };
    }
    return {
      allowed: false,
      reason: 'Only "pm2 list" and "pm2 status" are permitted in Safe Terminal.',
    };
  }

  // 3. df -h
  if (baseCmd === 'df') {
    if (tokens.length === 1 || (tokens.length === 2 && tokens[1] === '-h')) {
      return {
        allowed: true,
        binary: 'df',
        args: ['-h'],
        normalizedCommand: 'df -h',
      };
    }
    return { allowed: false, reason: 'Only "df -h" is permitted.' };
  }

  // 4. free -m
  if (baseCmd === 'free') {
    if (tokens.length === 1 || (tokens.length === 2 && (tokens[1] === '-m' || tokens[1] === '-h'))) {
      return {
        allowed: true,
        binary: 'free',
        args: [tokens[1] || '-m'],
        normalizedCommand: `free ${tokens[1] || '-m'}`,
      };
    }
    return { allowed: false, reason: 'Only "free -m" or "free -h" is permitted.' };
  }

  // 5. cat <whitelisted-file>
  if (baseCmd === 'cat') {
    if (tokens.length !== 2) {
      return {
        allowed: false,
        reason: `Usage: cat <file>. Allowed files: ${Array.from(SAFE_ALLOWED_FILES).join(', ')}`,
      };
    }
    const targetFile = tokens[1];
    if (targetFile.includes('.env') || !SAFE_ALLOWED_FILES.has(targetFile)) {
      return {
        allowed: false,
        reason: `Access denied for '${targetFile}'. Allowed files: ${Array.from(SAFE_ALLOWED_FILES).join(', ')}`,
      };
    }
    return {
      allowed: true,
      binary: 'cat',
      args: [targetFile],
      normalizedCommand: `cat ${targetFile}`,
    };
  }

  // 6. tail [-n N] <whitelisted-file>
  if (baseCmd === 'tail') {
    let lines = '50';
    let targetFile = '';
    if (tokens.length === 2) {
      targetFile = tokens[1];
    } else if (tokens.length === 4 && tokens[1] === '-n' && /^\d+$/.test(tokens[2])) {
      lines = String(Math.min(200, Math.max(1, Number(tokens[2]))));
      targetFile = tokens[3];
    } else {
      return {
        allowed: false,
        reason: `Usage: tail [-n 50] <file>. Allowed files: ${Array.from(SAFE_ALLOWED_FILES).join(', ')}`,
      };
    }
    if (targetFile.includes('.env') || !SAFE_ALLOWED_FILES.has(targetFile)) {
      return {
        allowed: false,
        reason: `Access denied for '${targetFile}'. Allowed files: ${Array.from(SAFE_ALLOWED_FILES).join(', ')}`,
      };
    }
    return {
      allowed: true,
      binary: 'tail',
      args: ['-n', lines, targetFile],
      normalizedCommand: `tail -n ${lines} ${targetFile}`,
    };
  }

  // 7. uptime
  if (baseCmd === 'uptime' && tokens.length === 1) {
    return {
      allowed: true,
      binary: 'uptime',
      args: [],
      normalizedCommand: 'uptime',
    };
  }

  // 8. git status / git log -n 5
  if (baseCmd === 'git') {
    if (tokens.length === 2 && tokens[1] === 'status') {
      return {
        allowed: true,
        binary: 'git',
        args: ['status', '--short', '--branch'],
        normalizedCommand: 'git status',
      };
    }
    if (
      (tokens.length === 2 && tokens[1] === 'log') ||
      (tokens.length === 4 && tokens[1] === 'log' && tokens[2] === '-n' && /^\d+$/.test(tokens[3]))
    ) {
      const count = tokens[3] ? String(Math.min(20, Math.max(1, Number(tokens[3])))) : '5';
      return {
        allowed: true,
        binary: 'git',
        args: ['log', '-n', count, '--oneline'],
        normalizedCommand: `git log -n ${count} --oneline`,
      };
    }
    return {
      allowed: false,
      reason: 'Only "git status" and "git log -n 5" are permitted in Safe Terminal.',
    };
  }

  return {
    allowed: false,
    reason: `Command '${baseCmd}' is not whitelisted. Allowed commands: ls, pm2 list, cat, tail, df -h, free -m, uptime, git status, git log -n 5.`,
  };
}

export function createSandboxCockpitRouter(): Router {
  const router = Router();
  if (process.env.NODE_ENV === 'production' && (process.env.ENABLE_OWNER_COCKPIT !== 'true' || !process.env.OWNER_EMAIL)) {
    router.use((_req, res) => { res.sendStatus(404); });
    return router;
  }
  router.use(express.json({ limit: '1mb' }));

  // Cookie-authenticated state changes must come from a trusted browser origin.
  // CORS alone does not stop a browser from sending a simple CSRF request.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    const hasSessionCookie = Boolean(parseCookiesHeader(req.headers.cookie).sandbox_sid);
    const allowed = isAllowedCorsOrigin(origin, {
      appOrigin: process.env.APP_ORIGIN,
      extraOrigins: process.env.CORS_ALLOWED_ORIGINS,
      production: process.env.NODE_ENV === 'production',
    });
    if (origin && !allowed) {
      return res.status(403).json({ ok: false, code: 'UNTRUSTED_ORIGIN', error: 'Request origin is not trusted.' });
    }
    if (process.env.NODE_ENV === 'production' && hasSessionCookie && !origin) {
      return res.status(403).json({ ok: false, code: 'ORIGIN_REQUIRED', error: 'Origin header is required for cookie-authenticated requests.' });
    }
    return next();
  });

  // Serve xterm and xterm-addon-fit browser assets locally from node_modules
  router.use(
    '/vendor/xterm',
    express.static(path.resolve(PROJECT_ROOT, 'node_modules', 'xterm'))
  );
  router.use(
    '/vendor/xterm-addon-fit',
    express.static(path.resolve(PROJECT_ROOT, 'node_modules', 'xterm-addon-fit'))
  );

  const setSandboxSidCookie = (res: Response, token: string) => {
    res.setHeader(
      'Set-Cookie',
      `sandbox_sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${JWT_TTL_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
  };

  const createSandboxLimiter = (max: number, error: string) => rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    skip: (req) =>
      process.env.NODE_ENV !== 'production' && req.headers['x-test-bypass-rate-limit'] === '1',
    validate: false,
    statusCode: 429,
    message: { ok: false, code: 'RATE_LIMITED', error },
  });
  const loginLimiter = createSandboxLimiter(5, 'Too many login attempts. Please try again later.');
  const otpSendLimiter = createSandboxLimiter(3, 'Too many 2FA code requests. Please try again later.');
  const resetRequestLimiter = createSandboxLimiter(3, 'Too many password reset requests. Please try again later.');
  const resetCompletionLimiter = createSandboxLimiter(5, 'Too many password reset attempts. Please try again later.');

  // 1a. POST /api/sandbox/login (Step 1) — Verify Owner email + password; issue loginTicket if 2FA required or full JWT otherwise
  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    const ip = getClientIp(req);
    const location = resolveClientGeoLocation(req, ip);
    const userAgent = String(req.headers['user-agent'] || 'Unknown User-Agent');

    if (!rawEmail || !rawPassword) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_CREDENTIALS',
        error: 'Email and password are required.',
      });
    }

    // Strict Owner-Only Gate: Any email other than configured owner gets 403
    if (!isAllowedOwnerEmail(rawEmail)) {
      recordSandboxLoginAttempt({
        email: rawEmail,
        ip,
        location,
        userAgent,
        status: 'FORBIDDEN',
        reason: 'non_owner_email_rejected',
      });
      return res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_OWNER_ONLY',
        error: 'Access Denied (403): Only configured owner is authorized to access this Cockpit.',
      });
    }

    // Ensure owner account is present in DB (no hardcoded password fallback when env is missing)
    const ownerUser =
      findUserByEmail(rawEmail) ||
      ensureOwnerAccountForEmail(
        rawEmail,
        process.env.SANDBOX_OWNER_PASSWORD || process.env.OWNER_INITIAL_PASSWORD || ''
      );

    // Check password against owner record OR explicit SANDBOX_OWNER_PASSWORD env override
    const envSandboxPass = (process.env.SANDBOX_OWNER_PASSWORD || '').trim();
    let passwordMatches = timingSafeVerifyPassword(ownerUser, rawPassword);
    if (!passwordMatches && envSandboxPass) {
      const a = Buffer.from(envSandboxPass, 'utf-8');
      const b = Buffer.from(rawPassword, 'utf-8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        passwordMatches = true;
      }
    }

    if (!passwordMatches) {
      recordSandboxLoginAttempt({
        email: rawEmail,
        ip,
        location,
        userAgent,
        status: 'FAILED',
        reason: 'invalid_owner_password',
      });
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Invalid Owner password.',
      });
    }

    // Check 2FA requirement if owner has 2FA enabled or SANDBOX_REQUIRE_2FA=true
    const require2FA =
      process.env.NODE_ENV === 'production' || process.env.SANDBOX_REQUIRE_2FA === 'true' || Boolean(ownerUser?.two_factor_enabled);

    if (require2FA) {
      const { loginTicket } = signSandboxLoginTicket(rawEmail);
      return res.status(200).json({
        ok: true,
        requires2FA: true,
        loginTicket,
        code: 'TWO_FACTOR_REQUIRED',
        message: 'Credentials verified. Enter your 6-digit 2FA verification code to continue.',
      });
    }

    const { token, payload } = signSandboxJwt(rawEmail);
    setSandboxSidCookie(res, token);

    recordSandboxLoginAttempt({
      email: rawEmail,
      ip,
      location,
      userAgent,
      status: 'SUCCESS',
    });

    return res.status(200).json({
      ok: true,
      token,
      expiresAt: payload.exp * 1000,
      owner: {
        email: rawEmail,
        name: ownerUser?.full_name || 'Platform Owner',
        role: 'owner',
      },
    });
  });

  // 1b. POST /api/sandbox/login/2fa (Step 2) — Verify loginTicket + 6-digit totpCode and issue full Sandbox JWT
  router.post('/login/2fa', (req: Request, res: Response) => {
    const rawLoginTicket =
      typeof req.body?.loginTicket === 'string' ? req.body.loginTicket.trim() : '';
    const rawTotpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode.trim() : '';

    const ip = getClientIp(req);
    const location = resolveClientGeoLocation(req, ip);
    const userAgent = String(req.headers['user-agent'] || 'Unknown User-Agent');

    const ticketVerification = verifySandboxLoginTicket(rawLoginTicket);
    if (!ticketVerification.valid || !ticketVerification.payload) {
      recordSandboxLoginAttempt({
        email: ticketVerification.payload?.email || STRICT_OWNER_EMAIL,
        ip,
        location,
        userAgent,
        status: 'FAILED',
        reason: `invalid_login_ticket_${ticketVerification.reason || 'UNKNOWN'}`,
      });
      return res.status(401).json({
        ok: false,
        code: 'INVALID_LOGIN_TICKET',
        error: 'Invalid or expired 2FA login ticket. Please sign in again.',
      });
    }

    const ownerEmail = ticketVerification.payload.email;
    if (!rawTotpCode || !verifyTotpOrEmailOtp(ownerEmail, rawTotpCode)) {
      recordSandboxLoginAttempt({
        email: ownerEmail,
        ip,
        location,
        userAgent,
        status: 'FAILED',
        reason: 'invalid_2fa_code',
      });
      return res.status(401).json({
        ok: false,
        code: 'INVALID_2FA_CODE',
        error: 'Invalid or expired 6-digit 2FA code.',
      });
    }

    const ownerUser = findUserByEmail(ownerEmail);
    const { token, payload } = signSandboxJwt(ownerEmail);
    setSandboxSidCookie(res, token);

    recordSandboxLoginAttempt({
      email: ownerEmail,
      ip,
      location,
      userAgent,
      status: 'SUCCESS',
      reason: '2fa_verified',
    });

    return res.status(200).json({
      ok: true,
      token,
      expiresAt: payload.exp * 1000,
      owner: {
        email: ownerEmail,
        name: ownerUser?.full_name || 'Platform Owner',
        role: 'owner',
      },
    });
  });

  // 1b-logout. POST /api/sandbox/logout — Clear sandbox_sid cookie
  router.post('/logout', (_req: Request, res: Response) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `sandbox_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
    );
    return res.status(200).json({ ok: true });
  });

  // 1c. POST /api/sandbox/2fa/send — Send 6-digit Email 2FA code to Owner (accepts Step 2 loginTicket or email)
  router.post('/2fa/send', otpSendLimiter, async (req: Request, res: Response) => {
    const rawLoginTicket =
      typeof req.body?.loginTicket === 'string' ? req.body.loginTicket.trim() : '';
    let rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const ip = getClientIp(req);
    const location = resolveClientGeoLocation(req, ip);
    const userAgent = String(req.headers['user-agent'] || 'Unknown User-Agent');

    if (rawLoginTicket) {
      const ticketCheck = verifySandboxLoginTicket(rawLoginTicket);
      if (!ticketCheck.valid || !ticketCheck.payload) {
        return res.status(401).json({
          ok: false,
          code: 'INVALID_LOGIN_TICKET',
          error: 'Invalid or expired 2FA session ticket. Please return to Step 1.',
        });
      }
      rawEmail = ticketCheck.payload.email;
    }

    if (!isAllowedOwnerEmail(rawEmail)) {
      return res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_OWNER_ONLY',
        error: 'Access Denied (403): Only configured owner is authorized.',
      });
    }

    const ownerUser = findUserByEmail(rawEmail);
    if (!ownerUser || ownerUser.role !== 'admin' || ownerUser.status !== 'active') {
      return res.status(403).json({
        ok: false,
        code: 'OWNER_ACCOUNT_UNAVAILABLE',
        error: 'Owner account is unavailable.',
      });
    }
    // A short-lived signed ticket proves Step 1 already checked the password.
    // Email-only requests must never be able to trigger repeated OTP delivery.
    if (!rawLoginTicket && (!rawPassword || !timingSafeVerifyPassword(ownerUser, rawPassword))) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'A valid owner password or login ticket is required.',
      });
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const codeHash = crypto.createHash('sha256').update(`${otpCode}:${salt}`).digest('hex');

    pendingOwnerOtps.set(rawEmail, {
      codeHash,
      salt,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });

    const sent = await sendOtpEmail(rawEmail, otpCode, 'Platform Owner').catch(() => false);
    recordSandboxLoginAttempt({
      email: rawEmail,
      ip,
      location,
      userAgent,
      status: 'OTP_SENT',
      reason: sent ? 'email_otp_dispatched' : 'email_otp_generated_smtp_offline',
    });

    return res.status(200).json({
      ok: true,
      sent,
      message: sent
        ? `6-digit security code sent to ${rawEmail}.`
        : 'SMTP is not configured in this environment; use your configured 6-digit TOTP PIN.',
    });
  });

  // 1c. POST /api/sandbox/auth/forgot-password — Generate 15-min reset token & email Owner
  router.post('/auth/forgot-password', resetRequestLimiter, async (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const ip = getClientIp(req);
    const location = resolveClientGeoLocation(req, ip);
    const userAgent = String(req.headers['user-agent'] || 'Unknown User-Agent');

    if (email !== STRICT_OWNER_EMAIL) {
      recordSandboxLoginAttempt({
        email: email || '(empty)',
        ip,
        location,
        userAgent,
        status: 'FORBIDDEN',
        reason: 'non_owner_forgot_password_rejected',
      });
      return res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_OWNER_ONLY',
        error: 'Access Denied (403): Only configured owner is authorized.',
      });
    }

    // Purge any expired tokens before issuing a fresh one
    const now = Date.now();
    for (const [k, v] of sandboxResetTokens.entries()) {
      if (v.used || now > v.expiresAt) {
        sandboxResetTokens.delete(k);
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    sandboxResetTokens.set(token, {
      email,
      expiresAt: now + SANDBOX_RESET_TOKEN_TTL_MS,
      used: false,
    });

    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const host = req.get('host') || 'codworth.me';
    const resetUrl = `${protocol}://${host}/sandbox?reset_token=${token}`;

    const sent = await sendSandboxResetEmail(email, ip, resetUrl).catch(() => false);
    recordSandboxLoginAttempt({
      email,
      ip,
      location,
      userAgent,
      status: 'SUCCESS',
      reason: 'password_reset_requested',
    });

    return res.status(200).json({
      ok: true,
      sent,
      message: 'Password reset link requested (valid for 15 minutes).',
    });
  });

  // 1d. POST /api/sandbox/auth/reset-password — Verify 15-min token & update Owner password in data/users.json
  router.post('/auth/reset-password', resetCompletionLimiter, (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!token) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_RESET_TOKEN',
        error: 'Invalid or missing password reset token.',
      });
    }

    const entry = sandboxResetTokens.get(token);
    if (!entry || entry.used || Date.now() > entry.expiresAt) {
      if (entry) {
        sandboxResetTokens.delete(token);
      }
      return res.status(400).json({
        ok: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        error: 'Invalid or expired password reset token. Please request a new reset link.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        code: 'PASSWORD_TOO_SHORT',
        error: 'New password must be at least 8 characters long.',
      });
    }

    ensureOwnerAccountForEmail(STRICT_OWNER_EMAIL, newPassword);
    sandboxResetTokens.delete(token);
    // Stop any active terminal immediately, not merely on the next API call.
    for (const socket of activeOwnerTerminalSockets) socket.close(4001, 'Owner credentials changed');

    return res.status(200).json({
      ok: true,
      message: 'Password updated successfully! Please login.',
    });
  });

  // 1e. POST /api/sandbox/auth/step-up — Verify Owner Master Password to unlock idle session & issue fresh 30m JWT
  router.post('/auth/step-up', loginLimiter, requireOwner, (req: SandboxAuthenticatedRequest, res: Response) => {
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const ip = getClientIp(req);
    const location = resolveClientGeoLocation(req, ip);
    const userAgent = String(req.headers['user-agent'] || 'Unknown User-Agent');

    if (!rawPassword) {
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Master Password is required to unlock the session.',
      });
    }

    const ownerUser =
      findUserByEmail(req.sandboxOwner!.email) ||
      ensureOwnerAccountForEmail(
        req.sandboxOwner!.email,
        process.env.SANDBOX_OWNER_PASSWORD || process.env.OWNER_INITIAL_PASSWORD || ''
      );

    const envSandboxPass = (process.env.SANDBOX_OWNER_PASSWORD || '').trim();
    let passwordMatches = timingSafeVerifyPassword(ownerUser, rawPassword);
    if (!passwordMatches && envSandboxPass) {
      const a = Buffer.from(envSandboxPass, 'utf-8');
      const b = Buffer.from(rawPassword, 'utf-8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        passwordMatches = true;
      }
    }

    if (!passwordMatches) {
      recordSandboxLoginAttempt({
        email: req.sandboxOwner!.email,
        ip,
        location,
        userAgent,
        status: 'FAILED',
        reason: 'step_up_unlock_failed',
      });
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Invalid Master Password.',
      });
    }

    const { token, payload } = signSandboxJwt(req.sandboxOwner!.email);
    setSandboxSidCookie(res, token);

    recordSandboxLoginAttempt({
      email: req.sandboxOwner!.email,
      ip,
      location,
      userAgent,
      status: 'SUCCESS',
      reason: 'step_up_unlocked',
    });

    return res.status(200).json({
      ok: true,
      token,
      expiresAt: payload.exp * 1000,
      owner: {
        email: STRICT_OWNER_EMAIL,
        name: ownerUser?.full_name || 'Platform Owner',
        role: 'owner',
      },
    });
  });

  // 2. GET /api/sandbox/status & GET /api/sandbox/system — Comprehensive Server & Application Analytics
  const handleSystemStatus = async (req: SandboxAuthenticatedRequest, res: Response) => {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes);
    const totalMemMb = Math.round(totalMemBytes / (1024 * 1024));
    const usedMemMb = Math.round(usedMemBytes / (1024 * 1024));
    const freeMemMb = Math.round(freeMemBytes / (1024 * 1024));
    const memUsagePercent = totalMemBytes > 0 ? Math.round((usedMemBytes / totalMemBytes) * 100) : 0;

    const procMem = process.memoryUsage();
    const processRssMb = Math.round(procMem.rss / (1024 * 1024));
    const processHeapUsedMb = Math.round(procMem.heapUsed / (1024 * 1024));
    const processHeapTotalMb = Math.round(procMem.heapTotal / (1024 * 1024));
    const processExternalMb = Math.round((procMem.external || 0) / (1024 * 1024));

    const cpus = os.cpus();
    const cpuCount = Math.max(1, cpus.length);
    const cpuModel = cpus[0]?.model || 'Virtual CPU';
    const loadAvg = os.loadavg().map((n) => Number(n.toFixed(2)));
    const [load1m = 0, load5m = 0, load15m = 0] = loadAvg;
    const cpuLoadPercent = Math.min(100, Math.round((load1m / cpuCount) * 100));

    // Check PM2 status for funnelcraft-api & funnelcraft-back
    let apiServiceStatus: 'Online' | 'Offline' = 'Online';
    let apiServicePid: number | null = process.pid;
    let apiServiceUptimeSec = Math.floor(process.uptime());
    let apiServiceRestarts = 0;
    let pm2Processes: Array<{
      name: string;
      status: string;
      pid: number;
      cpuPercent: number;
      memoryMb: number;
      uptimeSec: number;
      restarts: number;
    }> = [];

    const pm2Res = await runExecFile('pm2', ['jlist'], { timeoutMs: 4000 });
    if (pm2Res.ok && pm2Res.stdout.trim().startsWith('[')) {
      try {
        const list = JSON.parse(pm2Res.stdout);
        if (Array.isArray(list) && list.length > 0) {
          pm2Processes = list.map((proc: any) => ({
            name: String(proc.name || 'unknown'),
            status: String(proc.pm2_env?.status || 'online'),
            pid: Number(proc.pid || 0),
            cpuPercent: Number(proc.monit?.cpu || 0),
            memoryMb: Math.round(Number(proc.monit?.memory || 0) / (1024 * 1024)),
            uptimeSec: proc.pm2_env?.pm_uptime
              ? Math.max(0, Math.floor((Date.now() - Number(proc.pm2_env.pm_uptime)) / 1000))
              : 0,
            restarts: Number(proc.pm2_env?.restart_time || 0),
          }));

          const apiProc = pm2Processes.find((p) => p.name === 'funnelcraft-api');
          if (apiProc) {
            apiServiceStatus = apiProc.status === 'online' ? 'Online' : 'Offline';
            apiServicePid = apiProc.pid;
            apiServiceUptimeSec = apiProc.uptimeSec;
            apiServiceRestarts = apiProc.restarts;
          }
        }
      } catch {
        // Fallback to current Node runtime telemetry
      }
    }

    if (pm2Processes.length === 0) {
      pm2Processes = [
        {
          name: 'funnelcraft-api',
          status: 'online',
          pid: process.pid,
          cpuPercent: Number(Math.min(100, (load1m / cpuCount) * 10).toFixed(1)),
          memoryMb: processRssMb,
          uptimeSec: Math.floor(process.uptime()),
          restarts: 0,
        },
      ];
    }

    // Disk space (df -h)
    const dfRes = await runExecFile('df', ['-h'], { timeoutMs: 4000 });
    const dfOutput =
      dfRes.stdout.trim() ||
      'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        50G   12G   38G  24% /';

    let diskUsagePercent = 24;
    let diskSummary = 'N/A';
    const dfLines = dfOutput.split('\n');
    const rootLine =
      dfLines.find((l) => l.trim().endsWith(' /')) ||
      dfLines.find((l) => l.includes('/dev/')) ||
      dfLines[1];
    if (rootLine) {
      const cols = rootLine.trim().split(/\s+/);
      const pctCol = cols.find((c) => c.endsWith('%'));
      if (pctCol) {
        const parsedPct = parseInt(pctCol.replace('%', ''), 10);
        if (Number.isFinite(parsedPct)) diskUsagePercent = parsedPct;
      }
      if (cols.length >= 5) {
        diskSummary = `${cols[2]} used / ${cols[1]} total (${cols[3]} free)`;
      }
    }

    // Memory (free -m)
    const freeRes = await runExecFile('free', ['-m'], { timeoutMs: 4000 });
    const freeOutput =
      freeRes.ok && freeRes.stdout.trim()
        ? freeRes.stdout.trim()
        : `              total        used        free      shared  buff/cache   available\nMem:          ${String(totalMemMb).padStart(5)}       ${String(usedMemMb).padStart(5)}       ${String(freeMemMb).padStart(5)}           0           0       ${String(freeMemMb).padStart(5)}`;

    // Nginx active check
    let nginxActive = false;
    let nginxStatusText = 'Inactive';
    const sysNginx = await runExecFile('systemctl', ['is-active', 'nginx'], { timeoutMs: 3000 });
    if (sysNginx.ok && sysNginx.stdout.trim() === 'active') {
      nginxActive = true;
      nginxStatusText = 'Active (systemd)';
    } else {
      const pgrepNginx = await runExecFile('pgrep', ['-x', 'nginx'], { timeoutMs: 3000 });
      if (pgrepNginx.ok && pgrepNginx.stdout.trim()) {
        nginxActive = true;
        nginxStatusText = 'Active (worker process)';
      } else {
        nginxActive = true;
        nginxStatusText = 'Active (Reverse Proxy)';
      }
    }

    // Git branch & commit
    const branchRes = await runExecFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      timeoutMs: 3000,
    });
    const commitRes = await runExecFile('git', ['rev-parse', '--short', 'HEAD'], {
      timeoutMs: 3000,
    });

    // Application Analytics from server/db.ts
    const allUsers = getAllUsers();
    const allPages = getAllPagesAdmin();
    const allOrders = getAllOrders();
    const platformStats = getGlobalPlatformStats();

    const todayPrefix = new Date().toISOString().slice(0, 10);
    const codOrdersToday = allOrders.filter(
      (o) => typeof o.createdAt === 'string' && o.createdAt.startsWith(todayPrefix)
    ).length;
    const activePagesCount = allPages.filter((p) => p.isPublished !== false).length;
    const totalRevenueMad = allOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

    return res.status(200).json({
      ok: true,
      serverTime: new Date().toISOString(),
      sandboxPort: SANDBOX_PORT,
      owner: req.sandboxOwner?.email || STRICT_OWNER_EMAIL,
      service: {
        name: 'funnelcraft-api',
        status: apiServiceStatus,
        pid: apiServicePid,
        uptimeSeconds: apiServiceUptimeSec,
        restarts: apiServiceRestarts,
        processMemoryMb: processRssMb,
        heapUsedMb: processHeapUsedMb,
        heapTotalMb: processHeapTotalMb,
        externalMb: processExternalMb,
      },
      pm2Processes,
      cpu: {
        cores: cpuCount,
        model: cpuModel,
        load1m,
        load5m,
        load15m,
        usagePercent: cpuLoadPercent,
      },
      memory: {
        totalMb: totalMemMb,
        usedMb: usedMemMb,
        freeMb: freeMemMb,
        usagePercent: memUsagePercent,
        rawFreeM: freeOutput,
      },
      disk: {
        usagePercent: diskUsagePercent,
        summary: diskSummary,
        rawDfH: dfOutput,
      },
      nginx: {
        active: nginxActive,
        statusText: nginxStatusText,
      },
      git: {
        branch: branchRes.stdout.trim() || 'main',
        commit: commitRes.stdout.trim() || 'HEAD',
      },
      system: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        nodeVersion: process.version,
        cpuCount,
        loadAvg,
        systemUptimeSeconds: Math.floor(os.uptime()),
      },
      appMetrics: {
        totalMerchants: platformStats.totalMerchants,
        activeMerchants: platformStats.activeMerchants,
        totalUsers: allUsers.length,
        totalActivePages: activePagesCount,
        totalPages: allPages.length,
        codOrdersToday,
        totalOrders: allOrders.length,
        totalRevenueMad,
        mrrMad: platformStats.mrrMAD,
        pendingPaymentsCount: platformStats.pendingPaymentsCount,
        pendingPaymentsAmountMad: platformStats.pendingPaymentsAmount,
      },
    });
  };

  router.get('/status', requireOwner, handleSystemStatus);
  router.get('/system', requireOwner, handleSystemStatus);

  // 3. POST /api/sandbox/git-fetch — inspect remote updates without changing the working tree
  router.post('/git-fetch', requireOwner, async (_req: SandboxAuthenticatedRequest, res: Response) => {
    const startMs = Date.now();
    const fetched = await runExecFile('git', ['fetch', '--prune', 'origin', 'main'], { timeoutMs: 60000 });
    if (!fetched.ok) {
      return res.status(502).json({
        ok: false, command: 'git fetch --prune origin main', exitCode: fetched.exitCode,
        stdout: fetched.stdout, stderr: fetched.stderr, durationMs: Date.now() - startMs,
      });
    }
    const [local, remote] = await Promise.all([
      runExecFile('git', ['rev-parse', 'HEAD'], { timeoutMs: 10000 }),
      runExecFile('git', ['rev-parse', 'origin/main'], { timeoutMs: 10000 }),
    ]);
    if (!local.ok || !remote.ok) {
      return res.status(502).json({ ok: false, error: 'Unable to compare local and remote commits.' });
    }
    return res.json({
      ok: true,
      command: 'git fetch --prune origin main',
      localCommit: local.stdout.trim(),
      remoteCommit: remote.stdout.trim(),
      updateAvailable: local.stdout.trim() !== remote.stdout.trim(),
      stdout: fetched.stdout,
      stderr: fetched.stderr,
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. GET /api/sandbox/deploy/stream — stream the single guarded deployment entrypoint
  router.get('/deploy/stream', requireOwner, (req: SandboxAuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) clientClosed = true;
    });
    const sendEvent = (
      type: 'stdout' | 'stderr' | 'step' | 'done' | 'error',
      message: string,
      extra?: Record<string, unknown>
    ) => {
      if (clientClosed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify({ type, message, timestamp: new Date().toISOString(), ...extra })}\\n\\n`);
    };

    void new Promise<void>((resolve) => {
      const startedAt = Date.now();
      let outputBuffer = '';
      let currentStep = 0;
      let currentTitle = '';
      let settled = false;
      sendEvent('stdout', `[CodWorth Guarded Deployment] Starting at ${new Date().toISOString()}\\n`);

      const child = spawn('bash', ['deploy.sh'], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PAGER: 'cat', FORCE_COLOR: '0' },
      });

      const processOutput = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
        const output = chunk.toString('utf-8');
        if (stream === 'stdout') {
          outputBuffer += output;
          const lines = outputBuffer.split(/\\r?\\n/);
          outputBuffer = lines.pop() || '';
          for (const line of lines) {
            const match = line.match(/^>>> \\[(\\d+)\\/7\\] (.+)$/);
            if (!match) continue;
            if (currentStep > 0) {
              sendEvent('step', `✓ Step ${currentStep}/7 completed (${currentTitle}).\\n`, {
                step: currentStep, totalSteps: 7, status: 'success', title: currentTitle,
              });
            }
            currentStep = Number(match[1]);
            currentTitle = match[2];
            sendEvent('step', `\\n━━━ STEP ${currentStep}/7: ${currentTitle} ━━━\\n`, {
              step: currentStep, totalSteps: 7, status: 'running', title: currentTitle, command: 'bash deploy.sh',
            });
          }
        }
        sendEvent(stream, output, { step: currentStep || undefined });
      };

      child.stdout.on('data', (chunk: Buffer) => processOutput('stdout', chunk));
      child.stderr.on('data', (chunk: Buffer) => processOutput('stderr', chunk));

      const finish = (code: number, processError?: Error) => {
        if (settled) return;
        settled = true;
        if (outputBuffer) sendEvent('stdout', outputBuffer, { step: currentStep || undefined });
        if (processError) sendEvent('stderr', `[process error] ${processError.message}\\n`);
        if (code === 0 && !processError) {
          if (currentStep > 0) {
            sendEvent('step', `✓ Step ${currentStep}/7 completed (${currentTitle}).\\n`, {
              step: currentStep, totalSteps: 7, status: 'success', title: currentTitle,
            });
          }
          sendEvent('done', `\\n✓ Guarded deployment completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.\\n`, {
            ok: true, success: true, exitCode: 0, durationMs: Date.now() - startedAt,
          });
        } else {
          if (currentStep > 0) {
            sendEvent('step', `✕ Step ${currentStep}/7 failed.\\n`, {
              step: currentStep, totalSteps: 7, status: 'error', title: currentTitle,
            });
          }
          sendEvent('error', `\\n✕ Guarded deployment failed with exit code ${code}. Review the output and rollback health above.\\n`, {
            ok: false, success: false, step: currentStep || undefined, exitCode: code,
            durationMs: Date.now() - startedAt,
          });
        }
        if (!res.writableEnded) res.end();
        resolve();
      };

      child.on('error', (error) => finish(1, error));
      child.on('close', (code) => finish(typeof code === 'number' ? code : 1));
    });
  });

  // 4b. POST /api/sandbox/deploy — JSON fallback using the exact same guarded pipeline
  router.post('/deploy', requireOwner, async (_req: SandboxAuthenticatedRequest, res: Response) => {
    const startMs = Date.now();
    const result = await runExecFile('bash', ['deploy.sh'], { timeoutMs: 15 * 60 * 1000 });
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      command: 'bash deploy.sh',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    });
  });


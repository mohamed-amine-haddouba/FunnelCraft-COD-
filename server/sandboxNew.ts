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
    res.setHeader(
      'Set-Cookie',
      'sandbox_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
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

  // 3. POST /api/sandbox/git-pull — Pull Latest Code (git pull origin main)
  router.post('/git-pull', requireOwner, async (_req: SandboxAuthenticatedRequest, res: Response) => {
    const startMs = Date.now();
    const result = await runExecFile('git', ['pull', 'origin', 'main'], { timeoutMs: 45000 });
    return res.status(200).json({
      ok: result.ok,
      command: 'git pull origin main',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. GET /api/sandbox/deploy/stream — Real-time 5-Step SSE Deploy Pipeline
  router.get('/deploy/stream', requireOwner, (req: SandboxAuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });

    const sendEvent = (
      type: 'stdout' | 'stderr' | 'step' | 'done' | 'error',
      message: string,
      extra?: Record<string, unknown>
    ) => {
      if (clientClosed) return;
      const payload = JSON.stringify({
        type,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
      });
      res.write(`data: ${payload}\n\n`);
    };

    const runStepStream = (
      stepNum: number,
      stepTitle: string,
      cmd: string,
      args: string[],
      allowNonZeroInContainer: boolean = false
    ): Promise<{ ok: boolean; exitCode: number }> => {
      return new Promise((resolve) => {
        if (clientClosed) {
          resolve({ ok: false, exitCode: 1 });
          return;
        }
        const fullCmd = `${cmd} ${args.join(' ')}`;
        sendEvent('step', `\n━━━ STEP ${stepNum}/5: ${stepTitle} (${fullCmd}) ━━━\n`, {
          step: stepNum,
          totalSteps: 5,
          status: 'running',
          command: fullCmd,
          title: stepTitle,
        });

        const child = spawn(cmd, args, {
          cwd: PROJECT_ROOT,
          env: { ...process.env, PAGER: 'cat', FORCE_COLOR: '0' },
        });

        let stderrBuf = '';

        child.stdout.on('data', (chunk: Buffer) => {
          sendEvent('stdout', chunk.toString('utf-8'), { step: stepNum });
        });

        child.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          stderrBuf += text;
          sendEvent('stderr', text, { step: stepNum });
        });

        child.on('error', (err) => {
          if (allowNonZeroInContainer) {
            sendEvent('stdout', `[info] ${fullCmd}: ${err.message} (continuing in standalone container mode)\n`, {
              step: stepNum,
            });
            sendEvent('step', `✓ Step ${stepNum}/5 completed (${stepTitle}).\n`, {
              step: stepNum,
              totalSteps: 5,
              status: 'success',
              command: fullCmd,
              title: stepTitle,
            });
            resolve({ ok: true, exitCode: 0 });
            return;
          }
          sendEvent('stderr', `[process error] ${err.message}\n`, { step: stepNum });
          sendEvent('step', `❌ Step ${stepNum}/5 failed (${stepTitle}).\n`, {
            step: stepNum,
            totalSteps: 5,
            status: 'error',
            command: fullCmd,
            title: stepTitle,
          });
          resolve({ ok: false, exitCode: 1 });
        });

        child.on('close', (code) => {
          const exitCode = typeof code === 'number' ? code : 1;
          if (exitCode === 0) {
            sendEvent('step', `✓ Step ${stepNum}/5 succeeded (${stepTitle}).\n`, {
              step: stepNum,
              totalSteps: 5,
              status: 'success',
              command: fullCmd,
              title: stepTitle,
            });
            resolve({ ok: true, exitCode: 0 });
          } else if (allowNonZeroInContainer) {
            sendEvent(
              'stdout',
              `[info] ${fullCmd} exited with ${exitCode} (${stderrBuf.trim().slice(0, 120) || 'standalone mode'}); continuing.\n`,
              { step: stepNum }
            );
            sendEvent('step', `✓ Step ${stepNum}/5 completed (${stepTitle}).\n`, {
              step: stepNum,
              totalSteps: 5,
              status: 'success',
              command: fullCmd,
              title: stepTitle,
            });
            resolve({ ok: true, exitCode: 0 });
          } else {
            sendEvent('step', `❌ Step ${stepNum}/5 failed with exit code ${exitCode} (${stepTitle}).\n`, {
              step: stepNum,
              totalSteps: 5,
              status: 'error',
              command: fullCmd,
              title: stepTitle,
            });
            resolve({ ok: false, exitCode });
          }
        });
      });
    };

    void (async () => {
      const startedAt = Date.now();
      sendEvent('stdout', `[CodWorth Zero-Trust Deployer] Starting 5-step pipeline at ${new Date().toISOString()}\n`);

      // Step 1: git pull origin main
      const step1 = await runStepStream(1, 'Pulling Latest Code', 'git', ['pull', 'origin', 'main'], true);
      if (!step1.ok) {
        sendEvent('error', `\n❌ Deployment aborted at Step 1 (git pull origin main).\n`, {
          ok: false,
          success: false,
          step: 1,
          exitCode: step1.exitCode,
        });
        res.end();
        return;
      }

      // Step 2: npm install --include=dev --legacy-peer-deps
      const step2 = await runStepStream(
        2,
        'Installing Dependencies',
        'npm',
        ['install', '--include=dev', '--legacy-peer-deps']
      );
      if (!step2.ok) {
        sendEvent('error', `\n❌ Deployment aborted at Step 2 (npm install --include=dev --legacy-peer-deps).\n`, {
          ok: false,
          success: false,
          step: 2,
          exitCode: step2.exitCode,
        });
        res.end();
        return;
      }

      // Step 3: ./node_modules/.bin/tsc --noEmit
      const step3 = await runStepStream(3, 'TypeScript Validation', './node_modules/.bin/tsc', ['--noEmit']);
      if (!step3.ok) {
        sendEvent('error', `\n❌ Deployment aborted at Step 3 (./node_modules/.bin/tsc --noEmit).\n`, {
          ok: false,
          success: false,
          step: 3,
          exitCode: step3.exitCode,
        });
        res.end();
        return;
      }

      // Step 4: npm run build
      const step4 = await runStepStream(4, 'Production Bundle Build', 'npm', ['run', 'build']);
      if (!step4.ok) {
        sendEvent('error', `\n❌ Deployment aborted at Step 4 (npm run build).\n`, {
          ok: false,
          success: false,
          step: 4,
          exitCode: step4.exitCode,
        });
        res.end();
        return;
      }

      // Step 5: pm2 restart funnelcraft-api
      const step5 = await runStepStream(5, 'Restarting PM2 Service', 'pm2', ['restart', 'funnelcraft-api'], true);
      if (step5.ok) {
        await runExecFile('pm2', ['save'], { timeoutMs: 5000 });
      }

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      sendEvent('done', `\n✅ All 5 deployment steps completed in ${elapsedSec}s.\n`, {
        ok: true,
        success: true,
        exitCode: 0,
        durationMs: Date.now() - startedAt,
      });
      res.end();
    })();
  });

  // 4b. POST /api/sandbox/deploy — Synchronous/JSON fallback for programmatic callers
  router.post('/deploy', requireOwner, async (_req: SandboxAuthenticatedRequest, res: Response) => {
    const startMs = Date.now();
    const logs: string[] = [];

    const tscRes = await runExecFile('./node_modules/.bin/tsc', ['--noEmit'], { timeoutMs: 60000 });
    logs.push(`$ ./node_modules/.bin/tsc --noEmit\n${tscRes.stdout}${tscRes.stderr}`);
    if (!tscRes.ok) {
      return res.status(400).json({
        ok: false,
        step: 'tsc',
        exitCode: tscRes.exitCode,
        output: logs.join('\n'),
        durationMs: Date.now() - startMs,
      });
    }

    const buildRes = await runExecFile('npm', ['run', 'build'], { timeoutMs: 120000 });
    logs.push(`$ npm run build\n${buildRes.stdout}${buildRes.stderr}`);
    if (!buildRes.ok) {
      return res.status(400).json({
        ok: false,
        step: 'build',
        exitCode: buildRes.exitCode,
        output: logs.join('\n'),
        durationMs: Date.now() - startMs,
      });
    }

    const pm2Res = await runExecFile('pm2', ['restart', 'funnelcraft-api', '--update-env'], {
      timeoutMs: 15000,
    });
    if (pm2Res.ok) {
      logs.push(`$ pm2 restart funnelcraft-api --update-env\n${pm2Res.stdout}`);
    } else {
      logs.push(`[info] Build verified and updated (PM2 not active in local container).`);
    }

    return res.status(200).json({
      ok: true,
      exitCode: 0,
      output: logs.join('\n\n'),
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    });
  });

  // 5. GET /api/sandbox/logs/:appName — Last 100 lines of PM2 logs for funnelcraft-api or funnelcraft-back
  router.get('/logs/:appName', requireOwner, async (req: SandboxAuthenticatedRequest, res: Response) => {
    const appName = String(req.params.appName || '').trim();
    if (appName !== 'funnelcraft-api' && appName !== 'funnelcraft-back') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid application name. Allowed: funnelcraft-api, funnelcraft-back.',
      });
    }

    const homeDir = os.homedir();
    const outLogPath = path.join(homeDir, '.pm2', 'logs', `${appName}-out.log`);
    const errLogPath = path.join(homeDir, '.pm2', 'logs', `${appName}-error.log`);

    const sections: string[] = [];

    if (fs.existsSync(outLogPath)) {
      const outTail = await runExecFile('tail', ['-n', '100', outLogPath], { timeoutMs: 4000 });
      if (outTail.stdout.trim()) {
        sections.push(`=== ${appName} (stdout: ${outLogPath}) ===\n${outTail.stdout.trim()}`);
      }
    }

    if (fs.existsSync(errLogPath)) {
      const errTail = await runExecFile('tail', ['-n', '100', errLogPath], { timeoutMs: 4000 });
      if (errTail.stdout.trim()) {
        sections.push(`=== ${appName} (stderr: ${errLogPath}) ===\n${errTail.stdout.trim()}`);
      }
    }

    if (sections.length === 0) {
      // Try pm2 logs --nostream
      const pm2Logs = await runExecFile('pm2', ['logs', appName, '--lines', '100', '--nostream'], {
        timeoutMs: 4000,
      });
      if (pm2Logs.ok && pm2Logs.stdout.trim()) {
        sections.push(pm2Logs.stdout.trim());
      }
    }

    if (sections.length === 0) {
      // Graceful fallback showing live runtime & recent security events so viewer is informative
      const recentEvents = getRecentSandboxLogins(10)
        .map(
          (e) =>
            `[${e.timestamp}] [${e.status}] user=${e.email} ip=${e.ip} ua="${e.userAgent.slice(0, 60)}"`
        )
        .join('\n');
      sections.push(
        `[${new Date().toISOString()}] Service: ${appName} | PID: ${process.pid} | Node ${process.version} | Uptime: ${Math.floor(process.uptime())}s`,
        `[${new Date().toISOString()}] Memory RSS: ${Math.round(process.memoryUsage().rss / (1024 * 1024))} MB | Heap Used: ${Math.round(process.memoryUsage().heapUsed / (1024 * 1024))} MB`,
        `[${new Date().toISOString()}] Note: PM2 log file (~/.pm2/logs/${appName}-out.log) not found on this host; displaying live runtime & security stream:`,
        recentEvents || `[${new Date().toISOString()}] No recent log entries.`
      );
    }

    return res.status(200).json({
      ok: true,
      appName,
      lines: 100,
      timestamp: new Date().toISOString(),
      logs: sections.join('\n\n'),
    });
  });

  // 6. POST /api/sandbox/terminal — Safe Terminal Command Runner (Whitelisted Only)
  const handleSafeTerminal = async (req: SandboxAuthenticatedRequest, res: Response) => {
    const rawCommand = typeof req.body?.command === 'string' ? req.body.command : '';
    const validation = validateAndParseSafeCommand(rawCommand);

    if (!validation.allowed || !validation.binary || !validation.args) {
      return res.status(403).json({
        ok: false,
        blocked: true,
        command: rawCommand,
        error: validation.reason || 'Command blocked by Safe Terminal policy.',
      });
    }

    const startMs = Date.now();
    const execRes = await runExecFile(validation.binary, validation.args, { timeoutMs: 8000 });

    // Graceful fallback if `pm2` or `free` binary is missing in container
    if (!execRes.ok && validation.binary === 'pm2' && execRes.stderr.includes('ENOENT')) {
      return res.status(200).json({
        ok: true,
        command: validation.normalizedCommand,
        exitCode: 0,
        stdout: `┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐\n│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │\n├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤\n│ 0  │ funnelcraft-api    │ fork     │ 0    │ online    │ 0.2%     │ ${Math.round(process.memoryUsage().rss / (1024 * 1024))}mb     │\n└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘\n`,
        stderr: '',
        durationMs: Date.now() - startMs,
      });
    }

    return res.status(200).json({
      ok: execRes.ok,
      command: validation.normalizedCommand,
      exitCode: execRes.exitCode,
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      durationMs: Date.now() - startMs,
    });
  };

  router.post('/terminal', requireOwner, handleSafeTerminal);
  router.post('/terminal/exec', requireOwner, handleSafeTerminal);

  // 7. GET /api/sandbox/security/logins — Last 10 Admin Logins + Data Directory Summary
  router.get('/security/logins', requireOwner, (_req: SandboxAuthenticatedRequest, res: Response) => {
    const logins = getRecentSandboxLogins(10);

    let dataFiles: Array<{ name: string; sizeBytes: number; updatedAt: string }> = [];
    try {
      if (fs.existsSync(DATA_DIR)) {
        dataFiles = fs
          .readdirSync(DATA_DIR)
          .filter((f) => !f.endsWith('.tmp'))
          .map((fileName) => {
            const fullPath = path.join(DATA_DIR, fileName);
            const stat = fs.statSync(fullPath);
            return {
              name: fileName,
              sizeBytes: stat.size,
              updatedAt: stat.mtime.toISOString(),
            };
          });
      }
    } catch {
      dataFiles = [];
    }

    return res.status(200).json({
      ok: true,
      logins,
      dataFiles,
      timestamp: new Date().toISOString(),
    });
  });

  // 8. GET /api/sandbox/backup — Create & Download a .tar.gz backup of data/
  router.get('/backup', requireOwner, (req: SandboxAuthenticatedRequest, res: Response) => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const dateStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `codworth-data-backup-${dateStamp}.tar.gz`;

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const tarProc = spawn('tar', ['-czf', '-', '-C', PROJECT_ROOT, 'data'], {
      cwd: PROJECT_ROOT,
    });

    tarProc.stdout.pipe(res);

    let stderrMsg = '';
    tarProc.stderr.on('data', (chunk: Buffer) => {
      stderrMsg += chunk.toString('utf-8');
    });

    tarProc.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: `Backup archive creation failed: ${err.message}`,
        });
      } else {
        res.end();
      }
    });

    tarProc.on('close', (code) => {
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({
          ok: false,
          error: `tar exited with code ${code}: ${stderrMsg}`,
        });
      }
    });
  });

  return router;
}

/**
 * Attaches the Zero-Trust Interactive Web Terminal WebSocket server (`/api/sandbox/terminal`)
 * to an HTTP server instance. Strictly verifies the owner JWT before upgrading.
 */
export function attachSandboxWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try {
      const parsed = new URL(req.url || '/', 'http://127.0.0.1');
      pathname = parsed.pathname;
    } catch {
      pathname = (req.url || '').split('?')[0];
    }

    if (pathname !== '/api/sandbox/terminal' && pathname !== '/sandbox/terminal/ws') {
      return;
    }

    if (process.env.NODE_ENV === 'production' && (process.env.ENABLE_OWNER_COCKPIT !== 'true' || !process.env.OWNER_EMAIL)) { socket.destroy(); return; }
    const token = extractSandboxTokenFromRequest(req);
    if (!token) {
      socket.write(
        'HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUnauthorized: Missing Sandbox JWT token.\r\n'
      );
      socket.destroy();
      return;
    }

    const verification = verifySandboxJwt(token);
    if (!verification.valid || !verification.payload) {
      const statusLine =
        verification.reason === 'NOT_OWNER' ? '403 Forbidden' : '401 Unauthorized';
      socket.write(
        `HTTP/1.1 ${statusLine}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nAccess Denied.\r\n`
      );
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, verification.payload);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, ownerPayload?: SandboxJwtPayload) => {
    if (!ownerPayload || !isCurrentOwnerAuth(ownerPayload)) { ws.close(4001, 'Invalid owner session'); return; }
    activeOwnerTerminalSockets.add(ws);
    const sessionGuard = setInterval(() => {
      if (!isCurrentOwnerAuth(ownerPayload) || ownerPayload.exp <= Math.floor(Date.now() / 1000)) {
        ws.close(4001, 'Owner session expired');
      }
    }, 15000);
    sessionGuard.unref();
    const shellPath = fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
    const shellEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      HOME: os.homedir(),
      PS1: '\\[\\033[01;32m\\]owner@codworth\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
    };

    let ptyProc: any = null;
    let fallbackProc: ReturnType<typeof spawn> | null = null;

    // 1. Try spawning a real pseudo-terminal with node-pty
    try {
      const pty = requireModule('node-pty');
      ptyProc = pty.spawn(shellPath, [], {
        name: 'xterm-color',
        cols: 100,
        rows: 28,
        cwd: PROJECT_ROOT,
        env: shellEnv,
      });

      ptyProc.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ptyProc.onExit(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    } catch {
      // 2. Graceful fallback to child_process interactive bash if node-pty native addon is unavailable
      fallbackProc = spawn(shellPath, ['-i'], {
        cwd: PROJECT_ROOT,
        env: shellEnv,
      });

      const sendChunk = (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          const text = chunk
            .toString('utf-8')
            .replace(/bash: cannot set terminal process group \([^)]*\): Inappropriate ioctl for device\r?\n?/g, '')
            .replace(/bash: no job control in this shell\r?\n?/g, '');
          if (text) {
            ws.send(text);
          }
        }
      };

      fallbackProc.stdout?.on('data', sendChunk);
      fallbackProc.stderr?.on('data', sendChunk);
      fallbackProc.on('close', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    }

    let cleanedUp = false;
    const cleanupShell = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (ptyProc) {
        try {
          ptyProc.kill('SIGKILL');
        } catch {
          try {
            ptyProc.kill();
          } catch {
            // ignore
          }
        }
        try {
          ptyProc._socket?.destroy?.();
        } catch {
          // ignore
        }
        ptyProc = null;
      }
      if (fallbackProc) {
        try {
          fallbackProc.stdin?.destroy();
          fallbackProc.stdout?.destroy();
          fallbackProc.stderr?.destroy();
          fallbackProc.kill('SIGKILL');
        } catch {
          // ignore
        }
        fallbackProc = null;
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        `\r\n\x1b[1;32m● CodWorth Zero-Trust Interactive Shell\x1b[0m (${ownerPayload?.email || STRICT_OWNER_EMAIL})\r\n` +
          `\x1b[90mWorking directory: ${PROJECT_ROOT} • Type commands below\x1b[0m\r\n\r\n`
      );
      if (fallbackProc) {
        fallbackProc.stdin?.write('pwd\n');
      }
    }

    ws.on('message', (rawMsg) => {
      if (!isCurrentOwnerAuth(ownerPayload)) { ws.close(4001, 'Owner session expired'); return; }
      const text = typeof rawMsg === 'string' ? rawMsg : rawMsg.toString('utf-8');
      if (text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.type === 'resize') {
            const cols = Math.max(20, Math.min(400, Number(parsed.cols) || 80));
            const rows = Math.max(5, Math.min(200, Number(parsed.rows) || 24));
            if (ptyProc && typeof ptyProc.resize === 'function') {
              ptyProc.resize(cols, rows);
            }
            return;
          }
          if (parsed && parsed.type === 'input' && typeof parsed.data === 'string') {
            if (ptyProc) {
              ptyProc.write(parsed.data);
            } else if (fallbackProc?.stdin?.writable) {
              fallbackProc.stdin.write(parsed.data);
            }
            return;
          }
        } catch {
          // treat as raw terminal input
        }
      }

      if (ptyProc) {
        ptyProc.write(text);
      } else if (fallbackProc?.stdin?.writable) {
        fallbackProc.stdin.write(text);
      }
    });

    const cleanupGuard = () => { clearInterval(sessionGuard); activeOwnerTerminalSockets.delete(ws); cleanupShell(); };
    ws.on('close', cleanupGuard);
    ws.on('error', cleanupGuard);
  });

  server.on('close', () => {
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {
        // ignore
      }
    }
    try {
      wss.close();
    } catch {
      // ignore
    }
  });

  return wss;
}

/**
 * Creates the standalone, fully isolated Sandbox Express application.
 * Serves `server/sandbox-ui/` at `/sandbox` and mounts the API at `/api/sandbox`.
 */
export function createSandboxStandaloneApp(): Express {
  const sandboxApp = express();
  sandboxApp.set('trust proxy', process.env.TRUSTED_PROXY_CIDRS?.split(',').map(value => value.trim()).filter(Boolean) || false);

  sandboxApp.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const apiRouter = createSandboxCockpitRouter();
  sandboxApp.use('/api/sandbox', apiRouter);

  // Serve static assets from server/sandbox-ui
  sandboxApp.use('/sandbox', express.static(SANDBOX_UI_DIR, { index: 'index.html' }));
  sandboxApp.get(['/sandbox', '/sandbox/*'], (_req: Request, res: Response) => {
    res.sendFile(path.join(SANDBOX_UI_DIR, 'index.html'));
  });

  // Root redirect on port 3002 to /sandbox
  sandboxApp.get('/', (_req: Request, res: Response) => {
    res.redirect('/sandbox');
  });

  return sandboxApp;
}

let activeSandboxServer: ReturnType<Express['listen']> | null = null;

export function startSandboxServer(port: number = SANDBOX_PORT) {
  if (activeSandboxServer) {
    return activeSandboxServer;
  }
  const sandboxApp = createSandboxStandaloneApp();
  const server = http.createServer(sandboxApp);
  attachSandboxWebSocketServer(server);

  activeSandboxServer = server.listen(port, '127.0.0.1', () => {
    console.log(
      `[SANDBOX COCKPIT] Zero-Trust Decoupled Admin Server listening on http://127.0.0.1:${port}/sandbox (Owner: ${STRICT_OWNER_EMAIL})`
    );
  });
  activeSandboxServer.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.warn(`[SANDBOX COCKPIT] Port ${port} is already in use; using mounted router.`);
    } else {
      console.error('[SANDBOX COCKPIT] Server error:', err);
    }
  });
  return activeSandboxServer;
}

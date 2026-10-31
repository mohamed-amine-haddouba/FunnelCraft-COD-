import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns/promises';
import type { MxRecord } from 'node:dns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISPOSABLE_DOMAINS_PATH = path.resolve(__dirname, '../data/disposable_email_domains.json');

// Layer 1: Strict email syntax regex & length constraints
const EMAIL_SYNTAX_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Layer 2: Disposable domains loaded once at startup into a Set for O(1) lookup
const DISPOSABLE_DOMAINS_SET = new Set<string>();

function loadDisposableDomains(): void {
  try {
    if (fs.existsSync(DISPOSABLE_DOMAINS_PATH)) {
      const raw = fs.readFileSync(DISPOSABLE_DOMAINS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            DISPOSABLE_DOMAINS_SET.add(item.trim().toLowerCase());
          }
        }
      }
    }
  } catch (err) {
    console.error('[EMAIL VALIDATION] Failed to load disposable_email_domains.json:', err);
  }
}

loadDisposableDomains();

// Layer 3: Known placeholder / test / dev domains
const PLACEHOLDER_DOMAINS_SET = new Set<string>([
  'test.com',
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  'invalid',
  'test',
  'fake.com',
  'fakeemail.com',
  'email.com',
  'noemail.com',
  'mail.com',
  'temp.com',
  'sample.com',
  'foo.com',
  'bar.com',
  'asdf.com',
]);

// Layer 4: MX record check cache (1 hour TTL) and global rate limiter (20 lookups / minute)
interface MxCacheEntry {
  has_mx: boolean;
  expires_at: number;
}

const MX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MX_LOOKUP_TIMEOUT_MS = 1500; // 1.5 seconds
const MX_MAX_LOOKUPS_PER_MINUTE = 20;

const mxCache = new Map<string, MxCacheEntry>();
let mxLookupTimestamps: number[] = [];

export type MxResolverFn = (domain: string) => Promise<MxRecord[]>;
let customMxResolver: MxResolverFn | null = null;

export function setCustomMxResolverForTest(resolver: MxResolverFn | null): void {
  customMxResolver = resolver;
}

export function clearEmailValidationCacheForTest(): void {
  mxCache.clear();
  mxLookupTimestamps = [];
}

export function getDisposableDomainsCount(): number {
  return DISPOSABLE_DOMAINS_SET.size;
}

export interface EmailValidationResult {
  valid: boolean;
  normalizedEmail?: string;
  domain?: string;
  statusCode?: number;
  code?:
    | 'INVALID_EMAIL_SYNTAX'
    | 'DISPOSABLE_EMAIL_NOT_ALLOWED'
    | 'PLACEHOLDER_EMAIL_NOT_ALLOWED'
    | 'EMAIL_DOMAIN_HAS_NO_MX'
    | 'EMAIL_DOMAIN_CHECK_BUSY';
  error?: string;
  message_ar?: string;
  message_en?: string;
}

/**
 * Layer 1: Syntax and length check only.
 * Used on POST /api/auth/register, POST /api/auth/resend-verification, and POST /api/auth/forgot-password.
 */
export function validateEmailSyntax(rawEmail: unknown): EmailValidationResult {
  if (typeof rawEmail !== 'string') {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const trimmed = rawEmail.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (localPart.length > 64 || !EMAIL_SYNTAX_REGEX.test(trimmed)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  return {
    valid: true,
    normalizedEmail: trimmed,
    domain: domainPart,
  };
}

function isDisposableDomain(domain: string): boolean {
  const clean = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS_SET.has(clean)) {
    return true;
  }
  const parts = clean.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (DISPOSABLE_DOMAINS_SET.has(parentDomain)) {
      return true;
    }
  }
  return false;
}

function isPlaceholderDomain(domain: string): boolean {
  const clean = domain.toLowerCase();
  if (PLACEHOLDER_DOMAINS_SET.has(clean)) {
    return true;
  }
  const tld = clean.split('.').pop() || '';
  if (tld === 'invalid' || tld === 'test' || tld === 'example' || tld === 'localhost') {
    return true;
  }
  const parts = clean.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (PLACEHOLDER_DOMAINS_SET.has(parentDomain)) {
      return true;
    }
  }
  return false;
}

async function resolveMxWithTimeout(domain: string, timeoutMs: number): Promise<MxRecord[]> {
  const resolver = customMxResolver || ((d: string) => dns.resolveMx(d));
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('MX_LOOKUP_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    const records = await Promise.race([resolver(domain), timeoutPromise]);
    return Array.isArray(records) ? records : [];
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Full 4-layer validation used on POST /api/auth/register (Part B1 & B2).
 */
export async function validateRegistrationEmail(rawEmail: unknown): Promise<EmailValidationResult> {
  if (typeof rawEmail === 'string') {
    const trimmed = rawEmail.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex > 0 && atIndex < trimmed.length - 1) {
      const localPart = trimmed.slice(0, atIndex);
      const domainPart = trimmed.slice(atIndex + 1);
      if (
        localPart.length <= 64 &&
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart) &&
        isPlaceholderDomain(domainPart)
      ) {
        return {
          valid: false,
          statusCode: 400,
          code: 'PLACEHOLDER_EMAIL_NOT_ALLOWED',
          error: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
          message_ar: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
          message_en: 'Test or placeholder email domains are not allowed.',
        };
      }
    }
  }

  // Layer 1: Syntax and length check
  const syntaxCheck = validateEmailSyntax(rawEmail);
  if (!syntaxCheck.valid || !syntaxCheck.normalizedEmail || !syntaxCheck.domain) {
    return syntaxCheck;
  }

  const normalizedEmail = syntaxCheck.normalizedEmail;
  const domain = syntaxCheck.domain;

  // Layer 3 & Layer 2 check: Check placeholder domains & disposable domains
  if (isDisposableDomain(domain)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
      error: 'لا يمكن استخدام بريد مؤقت أو وهمي. الرجاء استخدام بريد حقيقي.',
      message_ar: 'لا يمكن استخدام بريد مؤقت أو وهمي. الرجاء استخدام بريد حقيقي.',
      message_en: 'Disposable or temporary email addresses are not allowed.',
    };
  }

  if (isPlaceholderDomain(domain)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'PLACEHOLDER_EMAIL_NOT_ALLOWED',
      error: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
      message_ar: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
      message_en: 'Test or placeholder email domains are not allowed.',
    };
  }

  // Layer 4: MX record check (runs in production; skipped when NODE_ENV !== 'production')
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[EMAIL VALIDATION] Skipping MX DNS check for "${domain}" because NODE_ENV !== 'production'`);
    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  }

  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && cached.expires_at > now) {
    if (!cached.has_mx) {
      return {
        valid: false,
        statusCode: 400,
        code: 'EMAIL_DOMAIN_HAS_NO_MX',
        error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_en: 'The email domain is invalid or cannot receive mail.',
      };
    }
    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  }

  // Global rate limit on uncached DNS lookups: max 20 lookups per minute
  mxLookupTimestamps = mxLookupTimestamps.filter((ts) => now - ts < 60_000);
  if (mxLookupTimestamps.length >= MX_MAX_LOOKUPS_PER_MINUTE) {
    return {
      valid: false,
      statusCode: 429,
      code: 'EMAIL_DOMAIN_CHECK_BUSY',
      error: 'خادم التحقق من النطاق مشغول حالياً. يرجى المحاولة بعد لحظات.',
      message_ar: 'خادم التحقق من النطاق مشغول حالياً. يرجى المحاولة بعد لحظات.',
      message_en: 'Email domain verification is busy. Please try again shortly.',
    };
  }
  mxLookupTimestamps.push(now);

  try {
    const records = await resolveMxWithTimeout(domain, MX_LOOKUP_TIMEOUT_MS);
    const hasValidMx =
      Array.isArray(records) &&
      records.length > 0 &&
      records.some((r) => typeof r?.exchange === 'string' && r.exchange.trim().length > 0);

    mxCache.set(domain, {
      has_mx: hasValidMx,
      expires_at: Date.now() + MX_CACHE_TTL_MS,
    });

    if (!hasValidMx) {
      return {
        valid: false,
        statusCode: 400,
        code: 'EMAIL_DOMAIN_HAS_NO_MX',
        error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_en: 'The email domain is invalid or cannot receive mail.',
      };
    }

    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  } catch (_err) {
    mxCache.set(domain, {
      has_mx: false,
      expires_at: Date.now() + MX_CACHE_TTL_MS,
    });
    return {
      valid: false,
      statusCode: 400,
      code: 'EMAIL_DOMAIN_HAS_NO_MX',
      error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
      message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
      message_en: 'The email domain is invalid or cannot receive mail.',
    };
  }
}

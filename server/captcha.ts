import dotenv from 'dotenv';

dotenv.config();

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const DEFAULT_OWNER_EMAIL = 'naadianajah2020@gmail.com';

let hasLoggedMissingCaptchaSecret = false;

export interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

export interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Checks whether CAPTCHA should be bypassed for the Platform Owner / Admin account.
 * CRITICAL: Even if BYPASS_CAPTCHA is false, if the user logging in is the Owner
 * (naadianajah2020@gmail.com) or role === 'admin', bypass the CAPTCHA check and return true.
 */
export function isAdminCaptchaBypass(email?: string | null, role?: string | null): boolean {
  const normalizedRole = (role || '').trim().toLowerCase();
  if (normalizedRole === 'admin') {
    return true;
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const configuredOwner = (process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  return (
    normalizedEmail === DEFAULT_OWNER_EMAIL ||
    (configuredOwner.length > 0 && normalizedEmail === configuredOwner)
  );
}

/**
 * Extracts the client IP address from an Express request, prioritizing Cloudflare / proxy headers.
 */
export function extractClientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }

  return req.ip;
}

/**
 * Verifies a Google reCAPTCHA v3 token against Google's siteverify endpoint.
 */
export async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string,
  expectedAction?: string,
  minScore = 0.5,
  email?: string,
  role?: string
): Promise<boolean> {
  if (isAdminCaptchaBypass(email, role)) {
    return true;
  }

  if (process.env.BYPASS_CAPTCHA === 'true') {
    console.warn('[CAPTCHA] BYPASS_CAPTCHA=true is active. Bypassing reCAPTCHA verification.');
    return true;
  }

  const secretKey = (process.env.RECAPTCHA_SECRET_KEY || '').trim();

  if (!secretKey) {
    console.error('[CAPTCHA][FATAL] RECAPTCHA_SECRET_KEY is missing at runtime. Rejecting.');
    return false;
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return false;
  }

  const cleanToken = token.trim();

  if (
    process.env.NODE_ENV !== 'production' &&
    (cleanToken === 'XXXX.DUMMY.TOKEN.XXXX' || cleanToken === 'dev-recaptcha-bypass')
  ) {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', cleanToken);
    if (remoteIp && remoteIp.trim()) {
      formData.append('remoteip', remoteIp.trim());
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(
        `[reCAPTCHA v3] HTTP error from siteverify endpoint: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const data = (await response.json()) as RecaptchaVerifyResponse;

    if (!data.success) {
      console.warn('[reCAPTCHA v3] Token verification failed:', data['error-codes'] || []);
      return false;
    }

    if (typeof data.score === 'number' && data.score < minScore) {
      console.warn(
        `[reCAPTCHA v3] Score too low (${data.score} < ${minScore}) for action "${data.action || expectedAction || 'unknown'}"`
      );
      return false;
    }

    if (expectedAction && data.action && data.action !== expectedAction) {
      console.warn(
        `[reCAPTCHA v3] Action mismatch: expected "${expectedAction}", received "${data.action}"`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error('[reCAPTCHA v3] Unexpected error verifying token:', err);
    return false;
  }
}

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify endpoint.
 *
 * - Reads TURNSTILE_SECRET_KEY from .env.
 * - If process.env.BYPASS_CAPTCHA === 'true', logs a warning and returns true.
 * - If the user is Owner (naadianajah2020@gmail.com) or role === 'admin', bypasses CAPTCHA and returns true.
 * - Fails closed (returns false) if secret key is missing.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
  email?: string,
  role?: string
): Promise<boolean> {
  if (isAdminCaptchaBypass(email, role)) {
    return true;
  }

  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();

  if (process.env.BYPASS_CAPTCHA === 'true') {
    console.warn('[Turnstile] BYPASS_CAPTCHA=true is active in .env. Bypassing Turnstile verification.');
    return true;
  }

  // If RECAPTCHA_SECRET_KEY is configured instead of TURNSTILE_SECRET_KEY, delegate to reCAPTCHA v3
  if (!secretKey && (process.env.RECAPTCHA_SECRET_KEY || '').trim()) {
    return verifyRecaptchaToken(token, remoteIp, undefined, 0.5, email, role);
  }

  if (!secretKey) {
    console.error('[CAPTCHA][FATAL] TURNSTILE_SECRET_KEY is missing at runtime. Rejecting.');
    return false;
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return false;
  }

  const cleanToken = token.trim();

  // Support Cloudflare's official dummy test token in non-production environments
  if (
    process.env.NODE_ENV !== 'production' &&
    (cleanToken === 'XXXX.DUMMY.TOKEN.XXXX' || cleanToken === 'dev-turnstile-bypass')
  ) {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', cleanToken);
    if (remoteIp && remoteIp.trim()) {
      formData.append('remoteip', remoteIp.trim());
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(
        `[Turnstile] HTTP error from siteverify endpoint: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      console.warn('[Turnstile] Token verification failed:', data['error-codes'] || []);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Turnstile] Unexpected error verifying token:', err);
    return false;
  }
}

/**
 * Unified CAPTCHA verifier supporting both Cloudflare Turnstile and Google reCAPTCHA v3.
 * - Reads TURNSTILE_SECRET_KEY / RECAPTCHA_SECRET_KEY from .env.
 * - If process.env.BYPASS_CAPTCHA === 'true', logs a warning and returns true.
 * - CRITICAL: Even if BYPASS_CAPTCHA is false, if the user logging in is the Owner
 *   (naadianajah2020@gmail.com) or role === 'admin', bypasses CAPTCHA and returns true.
 * - Fails closed (returns false) when neither secret is configured.
 */
export async function verifyCaptchaToken(options: {
  recaptchaToken?: string;
  turnstileToken?: string;
  captchaToken?: string;
  remoteIp?: string;
  expectedAction?: string;
  email?: string | null;
  role?: string | null;
}): Promise<boolean> {
  const turnstileSecretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  const recaptchaSecretKey = (process.env.RECAPTCHA_SECRET_KEY || '').trim();

  // 1. CRITICAL: Always bypass CAPTCHA for Owner (naadianajah2020@gmail.com) or Admin (role === 'admin')
  if (isAdminCaptchaBypass(options.email, options.role)) {
    return true;
  }

  // 2. Environment variable bypass (BYPASS_CAPTCHA=true)
  if (process.env.BYPASS_CAPTCHA === 'true') {
    console.warn('[CAPTCHA] BYPASS_CAPTCHA=true is enabled. Returning true without blocking login.');
    return true;
  }

  if (turnstileSecretKey) {
    const tokenToVerify =
      options.turnstileToken || options.captchaToken || options.recaptchaToken || '';
    return verifyTurnstileToken(
      tokenToVerify,
      options.remoteIp,
      options.email || undefined,
      options.role || undefined
    );
  }

  if (recaptchaSecretKey) {
    const tokenToVerify =
      options.recaptchaToken || options.captchaToken || options.turnstileToken || '';
    return verifyRecaptchaToken(
      tokenToVerify,
      options.remoteIp,
      options.expectedAction,
      0.5,
      options.email || undefined,
      options.role || undefined
    );
  }

  if (!hasLoggedMissingCaptchaSecret) {
    console.error(
      '[CAPTCHA] No CAPTCHA secret configured (TURNSTILE_SECRET_KEY / RECAPTCHA_SECRET_KEY). All CAPTCHA checks will FAIL CLOSED.'
    );
    hasLoggedMissingCaptchaSecret = true;
  }
  return false;
}

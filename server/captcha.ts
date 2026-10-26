import dotenv from 'dotenv';

dotenv.config();

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

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
 *
 * - If RECAPTCHA_SECRET_KEY is not configured in environment variables, logs a warning
 *   and returns true so local development/testing is not blocked.
 * - Enforces a minimum human score threshold (default 0.5).
 */
export async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string,
  expectedAction?: string,
  minScore = 0.5
): Promise<boolean> {
  const secretKey = (process.env.RECAPTCHA_SECRET_KEY || '').trim();

  if (!secretKey) {
    console.warn(
      '[reCAPTCHA v3] RECAPTCHA_SECRET_KEY is not configured. Skipping server-side reCAPTCHA check.'
    );
    return true;
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
 * - If TURNSTILE_SECRET_KEY is not configured in environment variables, logs a warning
 *   and returns true so local development/testing is not blocked.
 * - If token is missing when secret key is configured, returns false.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<boolean> {
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();

  // If RECAPTCHA_SECRET_KEY is configured instead of TURNSTILE_SECRET_KEY, delegate to reCAPTCHA v3
  if (!secretKey && (process.env.RECAPTCHA_SECRET_KEY || '').trim()) {
    return verifyRecaptchaToken(token, remoteIp);
  }

  // Graceful fallback when TURNSTILE_SECRET_KEY is not configured in dev/preview environment
  if (!secretKey) {
    console.warn(
      '[Turnstile] TURNSTILE_SECRET_KEY is not configured. Skipping server-side CAPTCHA check.'
    );
    return true;
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
 * Unified CAPTCHA verifier supporting both Google reCAPTCHA v3 and Cloudflare Turnstile.
 */
export async function verifyCaptchaToken(options: {
  recaptchaToken?: string;
  turnstileToken?: string;
  captchaToken?: string;
  remoteIp?: string;
  expectedAction?: string;
}): Promise<boolean> {
  const hasRecaptchaSecret = Boolean((process.env.RECAPTCHA_SECRET_KEY || '').trim());
  const hasTurnstileSecret = Boolean((process.env.TURNSTILE_SECRET_KEY || '').trim());

  if (hasRecaptchaSecret) {
    const tokenToVerify =
      options.recaptchaToken || options.captchaToken || options.turnstileToken || '';
    return verifyRecaptchaToken(tokenToVerify, options.remoteIp, options.expectedAction);
  }

  if (hasTurnstileSecret) {
    const tokenToVerify =
      options.turnstileToken || options.captchaToken || options.recaptchaToken || '';
    return verifyTurnstileToken(tokenToVerify, options.remoteIp);
  }

  return true;
}

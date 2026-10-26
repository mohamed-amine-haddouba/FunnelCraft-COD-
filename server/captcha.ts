import dotenv from 'dotenv';

dotenv.config();

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

/**
 * Extracts the client IP address from an Express request, prioritizing Cloudflare headers.
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

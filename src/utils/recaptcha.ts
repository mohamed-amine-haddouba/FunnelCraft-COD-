/**
 * Google reCAPTCHA v3 Client-Side Utility
 *
 * Uses VITE_RECAPTCHA_SITE_KEY from environment variables.
 * If VITE_RECAPTCHA_SITE_KEY is not set, executeRecaptcha gracefully returns undefined
 * so local development or Turnstile-only setups continue to work seamlessly.
 */

interface GrecaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

interface RecaptchaWindow extends Window {
  grecaptcha?: GrecaptchaInstance;
}

const RECAPTCHA_SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
const RECAPTCHA_SCRIPT_ID = 'google-recaptcha-v3-script';

let scriptLoadPromise: Promise<void> | null = null;

export function isRecaptchaConfigured(): boolean {
  return Boolean(RECAPTCHA_SITE_KEY);
}

/**
 * Dynamically injects the Google reCAPTCHA v3 script if VITE_RECAPTCHA_SITE_KEY is configured.
 */
export function preloadRecaptchaScript(): Promise<void> {
  if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  const win = window as unknown as RecaptchaWindow;
  if (win.grecaptcha && typeof win.grecaptcha.execute === 'function') {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve) => {
    const existing = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (win.grecaptcha) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn('[reCAPTCHA v3] Failed to load Google reCAPTCHA script.');
      resolve();
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Executes Google reCAPTCHA v3 for a specific action ('login', 'register', 'forgot_password', 'cod_checkout')
 * and returns the generated token.
 */
export async function executeRecaptcha(action: string): Promise<string | undefined> {
  if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') {
    return undefined;
  }

  try {
    await preloadRecaptchaScript();
    const win = window as unknown as RecaptchaWindow;

    if (!win.grecaptcha || typeof win.grecaptcha.ready !== 'function') {
      return undefined;
    }

    return await new Promise<string | undefined>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        console.warn('[reCAPTCHA v3] Token generation timed out.');
        resolve(undefined);
      }, 6000);

      try {
        win.grecaptcha!.ready(async () => {
          try {
            const token = await win.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action });
            window.clearTimeout(timeoutId);
            resolve(token || undefined);
          } catch (err) {
            window.clearTimeout(timeoutId);
            console.warn('[reCAPTCHA v3] execute() error:', err);
            resolve(undefined);
          }
        });
      } catch (err) {
        window.clearTimeout(timeoutId);
        console.warn('[reCAPTCHA v3] ready() error:', err);
        resolve(undefined);
      }
    });
  } catch (err) {
    console.warn('[reCAPTCHA v3] Unexpected error:', err);
    return undefined;
  }
}

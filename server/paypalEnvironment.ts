/**
 * PayPal must never enter live mode merely because the Node server runs in
 * production mode: staging commonly uses NODE_ENV=production as well.
 */
export function resolvePayPalEnvironment(rawValue?: string): 'sandbox' | 'live' {
  const value = (rawValue || '').trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  if (!value || value === 'sandbox') return 'sandbox';
  if (value === 'live' || value === 'production' || value === 'prod') return 'live';
  throw new Error('Invalid PAYPAL_ENVIRONMENT; use sandbox or live explicitly.');
}

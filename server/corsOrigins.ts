/**
 * Credentialed cross-origin access is limited to explicitly trusted origins.
 * Public no-Origin requests (e.g. curl, same-origin page loads) are unaffected.
 */
export function isAllowedCorsOrigin(origin: string | undefined, config: {
  appOrigin?: string;
  extraOrigins?: string;
  production: boolean;
}): boolean {
  if (!origin) return true;
  const allowed = [config.appOrigin, ...(config.extraOrigins || '').split(',')]
    .map(value => (value || '').trim())
    .filter(Boolean);
  if (!config.production) {
    allowed.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173');
  }
  try {
    const incoming = new URL(origin);
    if (!['http:', 'https:'].includes(incoming.protocol) || incoming.origin !== origin || incoming.username || incoming.password) return false;
    if (config.production && incoming.protocol !== 'https:') return false;
    return allowed.some(value => {
      try {
        const trusted = new URL(value);
        return trusted.origin === incoming.origin && trusted.origin === value.replace(/\/$/, '');
      } catch { return false; }
    });
  } catch { return false; }
}

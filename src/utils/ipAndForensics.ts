import net from 'node:net';

export type SecurityAuthMethod = 'password' | 'google_oauth' | 'sandbox_owner';
export type SecurityLoginStatus = 'SUCCESS' | 'FAILED';

export interface SecurityLoginAuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  ipAddress: string;
  location?: string;
  userAgent: string;
  deviceSummary?: string;
  authMethod: SecurityAuthMethod;
  status: SecurityLoginStatus;
  failureReason?: string | null;
}

export const MAX_SECURITY_LOGIN_AUDIT_ENTRIES = 5000;

/**
 * Sanitizes and validates a candidate IP string (IPv4 or IPv6) to prevent
 * HTTP header injection, CRLF injection, XSS payloads, or malformed values.
 */
export function sanitizeIpString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  // Strip control characters, whitespace, and take only the first comma-separated hop
  let candidate = raw
    .replace(/[\r\n\0\t]/g, '')
    .split(',')[0]
    .trim();

  if (!candidate || candidate.length > 64) return null;

  // Strip IPv4-mapped IPv6 prefix (e.g. ::ffff:203.0.113.195 -> 203.0.113.195)
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const ipv4Part = candidate.slice(7);
    if (net.isIPv4(ipv4Part)) {
      return ipv4Part;
    }
  }

  // Strip brackets and port from bracketed IPv6 like [2001:db8::1]:44321
  const bracketMatch = candidate.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
  if (bracketMatch) {
    candidate = bracketMatch[1];
  } else if (candidate.includes('.') && candidate.includes(':')) {
    // Strip port from IPv4:port (e.g. 203.0.113.50:54321)
    const lastColon = candidate.lastIndexOf(':');
    const hostPart = candidate.slice(0, lastColon);
    if (net.isIPv4(hostPart)) {
      candidate = hostPart;
    }
  }

  // Strip IPv6 zone index (e.g. fe80::1%eth0)
  if (candidate.includes('%')) {
    candidate = candidate.split('%')[0];
  }

  // Normalize IPv6 loopback ::1 to 127.0.0.1 for consistency when local
  if (candidate === '::1') {
    return '127.0.0.1';
  }

  const ipVersion = net.isIP(candidate);
  if (ipVersion === 4 || ipVersion === 6) {
    return candidate;
  }

  return null;
}

/**
 * Extracts and validates the real public client IP address from an Express/HTTP request.
 * Priority order:
 * 1. req.headers['cf-connecting-ip'] (Cloudflare edge header)
 * 2. req.headers['x-real-ip'] (Nginx X-Real-IP header)
 * 3. req.headers['x-forwarded-for'] (First client hop in proxy chain)
 * 4. req.ip (Express trust proxy resolved IP)
 * 5. req.socket?.remoteAddress
 */
export function getClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
}): string {
  const headers = req?.headers || {};

  const readHeader = (name: string): string | undefined => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return typeof val === 'string' ? val : undefined;
  };

  // 1. Cloudflare CF-Connecting-IP
  const cfIp = sanitizeIpString(readHeader('cf-connecting-ip'));
  if (cfIp) return cfIp;

  // 2. X-Forwarded-For (first hop is the original client IP)
  const xffRaw = readHeader('x-forwarded-for');
  if (typeof xffRaw === 'string' && xffRaw.trim()) {
    const hops = xffRaw.split(',');
    for (const hop of hops) {
      const cleanHop = sanitizeIpString(hop);
      if (cleanHop) return cleanHop;
    }
  }

  // 3. Nginx X-Real-IP
  const realIp = sanitizeIpString(readHeader('x-real-ip'));
  if (realIp) return realIp;

  // 4. Express req.ip (populated via app.set('trust proxy', 1))
  const expressIp = sanitizeIpString(req?.ip);
  if (expressIp) return expressIp;

  // 5. Socket remoteAddress fallback
  const socketIp = sanitizeIpString(req?.socket?.remoteAddress);
  if (socketIp) return socketIp;

  return '0.0.0.0';
}

/**
 * Extracts a clean geolocation label from proxy headers (Cloudflare / Nginx GeoIP)
 * or infers local/network status without making blocking external requests.
 */
export function resolveClientGeoLocation(
  req: { headers?: Record<string, string | string[] | undefined> },
  ipAddress: string
): string {
  const headers = req?.headers || {};
  const readHeader = (name: string): string => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    const str = Array.isArray(val) ? val[0] : val;
    return typeof str === 'string'
      ? str.replace(/[\r\n<>]/g, '').trim().slice(0, 64)
      : '';
  };

  const country =
    readHeader('cf-ipcountry') ||
    readHeader('x-vercel-ip-country') ||
    readHeader('x-geo-country') ||
    readHeader('x-country-code');
  const city =
    readHeader('cf-ipcity') ||
    readHeader('x-vercel-ip-city') ||
    readHeader('x-geo-city');

  if (city && country && country !== 'XX') {
    return `${city}, ${country}`;
  }
  if (country && country !== 'XX') {
    return country;
  }

  if (
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress)
  ) {
    return 'Internal / Reverse Proxy Network';
  }

  return 'Public Network (Direct/Proxy)';
}

/**
 * Sanitizes User-Agent strings and produces a human-readable Browser + OS summary.
 */
export function parseUserAgentInfo(rawUserAgent: unknown): {
  userAgent: string;
  browser: string;
  os: string;
  deviceSummary: string;
} {
  const ua =
    typeof rawUserAgent === 'string' && rawUserAgent.trim()
      ? rawUserAgent.replace(/[\r\n<>]/g, '').trim().slice(0, 300)
      : 'Unknown User-Agent';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/curl\//i.test(ua)) browser = 'curl CLI';
  else if (/PostmanRuntime/i.test(ua)) browser = 'Postman';

  let os = 'OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return {
    userAgent: ua,
    browser,
    os,
    deviceSummary: `${browser} on ${os}`,
  };
}

const FORENSIC_SENSITIVE_KEY_REGEX =
  /password|pass|pwd|secret|token|csrf|otp|cookie|authorization|credential|hash|salt|pat|key/i;

/**
 * Redacts any sensitive fields (passwords, tokens, CSRF secrets, OTPs, cookies)
 * from an arbitrary object before writing to any forensic audit log.
 */
export function redactForensicSensitiveData<T extends Record<string, unknown>>(input: T): T {
  if (!input || typeof input !== 'object') return input;
  const clone: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(input)) {
    if (FORENSIC_SENSITIVE_KEY_REGEX.test(k)) {
      clone[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      clone[k] = v
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
        .replace(/sandbox_sid=[a-f0-9]+/gi, 'sandbox_sid=[REDACTED]')
        .replace(/sandbox_csrf=[a-f0-9]+/gi, 'sandbox_csrf=[REDACTED]');
    } else if (v && typeof v === 'object') {
      clone[k] = redactForensicSensitiveData(v as Record<string, unknown>);
    } else {
      clone[k] = v;
    }
  }
  return clone as T;
}

/**
 * Rotates/slices the forensic login audit array so it never exceeds `maxEntries` (default 5,000),
 * keeping the most recent entries in newest-first order.
 */
export function capSecurityAuditEntries(
  entries: SecurityLoginAuditEntry[],
  maxEntries: number = MAX_SECURITY_LOGIN_AUDIT_ENTRIES
): SecurityLoginAuditEntry[] {
  if (!Array.isArray(entries)) return [];
  if (entries.length <= maxEntries) return entries;
  return entries.slice(0, maxEntries);
}

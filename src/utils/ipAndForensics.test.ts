import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getClientIp,
  sanitizeIpString,
  redactForensicSensitiveData,
  capSecurityAuditEntries,
  parseUserAgentInfo,
  SecurityLoginAuditEntry,
} from './ipAndForensics';

describe('Zero-Trust Public IP Resolution & Sanitization (getClientIp)', () => {
  it('prioritizes cf-connecting-ip when present and valid', () => {
    const ip = getClientIp({
      headers: {
        'cf-connecting-ip': '196.200.145.22',
        'x-forwarded-for': '10.0.0.1, 172.16.0.1',
      },
      ip: '127.0.0.1',
    });
    assert.equal(ip, '196.200.145.22');
  });

  it('extracts the first valid public client IP from x-forwarded-for chain', () => {
    const ip = getClientIp({
      headers: {
        'x-forwarded-for': '105.159.24.88, 172.68.10.2, 127.0.0.1',
      },
      ip: '127.0.0.1',
    });
    assert.equal(ip, '105.159.24.88');
  });

  it('strips IPv4-mapped IPv6 prefix (::ffff:) and ports cleanly', () => {
    assert.equal(sanitizeIpString('::ffff:217.160.116.237'), '217.160.116.237');
    assert.equal(sanitizeIpString('217.160.116.237:54123'), '217.160.116.237');
    assert.equal(sanitizeIpString('[2001:4860:4860::8888]:443'), '2001:4860:4860::8888');
  });

  it('handles full IPv6 addresses and rejects header injection / XSS payloads', () => {
    assert.equal(
      getClientIp({
        headers: {
          'x-forwarded-for': '2a01:e0a:123:4560::1',
        },
      }),
      '2a01:e0a:123:4560::1'
    );

    // Malicious header injection attempt falls back to valid req.ip
    const injected = getClientIp({
      headers: {
        'x-forwarded-for': '<script>alert(1)</script>; DROP TABLE users;',
      },
      ip: '::ffff:41.140.20.10',
    });
    assert.equal(injected, '41.140.20.10');
  });
});

describe('Forensic Audit Redaction & 5,000-Entry Rotation', () => {
  it('redacts passwords, tokens, CSRF secrets, and cookies from forensic objects', () => {
    const raw = {
      userEmail: 'merchant@codworth.me',
      password: 'SuperSecretPassword123!',
      csrfToken: 'abcdef1234567890',
      otpCode: '482910',
      nested: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        note: 'Cookie sandbox_sid=9876543210abcdef in request',
      },
    };

    const redacted = redactForensicSensitiveData(raw);
    assert.equal(redacted.userEmail, 'merchant@codworth.me');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.csrfToken, '[REDACTED]');
    assert.equal(redacted.otpCode, '[REDACTED]');
    assert.equal(redacted.nested.authorization, '[REDACTED]');
    assert.ok(!String(redacted.nested.note).includes('9876543210abcdef'));
  });

  it('rotates and caps security login audit log to maximum 5,000 entries', () => {
    const entries: SecurityLoginAuditEntry[] = Array.from({ length: 5050 }, (_, idx) => ({
      id: `audit-${idx}`,
      timestamp: new Date().toISOString(),
      userEmail: `user${idx}@example.com`,
      ipAddress: '217.160.116.237',
      userAgent: 'Mozilla/5.0',
      authMethod: 'password',
      status: 'SUCCESS',
      failureReason: null,
    }));

    const capped = capSecurityAuditEntries(entries, 5000);
    assert.equal(capped.length, 5000);
    assert.equal(capped[0].id, 'audit-0');
    assert.equal(capped[4999].id, 'audit-4999');
  });

  it('parses User-Agent strings into clean browser and OS summaries', () => {
    const info = parseUserAgentInfo(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    assert.equal(info.browser, 'Chrome');
    assert.equal(info.os, 'macOS');
    assert.equal(info.deviceSummary, 'Chrome on macOS');
  });
});

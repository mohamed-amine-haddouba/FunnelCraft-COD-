import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createSandboxStandaloneApp,
  signSandboxJwt,
  verifySandboxJwt,
  signSandboxLoginTicket,
  verifySandboxLoginTicket,
  getSandboxJwtSecret,
  JWT_TTL_SECONDS,
  LOGIN_TICKET_TTL_SECONDS,
  validateAndParseSafeCommand,
  STRICT_OWNER_EMAIL,
  sandboxResetTokens,
  SANDBOX_RESET_TOKEN_TTL_MS,
} from './sandboxNew';
import { ensureOwnerAccountForEmail } from './db';

describe('Zero-Trust Sandbox Cockpit (server/sandboxNew.ts)', () => {
  let server: http.Server;
  let baseUrl = '';
  const TEST_OWNER_PASS = 'OwnerCockpitTest#2026';
  const prevJwtSecret = process.env.SANDBOX_JWT_SECRET;

  before(async () => {
    process.env.SANDBOX_JWT_SECRET = 'test-sandbox-jwt-secret-key-at-least-32-chars-long-2026';
    ensureOwnerAccountForEmail(STRICT_OWNER_EMAIL, TEST_OWNER_PASS);
    const app = createSandboxStandaloneApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (prevJwtSecret !== undefined) {
      process.env.SANDBOX_JWT_SECRET = prevJwtSecret;
    } else {
      delete process.env.SANDBOX_JWT_SECRET;
    }
  });

  it('signs and verifies owner JWTs, enforces 30m TTL, and throws if SANDBOX_JWT_SECRET is missing or < 32 chars', () => {
    assert.equal(JWT_TTL_SECONDS, 30 * 60);

    const saved = process.env.SANDBOX_JWT_SECRET;
    try {
      delete process.env.SANDBOX_JWT_SECRET;
      assert.throws(() => getSandboxJwtSecret(), /SANDBOX_JWT_SECRET/);

      process.env.SANDBOX_JWT_SECRET = 'too-short-secret';
      assert.throws(() => getSandboxJwtSecret(), /SANDBOX_JWT_SECRET/);
    } finally {
      process.env.SANDBOX_JWT_SECRET = saved;
    }

    const { token } = signSandboxJwt(STRICT_OWNER_EMAIL, 3600);
    const verified = verifySandboxJwt(token);
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.email, STRICT_OWNER_EMAIL);

    // Non-owner token must fail with NOT_OWNER
    const nonOwner = signSandboxJwt('attacker@example.com', 3600);
    const nonOwnerCheck = verifySandboxJwt(nonOwner.token);
    assert.equal(nonOwnerCheck.valid, false);
    assert.equal(nonOwnerCheck.reason, 'NOT_OWNER');

    // Tampered token must fail with BAD_SIGNATURE
    const tampered = `${token.slice(0, -4)}aaaa`;
    const tamperedCheck = verifySandboxJwt(tampered);
    assert.equal(tamperedCheck.valid, false);

    // 5-minute loginTicket must have sub='2fa_pending' and MUST NOT pass verifySandboxJwt
    assert.equal(LOGIN_TICKET_TTL_SECONDS, 5 * 60);
    const { loginTicket, payload: ticketPayload } = signSandboxLoginTicket(STRICT_OWNER_EMAIL);
    assert.equal(ticketPayload.sub, '2fa_pending');
    const verifiedTicket = verifySandboxLoginTicket(loginTicket);
    assert.equal(verifiedTicket.valid, true);
    assert.equal(verifiedTicket.payload?.email, STRICT_OWNER_EMAIL);
    assert.equal(verifySandboxJwt(loginTicket).valid, false);
  });

  it('enforces Safe Terminal command whitelist and blocks destructive / shell-injection inputs', () => {
    assert.equal(validateAndParseSafeCommand('ls -la').allowed, true);
    assert.equal(validateAndParseSafeCommand('pm2 list').allowed, true);
    assert.equal(validateAndParseSafeCommand('df -h').allowed, true);
    assert.equal(validateAndParseSafeCommand('free -m').allowed, true);
    assert.equal(validateAndParseSafeCommand('cat deploy.sh').allowed, true);
    assert.equal(validateAndParseSafeCommand('tail -n 20 data/plans.json').allowed, true);

    // Blocked commands
    assert.equal(validateAndParseSafeCommand('rm -rf /').allowed, false);
    assert.equal(validateAndParseSafeCommand('mv data/users.json /tmp/x').allowed, false);
    assert.equal(validateAndParseSafeCommand('bash -i').allowed, false);
    assert.equal(validateAndParseSafeCommand('ls -la; cat .env').allowed, false);
    assert.equal(validateAndParseSafeCommand('cat .env').allowed, false);
    assert.equal(validateAndParseSafeCommand('cat ../../etc/passwd').allowed, false);
  });

  it('serves standalone HTML at /sandbox without depending on dist/', async () => {
    const res = await fetch(`${baseUrl}/sandbox`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('CodWorth Admin Sandbox'));
    assert.ok(html.includes('/sandbox/app.js'));
    assert.ok(html.includes('id="login-step-1"'));
    assert.ok(html.includes('id="login-step-2"'));
    assert.ok(html.includes('id="reset-view"'));
  });

  it('returns 403 Forbidden for any non-owner email on POST /api/sandbox/login', async () => {
    const res = await fetch(`${baseUrl}/api/sandbox/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'merchant@example.com',
        password: TEST_OWNER_PASS,
      }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { ok: boolean; code: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, 'FORBIDDEN_OWNER_ONLY');
  });

  it('authenticates naadianajah2020@gmail.com and accesses status, logs, terminal, security logins, and backup', async () => {
    const loginRes = await fetch(`${baseUrl}/api/sandbox/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: STRICT_OWNER_EMAIL,
        password: TEST_OWNER_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as { ok: boolean; token: string };
    assert.equal(loginData.ok, true);
    assert.ok(loginData.token);

    const authHeaders = {
      Authorization: `Bearer ${loginData.token}`,
      'Content-Type': 'application/json',
    };

    // Status
    const statusRes = await fetch(`${baseUrl}/api/sandbox/status`, { headers: authHeaders });
    assert.equal(statusRes.status, 200);
    const statusData = (await statusRes.json()) as any;
    assert.equal(statusData.ok, true);
    assert.equal(statusData.service.name, 'funnelcraft-api');
    assert.ok(statusData.memory.totalMb > 0);

    // Logs
    const logsRes = await fetch(`${baseUrl}/api/sandbox/logs/funnelcraft-api`, {
      headers: authHeaders,
    });
    assert.equal(logsRes.status, 200);
    const logsData = (await logsRes.json()) as any;
    assert.equal(logsData.ok, true);

    // Safe Terminal allowed command
    const termOkRes = await fetch(`${baseUrl}/api/sandbox/terminal`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ command: 'df -h' }),
    });
    assert.equal(termOkRes.status, 200);

    // Safe Terminal blocked command
    const termBlockRes = await fetch(`${baseUrl}/api/sandbox/terminal`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ command: 'rm -rf data' }),
    });
    assert.equal(termBlockRes.status, 403);

    // Security Audit Logins
    const secRes = await fetch(`${baseUrl}/api/sandbox/security/logins`, { headers: authHeaders });
    assert.equal(secRes.status, 200);
    const secData = (await secRes.json()) as any;
    assert.equal(secData.ok, true);
    assert.ok(Array.isArray(secData.logins));
    assert.ok(secData.logins.length >= 1);

    // Backup tar.gz stream
    const backupRes = await fetch(`${baseUrl}/api/sandbox/backup`, { headers: authHeaders });
    assert.equal(backupRes.status, 200);
    assert.equal(backupRes.headers.get('content-type'), 'application/gzip');
    const buf = await backupRes.arrayBuffer();
    assert.ok(buf.byteLength > 20);
  });

  it('enforces owner-only forgot-password, 15m token TTL, password length >= 8, single-use token deletion, and updates owner password', async () => {
    assert.equal(SANDBOX_RESET_TOKEN_TTL_MS, 15 * 60 * 1000);
    sandboxResetTokens.clear();

    // Non-owner must get 403
    const nonOwnerForgot = await fetch(`${baseUrl}/api/sandbox/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intruder@example.com' }),
    });
    assert.equal(nonOwnerForgot.status, 403);
    assert.equal(sandboxResetTokens.size, 0);

    // Owner request generates 32-byte (64 hex chars) token with 15m expiry
    const ownerForgot = await fetch(`${baseUrl}/api/sandbox/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: STRICT_OWNER_EMAIL }),
    });
    assert.equal(ownerForgot.status, 200);
    assert.equal(sandboxResetTokens.size, 1);

    const [issuedToken, tokenEntry] = Array.from(sandboxResetTokens.entries())[0];
    assert.equal(issuedToken.length, 64);
    assert.equal(tokenEntry.email, STRICT_OWNER_EMAIL);
    assert.equal(tokenEntry.used, false);
    assert.ok(tokenEntry.expiresAt > Date.now() + 14 * 60 * 1000);

    // Reject password shorter than 8 characters without consuming the token
    const shortPassRes = await fetch(`${baseUrl}/api/sandbox/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: issuedToken, newPassword: 'short' }),
    });
    assert.equal(shortPassRes.status, 400);
    assert.equal(sandboxResetTokens.has(issuedToken), true);

    // Valid password reset updates owner password and deletes token
    const newOwnerPassword = 'UpdatedOwnerPass#2026!';
    const validResetRes = await fetch(`${baseUrl}/api/sandbox/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: issuedToken, newPassword: newOwnerPassword }),
    });
    assert.equal(validResetRes.status, 200);
    assert.equal(sandboxResetTokens.has(issuedToken), false);

    // Reusing the same token must fail
    const reuseRes = await fetch(`${baseUrl}/api/sandbox/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: issuedToken, newPassword: 'AnotherPassword#2026' }),
    });
    assert.equal(reuseRes.status, 400);

    // Verify login works with the new password
    const loginNewRes = await fetch(`${baseUrl}/api/sandbox/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: STRICT_OWNER_EMAIL, password: newOwnerPassword }),
    });
    assert.equal(loginNewRes.status, 200);

    // Restore original test owner password
    ensureOwnerAccountForEmail(STRICT_OWNER_EMAIL, TEST_OWNER_PASS);
  });

  it('enforces 2-step login wizard (Step 1 loginTicket -> Step 2 /api/sandbox/login/2fa -> full JWT) when SANDBOX_REQUIRE_2FA=true', async () => {
    const prevRequire2FA = process.env.SANDBOX_REQUIRE_2FA;
    const prev2faPin = process.env.SANDBOX_2FA_PIN;
    process.env.SANDBOX_REQUIRE_2FA = 'true';
    process.env.SANDBOX_2FA_PIN = '654321';

    try {
      // Step 1: POST /api/sandbox/login returns requires2FA: true + loginTicket (no full token)
      const step1Res = await fetch(`${baseUrl}/api/sandbox/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: STRICT_OWNER_EMAIL,
          password: TEST_OWNER_PASS,
        }),
      });
      assert.equal(step1Res.status, 200);
      const step1Data = (await step1Res.json()) as {
        ok: boolean;
        requires2FA?: boolean;
        loginTicket?: string;
        token?: string;
      };
      assert.equal(step1Data.ok, true);
      assert.equal(step1Data.requires2FA, true);
      assert.ok(step1Data.loginTicket);
      assert.equal(step1Data.token, undefined);

      // loginTicket cannot be used directly as a Bearer token on /api/sandbox/status
      const bypassAttempt = await fetch(`${baseUrl}/api/sandbox/status`, {
        headers: { Authorization: `Bearer ${step1Data.loginTicket}` },
      });
      assert.equal(bypassAttempt.status, 401);

      // Step 2 with wrong 2FA code returns 401
      const wrongCodeRes = await fetch(`${baseUrl}/api/sandbox/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginTicket: step1Data.loginTicket,
          totpCode: '000000',
        }),
      });
      assert.equal(wrongCodeRes.status, 401);

      // Step 2 with valid 2FA code returns 200 and full Sandbox JWT
      const step2Res = await fetch(`${baseUrl}/api/sandbox/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginTicket: step1Data.loginTicket,
          totpCode: '654321',
        }),
      });
      assert.equal(step2Res.status, 200);
      const step2Data = (await step2Res.json()) as {
        ok: boolean;
        token: string;
        owner: { email: string; role: string };
      };
      assert.equal(step2Data.ok, true);
      assert.ok(step2Data.token);
      assert.equal(step2Data.owner.email, STRICT_OWNER_EMAIL);

      // Full JWT works on protected routes
      const statusRes = await fetch(`${baseUrl}/api/sandbox/status`, {
        headers: { Authorization: `Bearer ${step2Data.token}` },
      });
      assert.equal(statusRes.status, 200);
    } finally {
      if (prevRequire2FA !== undefined) {
        process.env.SANDBOX_REQUIRE_2FA = prevRequire2FA;
      } else {
        delete process.env.SANDBOX_REQUIRE_2FA;
      }
      if (prev2faPin !== undefined) {
        process.env.SANDBOX_2FA_PIN = prev2faPin;
      } else {
        delete process.env.SANDBOX_2FA_PIN;
      }
    }
  });
});


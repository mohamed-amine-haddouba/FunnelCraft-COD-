import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createSandboxStandaloneApp,
  signSandboxJwt,
  verifySandboxJwt,
  validateAndParseSafeCommand,
  STRICT_OWNER_EMAIL,
} from './sandboxNew';
import { ensureOwnerAccountForEmail } from './db';

describe('Zero-Trust Sandbox Cockpit (server/sandboxNew.ts)', () => {
  let server: http.Server;
  let baseUrl = '';
  const TEST_OWNER_PASS = 'OwnerCockpitTest#2026';

  before(async () => {
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
  });

  it('signs and verifies owner JWTs and rejects non-owner or tampered tokens', () => {
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
});

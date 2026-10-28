import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import {
  createSandboxRouter,
  sandboxPageServerGuard,
  resetRateLimitsForTest,
  resetDeployStateForTest,
  setDeployInProgressForTest,
  setSandboxDependenciesForTest,
  resetSandboxDependencies,
  invalidateAllSandboxSessions,
  getAuditLogs,
  clearAuditLogsForTest,
  recordAuditLog,
  redactSecrets,
  verifyAuditStorageWritable,
} from './sandbox';
import {
  ensureOwnerAccountForEmail,
  bootstrapOwnerFromEnv,
  createUser,
  deleteUser,
  createSession,
  findUserByEmail,
  verifyPassword,
  getUserByToken,
  invalidateAllUserSessions,
} from './db';
import { verifyDatabaseInvariants } from './db.test';

interface TestEnvContext {
  baseUrl: string;
  testOwnerEmail: string;
  testOwnerPass: string;
  ownerUserId: string;
  merchantEmail: string;
  merchantPass: string;
  merchantUserId: string;
  merchantPlatformToken: string;
  ownerSessionCookie: string;
  ownerSessionToken: string;
  capturedResetUrl: string;
  close: () => Promise<void>;
}

let ctx: TestEnvContext;
let previousOwnerEnv: string | undefined;

async function startTestServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  app.use('/api/sandbox', createSandboxRouter());
  app.get('/sandbox', sandboxPageServerGuard, (_req, res) => {
    res.status(200).send('<html><body>PROTECTED_SANDBOX_CONSOLE</body></html>');
  });

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}

async function fetchCsrf(
  baseUrl: string,
  sessionCookie?: string
): Promise<{ csrfToken: string; cookie: string }> {
  const headers: Record<string, string> = {};
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  const res = await fetch(`${baseUrl}/api/sandbox/csrf`, { headers });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie') || '';
  const body = (await res.json()) as { ok: boolean; csrfToken: string };
  assert.equal(body.ok, true);
  assert.match(body.csrfToken, /^[a-f0-9]{64}$/i);
  const csrfCookieMatch = setCookie.match(/sandbox_csrf=[^;]+/);
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[0] : '';
  return {
    csrfToken: body.csrfToken,
    cookie: sessionCookie ? `${csrfCookie}; ${sessionCookie}` : csrfCookie,
  };
}

async function ensureCtx(): Promise<TestEnvContext> {
  if (ctx) return ctx;
  previousOwnerEnv = process.env.OWNER_EMAIL;
  const testOwnerEmail = `owner.sandbox.${Date.now()}@codworth.security`;
  const testOwnerPass = `OwnerPass!${crypto.randomBytes(8).toString('hex')}`;
  process.env.OWNER_EMAIL = testOwnerEmail;

  const ownerUser = ensureOwnerAccountForEmail(testOwnerEmail, testOwnerPass);
  const merchantEmail = `merchant.sandbox.${Date.now()}@codworth.security`;
  const merchantPass = `MerchPass!${crypto.randomBytes(8).toString('hex')}`;
  const merchantUser = createUser(merchantEmail, merchantPass, 'Test Merchant', 'Merchant Store');
  const merchantPlatformToken = createSession(merchantUser.id);

  const server = await startTestServer();
  ctx = {
    baseUrl: server.baseUrl,
    testOwnerEmail,
    testOwnerPass,
    ownerUserId: ownerUser.id,
    merchantEmail,
    merchantPass,
    merchantUserId: merchantUser.id,
    merchantPlatformToken,
    ownerSessionCookie: '',
    ownerSessionToken: '',
    capturedResetUrl: '',
    close: server.close,
  };
  return ctx;
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// TEST 1: Unauthenticated user -> 401 on /api/sandbox/*
test('1. Unauthenticated user -> 401 on /api/sandbox/*', async () => {
  const c = await ensureCtx();
  const statusRes = await fetch(`${c.baseUrl}/api/sandbox/status`);
  assert.equal(statusRes.status, 401);
  const statusBody = (await statusRes.json()) as { ok: boolean; code: string; message: string };
  assert.equal(statusBody.ok, false);
  assert.equal(statusBody.code, 'UNAUTHENTICATED');
  assert.equal(typeof statusBody.message, 'string');

  const auditRes = await fetch(`${c.baseUrl}/api/sandbox/audit`);
  assert.equal(auditRes.status, 401);

  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);
  const deployRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });
  assert.equal(deployRes.status, 401);
});

// TEST 2: merchant role user -> 403
test('2. merchant role user -> 403', async () => {
  const c = await ensureCtx();
  const res = await fetch(`${c.baseUrl}/api/sandbox/status`, {
    headers: {
      Authorization: `Bearer ${c.merchantPlatformToken}`,
    },
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { ok: boolean; code: string; message: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'FORBIDDEN_NOT_OWNER');
  assert.equal(typeof body.message, 'string');
});

// TEST 3: Correct owner -> 200
test('3. Correct owner -> 200', async () => {
  const c = await ensureCtx();
  resetRateLimitsForTest();
  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);

  const loginRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({
      email: c.testOwnerEmail,
      password: c.testOwnerPass,
    }),
  });

  assert.equal(loginRes.status, 200);
  const setCookieHeader = loginRes.headers.get('set-cookie') || '';
  assert.match(setCookieHeader, /sandbox_sid=[a-f0-9]{64}/i);
  assert.match(setCookieHeader, /HttpOnly/i);
  assert.match(setCookieHeader, /Secure/i);
  assert.match(setCookieHeader, /SameSite=Strict/i);

  const sidMatch = setCookieHeader.match(/sandbox_sid=[a-f0-9]{64}/i);
  assert.ok(sidMatch);
  c.ownerSessionCookie = sidMatch[0];

  const loginBody = (await loginRes.json()) as {
    ok: boolean;
    code: string;
    sessionToken: string;
  };
  assert.equal(loginBody.ok, true);
  assert.equal(loginBody.code, 'AUTH_SUCCESS');
  c.ownerSessionToken = loginBody.sessionToken;

  const statusRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
    headers: {
      Cookie: c.ownerSessionCookie,
    },
  });
  assert.equal(statusRes.status, 200);
  const statusBody = (await statusRes.json()) as { ok: boolean; code: string };
  assert.equal(statusBody.ok, true);
  assert.equal(statusBody.code, 'OK');
});

// TEST 4: 6 failed login attempts -> lockout triggers
test('4. 6 failed login attempts -> lockout triggers', async () => {
  const c = await ensureCtx();
  resetRateLimitsForTest();
  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);

  for (let i = 1; i <= 5; i++) {
    const attemptRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
        'x-forwarded-for': '203.0.113.55',
      },
      body: JSON.stringify({
        email: c.testOwnerEmail,
        password: `WrongPassword_${i}`,
      }),
    });
    assert.equal(attemptRes.status, 401, `Attempt ${i} should return 401`);
  }

  const sixthRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
      'x-forwarded-for': '203.0.113.55',
    },
    body: JSON.stringify({
      email: c.testOwnerEmail,
      password: c.testOwnerPass,
    }),
  });
  assert.equal(sixthRes.status, 429);
  const sixthBody = (await sixthRes.json()) as { ok: boolean; code: string };
  assert.equal(sixthBody.ok, false);
  assert.ok(sixthBody.code === 'RATE_LIMITED' || sixthBody.code === 'ACCOUNT_LOCKED');

  resetRateLimitsForTest();
});

// TEST 5: Recovery request for non-owner email -> identical response (status + body + timing)
test('5. Recovery request for non-owner email -> identical response (status + body + timing)', async () => {
  const c = await ensureCtx();
  setSandboxDependenciesForTest({
    sendRecoveryEmail: async (_to: string, url: string) => {
      // Simulate variable SMTP latency to prove fire-and-forget dispatch never leaks into HTTP timing
      await new Promise((r) => setTimeout(r, 40));
      c.capturedResetUrl = url;
      return true;
    },
  });

  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);

  // Warm up connection pool once before 20x20 benchmark
  resetRateLimitsForTest();
  await fetch(`${c.baseUrl}/api/sandbox/recovery/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ email: c.testOwnerEmail }),
  });

  const ownerSamplesMs: number[] = [];
  const nonOwnerSamplesMs: number[] = [];
  const ownerRawBodies: Buffer[] = [];
  const nonOwnerRawBodies: Buffer[] = [];

  for (let i = 0; i < 20; i++) {
    resetRateLimitsForTest();

    const startOwnerNs = process.hrtime.bigint();
    const ownerRes = await fetch(`${c.baseUrl}/api/sandbox/recovery/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({ email: c.testOwnerEmail }),
    });
    const rawOwnerBuf = Buffer.from(await ownerRes.arrayBuffer());
    const ownerElapsedMs = Number(process.hrtime.bigint() - startOwnerNs) / 1_000_000;
    assert.equal(ownerRes.status, 200);
    ownerSamplesMs.push(ownerElapsedMs);
    ownerRawBodies.push(rawOwnerBuf);

    resetRateLimitsForTest();

    const startNonOwnerNs = process.hrtime.bigint();
    const nonOwnerRes = await fetch(`${c.baseUrl}/api/sandbox/recovery/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({ email: `stranger.attacker.${i}@example.com` }),
    });
    const rawNonOwnerBuf = Buffer.from(await nonOwnerRes.arrayBuffer());
    const nonOwnerElapsedMs = Number(process.hrtime.bigint() - startNonOwnerNs) / 1_000_000;
    assert.equal(nonOwnerRes.status, 200);
    nonOwnerSamplesMs.push(nonOwnerElapsedMs);
    nonOwnerRawBodies.push(rawNonOwnerBuf);
  }

  // Wait briefly for fire-and-forget email callback to populate c.capturedResetUrl
  await new Promise((r) => setTimeout(r, 60));

  // Verify all 20 owner and 20 non-owner raw response bodies are byte-for-byte identical
  const canonicalBody = ownerRawBodies[0];
  for (const buf of ownerRawBodies) {
    assert.equal(Buffer.compare(buf, canonicalBody), 0, 'Owner raw response body must be byte-identical');
  }
  for (const buf of nonOwnerRawBodies) {
    assert.equal(
      Buffer.compare(buf, canonicalBody),
      0,
      'Non-owner raw response body must be byte-identical to owner response body'
    );
  }
  assert.equal(canonicalBody.toString('utf8').includes('token='), false);

  const medianOwner = computeMedian(ownerSamplesMs);
  const medianNonOwner = computeMedian(nonOwnerSamplesMs);
  const deltaMs = Math.abs(medianOwner - medianNonOwner);

  console.log(
    `[Test #5 Timing Medians] owner=${medianOwner.toFixed(2)}ms, nonOwner=${medianNonOwner.toFixed(2)}ms, delta=${deltaMs.toFixed(2)}ms (threshold < 5.00ms)`
  );

  assert.ok(
    deltaMs < 5,
    `Expected |medianOwner - medianNonOwner| < 5ms, got ${deltaMs.toFixed(2)}ms (medianOwner=${medianOwner.toFixed(2)}ms, medianNonOwner=${medianNonOwner.toFixed(2)}ms)`
  );
  assert.ok(c.capturedResetUrl.includes('/reset?token='));
});

// TEST 6: Reset with expired/used/forged token -> rejected
test('6. Reset with expired/used/forged token -> rejected', async () => {
  const c = await ensureCtx();
  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);
  const forgedToken = crypto.randomBytes(32).toString('hex');

  const verifyForged = await fetch(
    `${c.baseUrl}/api/sandbox/recovery/verify?token=${forgedToken}`
  );
  assert.equal(verifyForged.status, 400);

  const resetForged = await fetch(`${c.baseUrl}/api/sandbox/recovery/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({
      token: forgedToken,
      newPassword: 'NewOwnerPassword!2027',
    }),
  });
  assert.equal(resetForged.status, 400);

  const validToken = new URL(c.capturedResetUrl).searchParams.get('token') || '';
  assert.match(validToken, /^[a-f0-9]{64}$/i);

  const verifyValid = await fetch(`${c.baseUrl}/api/sandbox/recovery/verify?token=${validToken}`);
  assert.equal(verifyValid.status, 200);

  const updatedPassword = `UpdatedOwnerPass!${crypto.randomBytes(6).toString('hex')}`;
  const resetValid = await fetch(`${c.baseUrl}/api/sandbox/recovery/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({
      token: validToken,
      newPassword: updatedPassword,
    }),
  });
  assert.equal(resetValid.status, 200);

  const updatedOwner = findUserByEmail(c.testOwnerEmail)!;
  assert.equal(verifyPassword(updatedOwner, updatedPassword), true);
  c.testOwnerPass = updatedPassword;

  const oldSessionCheck = await fetch(`${c.baseUrl}/api/sandbox/status`, {
    headers: { Cookie: c.ownerSessionCookie },
  });
  assert.equal(oldSessionCheck.status, 401, 'Old session must be invalidated on password reset');

  // Re-using the exact same token a second time -> 400 (single-use enforcement)
  const reuseRes = await fetch(`${c.baseUrl}/api/sandbox/recovery/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({
      token: validToken,
      newPassword: 'AnotherPassword!999',
    }),
  });
  assert.equal(reuseRes.status, 400);

  // Re-login with updated password
  const reLoginRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({
      email: c.testOwnerEmail,
      password: c.testOwnerPass,
    }),
  });
  assert.equal(reLoginRes.status, 200);
  const sidMatch = (reLoginRes.headers.get('set-cookie') || '').match(
    /sandbox_sid=[a-f0-9]{64}/i
  );
  assert.ok(sidMatch);
  c.ownerSessionCookie = sidMatch[0];
  const reLoginBody = (await reLoginRes.json()) as { sessionToken: string };
  c.ownerSessionToken = reLoginBody.sessionToken;
});

// TEST 7: Deploy without confirm or with wrong value -> 400
test('7. Deploy without confirm or with wrong value -> 400', async () => {
  const c = await ensureCtx();
  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl, c.ownerSessionCookie);

  const missingConfirmRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({}),
  });
  assert.equal(missingConfirmRes.status, 400);

  const wrongConfirmRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ confirm: 'deploy' }),
  });
  assert.equal(wrongConfirmRes.status, 400);
});

// TEST 8: Deploy with failing checks -> 422, GitHub NOT called
test('8. Deploy with failing checks -> 422, GitHub NOT called', async () => {
  const c = await ensureCtx();
  resetDeployStateForTest();
  let githubCallCount = 0;

  setSandboxDependenciesForTest({
    runPreDeployChecks: async () => ({
      allPassed: false,
      commitSha: 'deadbeef1234567890',
      branch: 'feature/unverified',
      checks: [
        {
          name: 'typecheck',
          command: 'npx tsc --noEmit',
          passed: true,
          durationMs: 120,
          summary: 'Passed with zero errors.',
        },
        {
          name: 'tests',
          command: 'npm test',
          passed: false,
          durationMs: 250,
          summary: '1 test failed.',
        },
        {
          name: 'build',
          command: 'npm run build',
          passed: true,
          durationMs: 400,
          summary: 'Build succeeded.',
        },
        {
          name: 'branch',
          command: 'git rev-parse --abbrev-ref HEAD === "main"',
          passed: false,
          durationMs: 15,
          summary: 'Current branch is "feature/unverified"; deployment requires "main".',
        },
      ],
    }),
    triggerGitHubDeploy: async () => {
      githubCallCount += 1;
      return {
        dispatched: true,
        status: 204,
        actionsUrl: 'https://github.com/owner/FunnelCraft-COD/actions',
        workflowId: 'deploy-production.yml',
        commitSha: 'deadbeef1234567890',
      };
    },
  });

  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl, c.ownerSessionCookie);
  const res = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });

  assert.equal(res.status, 422);
  const body = (await res.json()) as { ok: boolean; code: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'PREDEPLOY_CHECKS_FAILED');
  assert.equal(githubCallCount, 0, 'GitHub API must NEVER be called when checks fail');
});

// TEST 9: Successful deploy -> GitHub called exactly once, not again during execution
test('9. Successful deploy -> GitHub called exactly once, not again during execution', async () => {
  const c = await ensureCtx();
  resetDeployStateForTest();
  let githubCallCount = 0;

  setSandboxDependenciesForTest({
    runPreDeployChecks: async () => {
      await new Promise((r) => setTimeout(r, 60));
      return {
        allPassed: true,
        commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4',
        branch: 'main',
        checks: [
          {
            name: 'typecheck',
            command: 'npx tsc --noEmit',
            passed: true,
            durationMs: 110,
            summary: 'Passed with zero errors.',
          },
          {
            name: 'tests',
            command: 'npm test',
            passed: true,
            durationMs: 210,
            summary: 'All tests passed.',
          },
          {
            name: 'build',
            command: 'npm run build',
            passed: true,
            durationMs: 320,
            summary: 'Production bundle built.',
          },
          {
            name: 'branch',
            command: 'git rev-parse --abbrev-ref HEAD === "main"',
            passed: true,
            durationMs: 10,
            summary: 'Current branch verified as "main".',
          },
        ],
      };
    },
    triggerGitHubDeploy: async ({ commitSha }) => {
      githubCallCount += 1;
      return {
        dispatched: true,
        status: 204,
        actionsUrl: 'https://github.com/owner/FunnelCraft-COD/actions',
        workflowId: 'deploy-production.yml',
        commitSha,
      };
    },
  });

  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl, c.ownerSessionCookie);
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
    Cookie: cookie,
  };

  const [firstRes, concurrentRes] = await Promise.all([
    fetch(`${c.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirm: 'DEPLOY' }),
    }),
    (async () => {
      await new Promise((r) => setTimeout(r, 15));
      return fetch(`${c.baseUrl}/api/sandbox/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: 'DEPLOY' }),
      });
    })(),
  ]);

  assert.equal(firstRes.status, 200);
  assert.equal(concurrentRes.status, 409);
  assert.equal(githubCallCount, 1);

  const cooldownRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });
  assert.equal(cooldownRes.status, 429);
  assert.equal(githubCallCount, 1);

  setDeployInProgressForTest(true, c.testOwnerEmail);
  const lockedRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });
  assert.equal(lockedRes.status, 409);
  resetDeployStateForTest();
});

// TEST 10: POST without CSRF -> 403
test('10. POST without CSRF -> 403', async () => {
  const c = await ensureCtx();
  const noCsrfLogin = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.testOwnerEmail, password: c.testOwnerPass }),
  });
  assert.equal(noCsrfLogin.status, 403);
  const body = (await noCsrfLogin.json()) as { ok: boolean; code: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'CSRF_INVALID');

  const noCsrfDeploy = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: c.ownerSessionCookie,
      'x-sandbox-token': c.ownerSessionToken,
    },
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });
  assert.equal(noCsrfDeploy.status, 403);
});

// TEST 11: Trace /sandbox without session -> redirect to login, no content leaked
test('11. Trace /sandbox without session -> redirect to login, no content leaked', async () => {
  const c = await ensureCtx();
  const unauthTrace = await fetch(`${c.baseUrl}/sandbox`, {
    redirect: 'manual',
  });
  assert.equal(unauthTrace.status, 302);
  assert.equal(unauthTrace.headers.get('location'), '/sandbox/login');
  const bodyText = await unauthTrace.text();
  assert.equal(
    bodyText.includes('PROTECTED_SANDBOX_CONSOLE'),
    false,
    'No protected Sandbox content may be leaked to unauthenticated requests'
  );

  const authTrace = await fetch(`${c.baseUrl}/sandbox`, {
    headers: { Cookie: c.ownerSessionCookie },
    redirect: 'manual',
  });
  assert.equal(authTrace.status, 200);
});

// TEST 12: Database user registration invariants, OWNER_INITIAL_PASSWORD lifecycle, and audit log redaction
test('12. Any registered user is strictly assigned role merchant, pending status, and free starter plan', async () => {
  const c = await ensureCtx();

  // 12a. Verify DB invariants (Defect 2)
  verifyDatabaseInvariants();

  // 12b. Verify Audit Log writability & comprehensive secret redaction (Defect 7)
  verifyAuditStorageWritable();
  const dirtyMeta = {
    password: 'PlainPassword123!',
    newPassword: 'NewPlainPassword123!',
    token: 'secret-reset-token',
    csrfToken: 'secret-csrf-token',
    'x-csrf-token': 'header-csrf-token',
    'x-sandbox-token': 'header-sandbox-token',
    Authorization: 'Bearer secret-jwt',
    cookie: 'sandbox_sid=secret-cookie',
    GITHUB_DEPLOY_PAT: 'ghp_supersecretpat123456',
    SMTP_PASS: 'smtp_supersecret_pass',
    safeField: 'allowed-metadata-value',
  };
  const sanitized = redactSecrets(dirtyMeta);
  for (const key of [
    'password',
    'newPassword',
    'token',
    'csrfToken',
    'x-csrf-token',
    'x-sandbox-token',
    'Authorization',
    'cookie',
    'GITHUB_DEPLOY_PAT',
    'SMTP_PASS',
  ]) {
    assert.equal(sanitized[key], '[REDACTED]', `Secret key "${key}" must be redacted`);
  }
  assert.equal(sanitized.safeField, 'allowed-metadata-value');

  // 12c. Verify OWNER_INITIAL_PASSWORD lifecycle (Defect 6)
  // When owner already exists, bootstrapOwnerFromEnv must ignore OWNER_INITIAL_PASSWORD and return warningLogged=true
  process.env.OWNER_INITIAL_PASSWORD = 'IgnoredInitialPass!999';
  const existingBootstrap = bootstrapOwnerFromEnv();
  assert.equal(existingBootstrap.bootstrapped, false);
  assert.equal(existingBootstrap.warningLogged, true);

  // When no owner exists for a fresh OWNER_EMAIL, bootstrapOwnerFromEnv creates owner with initialPasswordBootstrapped=true
  const freshOwnerEmail = `bootstrap.owner.${Date.now()}@codworth.security`;
  const initialBootstrapPass = `InitialBootstrap!${crypto.randomBytes(6).toString('hex')}`;
  let freshBootstrapUserId = '';
  try {
    process.env.OWNER_EMAIL = freshOwnerEmail;
    process.env.OWNER_INITIAL_PASSWORD = initialBootstrapPass;

    const freshBootstrap = bootstrapOwnerFromEnv();
    assert.equal(freshBootstrap.bootstrapped, true);
    assert.ok(freshBootstrap.user);
    freshBootstrapUserId = freshBootstrap.user.id;
    assert.equal(freshBootstrap.user.initialPasswordBootstrapped, true);

    // First login with OWNER_INITIAL_PASSWORD -> sets mustChangePassword=true on owner record
    const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);
    const bootLoginRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({
        email: freshOwnerEmail,
        password: initialBootstrapPass,
      }),
    });
    assert.equal(bootLoginRes.status, 200);
    const bootLoginBody = (await bootLoginRes.json()) as {
      ok: boolean;
      mustChangePassword: boolean;
    };
    assert.equal(bootLoginBody.mustChangePassword, true);
    assert.equal(findUserByEmail(freshOwnerEmail)?.mustChangePassword, true);

    const bootSidMatch = (bootLoginRes.headers.get('set-cookie') || '').match(
      /sandbox_sid=[a-f0-9]{64}/i
    );
    assert.ok(bootSidMatch);
    const bootSidCookie = bootSidMatch[0];

    // Any authenticated request (e.g. /status) before changing password returns 403 PASSWORD_CHANGE_REQUIRED
    const blockedStatusRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: bootSidCookie },
    });
    assert.equal(blockedStatusRes.status, 403);
    const blockedStatusBody = (await blockedStatusRes.json()) as { ok: boolean; code: string };
    assert.equal(blockedStatusBody.code, 'PASSWORD_CHANGE_REQUIRED');

    // Change password via POST /api/sandbox/auth/change-password -> clears mustChangePassword
    const rotatedPass = `RotatedPermanentPass!${crypto.randomBytes(6).toString('hex')}`;
    const changePwRes = await fetch(`${c.baseUrl}/api/sandbox/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: `${cookie}; ${bootSidCookie}`,
      },
      body: JSON.stringify({
        currentPassword: initialBootstrapPass,
        newPassword: rotatedPass,
      }),
    });
    assert.equal(changePwRes.status, 200);
    const changePwBody = (await changePwRes.json()) as { ok: boolean; code: string };
    assert.equal(changePwBody.ok, true);
    assert.equal(changePwBody.code, 'PASSWORD_CHANGED');

    // Verify audit log recorded owner_password_bootstrapped and owner_password_changed
    const auditActions = new Set(getAuditLogs(50).map((e) => e.action));
    assert.ok(auditActions.has('owner_password_bootstrapped'));
    assert.ok(auditActions.has('owner_password_changed'));

    // Now /status succeeds with 200 using the active session
    const unlockedStatusRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: bootSidCookie },
    });
    assert.equal(unlockedStatusRes.status, 200);
  } finally {
    if (freshBootstrapUserId) {
      deleteUser(freshBootstrapUserId);
    }
    delete process.env.OWNER_INITIAL_PASSWORD;
    process.env.OWNER_EMAIL = c.testOwnerEmail;
  }
});

// TEST 13: CSRF token from session A rejected on session B -> 403
test('13. CSRF token from session A rejected on session B -> 403', async () => {
  const c = await ensureCtx();
  resetRateLimitsForTest();

  // Create Session A
  const csrfInitA = await fetchCsrf(c.baseUrl);
  const loginARes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfInitA.csrfToken,
      Cookie: csrfInitA.cookie,
    },
    body: JSON.stringify({ email: c.testOwnerEmail, password: c.testOwnerPass }),
  });
  assert.equal(loginARes.status, 200);
  const sidAMatch = (loginARes.headers.get('set-cookie') || '').match(/sandbox_sid=[a-f0-9]{64}/i);
  assert.ok(sidAMatch);
  const sessionACookie = sidAMatch[0];

  // Issue CSRF token bound to Session A
  const csrfBoundToA = await fetchCsrf(c.baseUrl, sessionACookie);

  // Create Session B
  const csrfInitB = await fetchCsrf(c.baseUrl);
  const loginBRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfInitB.csrfToken,
      Cookie: csrfInitB.cookie,
    },
    body: JSON.stringify({ email: c.testOwnerEmail, password: c.testOwnerPass }),
  });
  assert.equal(loginBRes.status, 200);
  const sidBMatch = (loginBRes.headers.get('set-cookie') || '').match(/sandbox_sid=[a-f0-9]{64}/i);
  assert.ok(sidBMatch);
  const sessionBCookie = sidBMatch[0];
  c.ownerSessionCookie = sessionBCookie;

  // Attempt POST on Session B using Session A's CSRF token + CSRF cookie -> MUST be rejected with 403
  const csrfCookieOnlyFromA = csrfBoundToA.cookie.split(';')[0].trim();
  const crossSessionRes = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfBoundToA.csrfToken,
      Cookie: `${csrfCookieOnlyFromA}; ${sessionBCookie}`,
    },
    body: JSON.stringify({ confirm: 'DEPLOY' }),
  });
  assert.equal(crossSessionRes.status, 403);
  const crossBody = (await crossSessionRes.json()) as { ok: boolean; code: string; message: string };
  assert.equal(crossBody.ok, false);
  assert.equal(crossBody.code, 'CSRF_INVALID');
  assert.equal(crossBody.message, 'CSRF token is bound to a different session.');
});

// TEST 14: OWNER_EMAIL unset -> 403 on all /api/sandbox/* routes
test('14. OWNER_EMAIL unset -> 403 on all /api/sandbox/* routes', async () => {
  const c = await ensureCtx();
  const savedOwnerEmail = process.env.OWNER_EMAIL;
  try {
    // 14a. Completely unset OWNER_EMAIL
    delete process.env.OWNER_EMAIL;
    const unsetRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: c.ownerSessionCookie },
    });
    assert.equal(unsetRes.status, 403, 'Unset OWNER_EMAIL must fail closed with 403 (not 500)');
    const unsetBody = (await unsetRes.json()) as { ok: boolean; code: string; message: string };
    assert.equal(unsetBody.ok, false);
    assert.equal(unsetBody.code, 'FORBIDDEN_OWNER_NOT_CONFIGURED');

    // 14b. Empty whitespace OWNER_EMAIL
    process.env.OWNER_EMAIL = '   ';
    const emptyRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: c.ownerSessionCookie },
    });
    assert.equal(emptyRes.status, 403, 'Empty OWNER_EMAIL must fail closed with 403');
  } finally {
    process.env.OWNER_EMAIL = savedOwnerEmail;
  }
});

// TEST 15: Request with email differing from OWNER_EMAIL after normalization -> 403
test('15. Request with email differing from OWNER_EMAIL after normalization -> 403', async () => {
  const c = await ensureCtx();
  const savedOwnerEmail = process.env.OWNER_EMAIL;
  try {
    // 15a. Case/whitespace variations of the same owner email normalize identically -> 200
    process.env.OWNER_EMAIL = `  ${c.testOwnerEmail.toUpperCase()}  `;
    const normalizedMatchRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: c.ownerSessionCookie },
    });
    assert.equal(normalizedMatchRes.status, 200);

    // 15b. When OWNER_EMAIL is changed to a different email, even an active owner session with role='owner' is rejected with 403
    process.env.OWNER_EMAIL = 'another.owner@codworth.security';
    const mismatchRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: c.ownerSessionCookie },
    });
    assert.equal(mismatchRes.status, 403);
    const mismatchBody = (await mismatchRes.json()) as { ok: boolean; code: string };
    assert.equal(mismatchBody.ok, false);
    assert.equal(mismatchBody.code, 'FORBIDDEN_NOT_OWNER');
  } finally {
    process.env.OWNER_EMAIL = savedOwnerEmail;
  }
});

// TEST 16: After password reset, all previously issued session cookies return 401
test('16. After password reset, all previously issued session cookies return 401', async () => {
  const c = await ensureCtx();
  resetRateLimitsForTest();

  // Issue 3 distinct sandbox sessions + 2 platform DB sessions for the owner
  const sandboxCookies: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);
    const loginRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({ email: c.testOwnerEmail, password: c.testOwnerPass }),
    });
    assert.equal(loginRes.status, 200);
    const sidMatch = (loginRes.headers.get('set-cookie') || '').match(/sandbox_sid=[a-f0-9]{64}/i);
    assert.ok(sidMatch);
    sandboxCookies.push(sidMatch[0]);
  }

  const dbToken1 = createSession(c.ownerUserId);
  const dbToken2 = createSession(c.ownerUserId);
  assert.ok(getUserByToken(dbToken1));
  assert.ok(getUserByToken(dbToken2));

  // Verify legacy base64 forged token is never accepted by getUserByToken (Defect 9)
  const forgedBase64 = Buffer.from(`session_${c.ownerUserId}_${Date.now()}`).toString('base64');
  assert.equal(getUserByToken(forgedBase64), undefined);

  // Trigger recovery request & password reset
  let resetLink = '';
  setSandboxDependenciesForTest({
    sendRecoveryEmail: async (_to: string, url: string) => {
      resetLink = url;
      return true;
    },
  });

  const { csrfToken, cookie } = await fetchCsrf(c.baseUrl);
  await fetch(`${c.baseUrl}/api/sandbox/recovery/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ email: c.testOwnerEmail }),
  });
  await new Promise((r) => setTimeout(r, 20));
  const resetToken = new URL(resetLink).searchParams.get('token') || '';
  assert.match(resetToken, /^[a-f0-9]{64}$/i);

  const nextPassword = `PostResetOwnerPass!${crypto.randomBytes(6).toString('hex')}`;
  const resetRes = await fetch(`${c.baseUrl}/api/sandbox/recovery/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ token: resetToken, newPassword: nextPassword }),
  });
  assert.equal(resetRes.status, 200);
  c.testOwnerPass = nextPassword;

  // Every previously issued sandbox session cookie MUST return 401
  for (const oldCookie of sandboxCookies) {
    const res = await fetch(`${c.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: oldCookie },
    });
    assert.equal(res.status, 401, `Previously issued cookie ${oldCookie} must return 401`);
  }

  // Every previously issued DB session token MUST return undefined and 401
  assert.equal(getUserByToken(dbToken1), undefined);
  assert.equal(getUserByToken(dbToken2), undefined);
  const bearerRes = await fetch(`${c.baseUrl}/api/sandbox/status`, {
    headers: { Authorization: `Bearer ${dbToken1}` },
  });
  assert.equal(bearerRes.status, 401);

  // Re-establish valid session for Test 17
  const reLoginRes = await fetch(`${c.baseUrl}/api/sandbox/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: cookie,
    },
    body: JSON.stringify({ email: c.testOwnerEmail, password: c.testOwnerPass }),
  });
  assert.equal(reLoginRes.status, 200);
  const sidMatch = (reLoginRes.headers.get('set-cookie') || '').match(/sandbox_sid=[a-f0-9]{64}/i);
  assert.ok(sidMatch);
  c.ownerSessionCookie = sidMatch[0];
});

// TEST 17: Simulated 500 on sandbox route -> sanitized error response with no stack, path, or internal identifier
test('17. Simulated 500 on sandbox route -> sanitized error response with no stack, path, or internal identifier', async () => {
  const c = await ensureCtx();
  resetDeployStateForTest();

  try {
    setSandboxDependenciesForTest({
      runPreDeployChecks: async () => {
        const internalErr = new Error(
          'FATAL_DB_FAILURE at /app/applet/server/sandbox.ts:512 in table users_internal_secret'
        );
        internalErr.stack =
          'Error: FATAL_DB_FAILURE\n    at Object.runPreDeployChecks (/app/applet/server/sandbox.ts:512:15)\n    at /app/applet/node_modules/express/lib/router/index.js:284:12';
        throw internalErr;
      },
    });

    const { csrfToken, cookie } = await fetchCsrf(c.baseUrl, c.ownerSessionCookie);
    const res = await fetch(`${c.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({ confirm: 'DEPLOY' }),
    });

    assert.equal(res.status, 500);
    const rawText = await res.text();
    const parsed = JSON.parse(rawText) as { ok: boolean; code: string; message: string };

    assert.deepEqual(parsed, {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    });

    // Verify zero leakage of stack trace, file paths, or internal table names
    assert.equal(rawText.includes('FATAL_DB_FAILURE'), false);
    assert.equal(rawText.includes('/app/applet'), false);
    assert.equal(rawText.includes('sandbox.ts'), false);
    assert.equal(rawText.includes('users_internal_secret'), false);
    assert.equal(rawText.includes('at Object.'), false);
  } finally {
    resetSandboxDependencies();
    resetRateLimitsForTest();
    resetDeployStateForTest();
    invalidateAllSandboxSessions();
    clearAuditLogsForTest();
    invalidateAllUserSessions(c.ownerUserId);
    invalidateAllUserSessions(c.merchantUserId);
    deleteUser(c.ownerUserId);
    deleteUser(c.merchantUserId);
    if (previousOwnerEnv !== undefined) {
      process.env.OWNER_EMAIL = previousOwnerEnv;
    } else {
      delete process.env.OWNER_EMAIL;
    }
    await c.close();
  }
});

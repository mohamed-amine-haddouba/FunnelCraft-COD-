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
} from './sandbox';
import {
  ensureOwnerAccountForEmail,
  createUser,
  deleteUser,
  createSession,
  findUserByEmail,
  verifyPassword,
} from './db';

function startTestServer(): Promise<{
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

async function fetchCsrf(baseUrl: string): Promise<{ csrfToken: string; cookie: string }> {
  const res = await fetch(`${baseUrl}/api/sandbox/csrf`);
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie') || '';
  const body = (await res.json()) as { ok: boolean; csrfToken: string };
  assert.equal(body.ok, true);
  assert.match(body.csrfToken, /^[a-f0-9]{64}$/i);
  const csrfCookieMatch = setCookie.match(/sandbox_csrf=[^;]+/);
  return {
    csrfToken: body.csrfToken,
    cookie: csrfCookieMatch ? csrfCookieMatch[0] : '',
  };
}

test('Sandbox Security Suite — All 11 Mandatory Security & Functional Tests', async (t) => {
  const testOwnerEmail = `owner.sandbox.${Date.now()}@codworth.security`;
  const testOwnerPass = `OwnerPass!${crypto.randomBytes(8).toString('hex')}`;
  const previousOwnerEnv = process.env.OWNER_EMAIL;
  process.env.OWNER_EMAIL = testOwnerEmail;

  const ownerUser = ensureOwnerAccountForEmail(testOwnerEmail, testOwnerPass);
  const merchantEmail = `merchant.sandbox.${Date.now()}@codworth.security`;
  const merchantPass = `MerchPass!${crypto.randomBytes(8).toString('hex')}`;
  const merchantUser = createUser(merchantEmail, merchantPass, 'Test Merchant', 'Merchant Store');
  const merchantPlatformToken = createSession(merchantUser.id);

  const server = await startTestServer();

  t.after(async () => {
    resetSandboxDependencies();
    resetRateLimitsForTest();
    resetDeployStateForTest();
    invalidateAllSandboxSessions();
    deleteUser(ownerUser.id);
    deleteUser(merchantUser.id);
    if (previousOwnerEnv !== undefined) {
      process.env.OWNER_EMAIL = previousOwnerEnv;
    } else {
      delete process.env.OWNER_EMAIL;
    }
    await server.close();
  });

  // TEST 1: Unauthenticated user -> 401 on /api/sandbox/*
  await t.test('1. Unauthenticated user -> 401 on /api/sandbox/*', async () => {
    const statusRes = await fetch(`${server.baseUrl}/api/sandbox/status`);
    assert.equal(statusRes.status, 401);
    const statusBody = (await statusRes.json()) as { ok: boolean; code: string };
    assert.equal(statusBody.ok, false);
    assert.equal(statusBody.code, 'UNAUTHENTICATED');

    const auditRes = await fetch(`${server.baseUrl}/api/sandbox/audit`);
    assert.equal(auditRes.status, 401);

    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);
    const deployRes = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
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
  await t.test('2. merchant role user -> 403', async () => {
    const res = await fetch(`${server.baseUrl}/api/sandbox/status`, {
      headers: {
        Authorization: `Bearer ${merchantPlatformToken}`,
      },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { ok: boolean; code: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, 'FORBIDDEN_NOT_OWNER');
  });

  // TEST 3: Correct owner -> 200
  let ownerSessionCookie = '';
  let ownerSessionToken = '';
  await t.test('3. Correct owner -> 200', async () => {
    resetRateLimitsForTest();
    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);

    const loginRes = await fetch(`${server.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: testOwnerPass,
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
    ownerSessionCookie = sidMatch[0];

    const loginBody = (await loginRes.json()) as {
      ok: boolean;
      code: string;
      sessionToken: string;
    };
    assert.equal(loginBody.ok, true);
    assert.equal(loginBody.code, 'AUTH_SUCCESS');
    ownerSessionToken = loginBody.sessionToken;

    const statusRes = await fetch(`${server.baseUrl}/api/sandbox/status`, {
      headers: {
        Cookie: ownerSessionCookie,
      },
    });
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as { ok: boolean; code: string };
    assert.equal(statusBody.ok, true);
    assert.equal(statusBody.code, 'OK');
  });

  // TEST 4: 6 failed login attempts -> lockout triggers
  await t.test('4. 6 failed login attempts -> lockout triggers', async () => {
    resetRateLimitsForTest();
    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);

    for (let i = 1; i <= 5; i++) {
      const attemptRes = await fetch(`${server.baseUrl}/api/sandbox/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookie,
          'x-forwarded-for': '203.0.113.55',
        },
        body: JSON.stringify({
          email: testOwnerEmail,
          password: `WrongPassword_${i}`,
        }),
      });
      assert.equal(attemptRes.status, 401, `Attempt ${i} should return 401`);
    }

    // 6th attempt must trigger rate-limit lockout (429)
    const sixthRes = await fetch(`${server.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
        'x-forwarded-for': '203.0.113.55',
      },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: testOwnerPass, // Even with right password, locked out!
      }),
    });
    assert.equal(sixthRes.status, 429);
    const sixthBody = (await sixthRes.json()) as { ok: boolean; code: string };
    assert.equal(sixthBody.ok, false);
    assert.ok(sixthBody.code === 'RATE_LIMITED' || sixthBody.code === 'ACCOUNT_LOCKED');

    resetRateLimitsForTest();
  });

  // TEST 5: Recovery request for non-owner email -> identical response (status + body + timing)
  let capturedResetUrl = '';
  await t.test(
    '5. Recovery request for non-owner email -> identical response (status + body + timing)',
    async () => {
      setSandboxDependenciesForTest({
        sendRecoveryEmail: async (_to: string, url: string) => {
          capturedResetUrl = url;
          return true;
        },
      });

      const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);

      const t0Owner = Date.now();
      const ownerRecRes = await fetch(`${server.baseUrl}/api/sandbox/recovery/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookie,
        },
        body: JSON.stringify({ email: testOwnerEmail }),
      });
      const ownerDuration = Date.now() - t0Owner;
      const ownerRecBody = await ownerRecRes.json();

      const t0NonOwner = Date.now();
      const nonOwnerRecRes = await fetch(`${server.baseUrl}/api/sandbox/recovery/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookie,
        },
        body: JSON.stringify({ email: 'stranger.attacker@example.com' }),
      });
      const nonOwnerDuration = Date.now() - t0NonOwner;
      const nonOwnerRecBody = await nonOwnerRecRes.json();

      // Exact same status and JSON body
      assert.equal(ownerRecRes.status, 200);
      assert.equal(nonOwnerRecRes.status, 200);
      assert.deepEqual(ownerRecBody, nonOwnerRecBody);

      // Never return token or reset URL in JSON response
      assert.equal(JSON.stringify(ownerRecBody).includes('token='), false);

      // Timing must be normalized within narrow tolerance
      const timingDelta = Math.abs(ownerDuration - nonOwnerDuration);
      assert.ok(
        timingDelta < 80,
        `Expected constant timing, delta was ${timingDelta}ms (owner=${ownerDuration}ms, nonOwner=${nonOwnerDuration}ms)`
      );
      assert.ok(capturedResetUrl.includes('/reset?token='));
    }
  );

  // TEST 6: Reset with expired/used/forged token -> rejected
  await t.test('6. Reset with expired/used/forged token -> rejected', async () => {
    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);
    const forgedToken = crypto.randomBytes(32).toString('hex');

    // Forged token verification -> 400
    const verifyForged = await fetch(
      `${server.baseUrl}/api/sandbox/recovery/verify?token=${forgedToken}`
    );
    assert.equal(verifyForged.status, 400);

    // Forged token reset -> 400
    const resetForged = await fetch(`${server.baseUrl}/api/sandbox/recovery/reset`, {
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

    // Extract valid token from capturedResetUrl
    const validToken = new URL(capturedResetUrl).searchParams.get('token') || '';
    assert.match(validToken, /^[a-f0-9]{64}$/i);

    // Valid token verification -> 200
    const verifyValid = await fetch(
      `${server.baseUrl}/api/sandbox/recovery/verify?token=${validToken}`
    );
    assert.equal(verifyValid.status, 200);

    // Use valid token once -> 200 and invalidates previous session
    const updatedPassword = `UpdatedOwnerPass!${crypto.randomBytes(6).toString('hex')}`;
    const resetValid = await fetch(`${server.baseUrl}/api/sandbox/recovery/reset`, {
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

    // Verify password actually changed and old session was invalidated
    const updatedOwner = findUserByEmail(testOwnerEmail)!;
    assert.equal(verifyPassword(updatedOwner, updatedPassword), true);

    const oldSessionCheck = await fetch(`${server.baseUrl}/api/sandbox/status`, {
      headers: { Cookie: ownerSessionCookie },
    });
    assert.equal(oldSessionCheck.status, 401, 'Old session must be invalidated on password reset');

    // Re-using the exact same token a second time -> 400 (single-use enforcement)
    const reuseRes = await fetch(`${server.baseUrl}/api/sandbox/recovery/reset`, {
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

    // Log back in with the new password to establish fresh session for remaining tests
    const reLoginRes = await fetch(`${server.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: updatedPassword,
      }),
    });
    assert.equal(reLoginRes.status, 200);
    const sidMatch = (reLoginRes.headers.get('set-cookie') || '').match(
      /sandbox_sid=[a-f0-9]{64}/i
    );
    assert.ok(sidMatch);
    ownerSessionCookie = sidMatch[0];
    const reLoginBody = (await reLoginRes.json()) as { sessionToken: string };
    ownerSessionToken = reLoginBody.sessionToken;
  });

  // TEST 7: Deploy without confirm or with wrong value -> 400
  await t.test('7. Deploy without confirm or with wrong value -> 400', async () => {
    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);

    const missingConfirmRes = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: `${cookie}; ${ownerSessionCookie}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(missingConfirmRes.status, 400);

    const wrongConfirmRes = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: `${cookie}; ${ownerSessionCookie}`,
      },
      body: JSON.stringify({ confirm: 'deploy' }),
    });
    assert.equal(wrongConfirmRes.status, 400);
  });

  // TEST 8: Deploy with failing checks -> 422, GitHub NOT called
  await t.test('8. Deploy with failing checks -> 422, GitHub NOT called', async () => {
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

    const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);
    const res = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: `${cookie}; ${ownerSessionCookie}`,
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
  await t.test(
    '9. Successful deploy -> GitHub called exactly once, not again during execution',
    async () => {
      resetDeployStateForTest();
      let githubCallCount = 0;

      setSandboxDependenciesForTest({
        runPreDeployChecks: async () => {
          // Simulate brief execution window to test concurrent lock
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

      const { csrfToken, cookie } = await fetchCsrf(server.baseUrl);
      const headers = {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: `${cookie}; ${ownerSessionCookie}`,
      };

      // Fire two concurrent deploy requests simultaneously
      const [firstRes, concurrentRes] = await Promise.all([
        fetch(`${server.baseUrl}/api/sandbox/deploy`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ confirm: 'DEPLOY' }),
        }),
        (async () => {
          await new Promise((r) => setTimeout(r, 15));
          return fetch(`${server.baseUrl}/api/sandbox/deploy`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ confirm: 'DEPLOY' }),
          });
        })(),
      ]);

      assert.equal(firstRes.status, 200);
      assert.equal(
        concurrentRes.status,
        409,
        'Concurrent deployment during active execution must be rejected with 409'
      );
      assert.equal(githubCallCount, 1, 'GitHub must be called exactly once');

      // Subsequent deploy within 5-minute cooldown must be rate-limited (429)
      const cooldownRes = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: 'DEPLOY' }),
      });
      assert.equal(cooldownRes.status, 429);
      assert.equal(githubCallCount, 1);

      // Verify explicit lock check as well
      setDeployInProgressForTest(true, testOwnerEmail);
      const lockedRes = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: 'DEPLOY' }),
      });
      assert.equal(lockedRes.status, 409);
      resetDeployStateForTest();
    }
  );

  // TEST 10: POST without CSRF -> 403
  await t.test('10. POST without CSRF -> 403', async () => {
    const noCsrfLogin = await fetch(`${server.baseUrl}/api/sandbox/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testOwnerEmail, password: testOwnerPass }),
    });
    assert.equal(noCsrfLogin.status, 403);
    const body = (await noCsrfLogin.json()) as { ok: boolean; code: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, 'CSRF_INVALID');

    const noCsrfDeploy = await fetch(`${server.baseUrl}/api/sandbox/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerSessionCookie,
        'x-sandbox-token': ownerSessionToken,
      },
      body: JSON.stringify({ confirm: 'DEPLOY' }),
    });
    assert.equal(noCsrfDeploy.status, 403);
  });

  // TEST 11: Trace /sandbox without session -> redirect to login, no content leaked
  await t.test('11. Trace /sandbox without session -> redirect to login, no content leaked', async () => {
    const unauthTrace = await fetch(`${server.baseUrl}/sandbox`, {
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

    // Verify authenticated owner CAN access /sandbox
    const authTrace = await fetch(`${server.baseUrl}/sandbox`, {
      headers: { Cookie: ownerSessionCookie },
      redirect: 'manual',
    });
    assert.equal(authTrace.status, 200);

    // Verify audit trail recorded all required events without secrets
    const logs = getAuditLogs(50);
    const actionsRecorded = new Set(logs.map((l) => l.action));
    assert.ok(actionsRecorded.has('login_success'));
    assert.ok(actionsRecorded.has('login_failure'));
    assert.ok(actionsRecorded.has('recovery_request'));
    assert.ok(actionsRecorded.has('password_change'));
    assert.ok(actionsRecorded.has('deploy_trigger'));
    assert.ok(actionsRecorded.has('check_failure'));
    assert.ok(actionsRecorded.has('deploy_result'));
    clearAuditLogsForTest();
  });
});

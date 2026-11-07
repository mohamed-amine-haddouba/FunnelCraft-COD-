import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { setEmailVerificationTestInterceptor } from './mailer';
import {
  createSession, createUser, saveUserPage, publishPage,
  findUserByEmail as getUserByEmail,
  setUserEmailVerifiedState,
} from './db';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const VERIFICATIONS_PATH = path.join(DATA_DIR, 'email_verifications.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const ORDERS_PATH = path.join(DATA_DIR, 'orders.json');

test('Email Verification Gating & Anti-Enumeration Integration Suite (5 Tests)', async (t) => {
  process.env.NODE_TEST_NO_LISTEN = '1';
  const prevBypass = process.env.BYPASS_CAPTCHA;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevOwnerEmail = process.env.OWNER_EMAIL;

  const originalUsers = fs.readFileSync(USERS_PATH, 'utf-8');
  const originalVerifications = fs.existsSync(VERIFICATIONS_PATH)
    ? fs.readFileSync(VERIFICATIONS_PATH, 'utf-8')
    : '[]';
  const originalSessions = fs.existsSync(SESSIONS_PATH)
    ? fs.readFileSync(SESSIONS_PATH, 'utf-8')
    : '{}';
  const originalOrders = fs.existsSync(ORDERS_PATH)
    ? fs.readFileSync(ORDERS_PATH, 'utf-8')
    : '[]';

  process.env.NODE_ENV = 'test';
  process.env.OWNER_EMAIL = 'owner@example.test';

  const { app, startServer } = await import('../server');
  await startServer();
  process.env.BYPASS_CAPTCHA = 'true';

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  setEmailVerificationTestInterceptor(() => {
    // Intercept emails during tests
  });

  const unverifiedEmail = 'unverified.gating@gmail.com';
  const verifiedEmail = 'verified.gating@gmail.com';

  try {
    // Seed unverified user via POST /api/auth/register
    const regUnverified = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-rate-limit': '1',
      },
      body: JSON.stringify({
        email: unverifiedEmail,
        password: 'Password123',
        full_name: 'Unverified Merchant',
      }),
    });
    assert.equal(regUnverified.status, 201);

    // Seed verified user
    const regVerified = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-rate-limit': '1',
      },
      body: JSON.stringify({
        email: verifiedEmail,
        password: 'Password123',
        full_name: 'Verified Merchant',
      }),
    });
    assert.equal(regVerified.status, 201);
    const verifiedUserObj = getUserByEmail(verifiedEmail)!;
    setUserEmailVerifiedState(verifiedUserObj.id, true);

    // 1. Unverified user cannot POST /api/auth/login -> 403 EMAIL_NOT_VERIFIED
    await t.test(
      '1. Unverified user cannot POST /api/auth/login -> 403 EMAIL_NOT_VERIFIED',
      async () => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-bypass-rate-limit': '1',
          },
          body: JSON.stringify({
            email: unverifiedEmail,
            password: 'Password123',
          }),
        });
        assert.equal(res.status, 403);
        const body = (await res.json()) as Record<string, any>;
        assert.equal(body.success, false);
        assert.equal(body.code, 'EMAIL_NOT_VERIFIED');
      }
    );

    // 2. Unverified user cannot POST /api/auth/resend-verification more than 3 times per hour -> 429
    await t.test(
      '2. Unverified user cannot POST /api/auth/resend-verification more than 3 times per hour -> 429',
      async () => {
        const rateLimitEmail = 'ratelimit.target@gmail.com';
        for (let attempt = 1; attempt <= 3; attempt++) {
          const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: rateLimitEmail }),
          });
          assert.equal(res.status, 200, `Attempt ${attempt} should return 200`);
        }

        const fourthRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: rateLimitEmail }),
        });
        assert.equal(fourthRes.status, 429, '4th resend attempt within 1 hour must return 429');
      }
    );

    // 3. Even if a session token is somehow minted for an unverified user, calling POST /api/pages, GET /api/analytics, POST /api/paypal/create-order all return 403 EMAIL_NOT_VERIFIED
    await t.test(
      '3. Directly minted session token for unverified user is blocked on POST /api/pages, GET /api/analytics, POST /api/paypal/create-order with 403 EMAIL_NOT_VERIFIED',
      async () => {
        const unverifiedUser = getUserByEmail(unverifiedEmail)!;
        assert.equal(unverifiedUser.email_verified, false);

        // Directly mint session in data/sessions.json
        const forgedToken = createSession(unverifiedUser.id);
        const authHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedToken}`,
        };

        const postPagesRes = await fetch(`${baseUrl}/api/pages`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ title: 'Blocked Funnel', data: { blocks: [] } }),
        });
        assert.equal(postPagesRes.status, 403);
        const postPagesData = (await postPagesRes.json()) as Record<string, any>;
        assert.equal(postPagesData.code, 'EMAIL_NOT_VERIFIED');

        const getAnalyticsRes = await fetch(`${baseUrl}/api/analytics`, {
          method: 'GET',
          headers: authHeaders,
        });
        assert.equal(getAnalyticsRes.status, 403);
        const getAnalyticsData = (await getAnalyticsRes.json()) as Record<string, any>;
        assert.equal(getAnalyticsData.code, 'EMAIL_NOT_VERIFIED');

        const postPaypalRes = await fetch(`${baseUrl}/api/paypal/create-order`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ planId: 'pro' }),
        });
        assert.equal(postPaypalRes.status, 403);
        const postPaypalData = (await postPaypalRes.json()) as Record<string, any>;
        assert.equal(postPaypalData.code, 'EMAIL_NOT_VERIFIED');
      }
    );

    // 4. Resend endpoint returns identical status, body shape, and approximate timing (±100ms) for existing-unverified, existing-verified, and non-existing emails (anti-enumeration)
    await t.test(
      '4. Resend endpoint returns identical status, body shape, and approximate timing (±100ms) for existing-unverified, existing-verified, and non-existing emails',
      async () => {
        const measureResend = async (targetEmail: string) => {
          const t0 = Date.now();
          const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-test-bypass-rate-limit': '1',
            },
            body: JSON.stringify({ email: targetEmail }),
          });
          const elapsed = Date.now() - t0;
          const body = (await res.json()) as Record<string, any>;
          return { status: res.status, body, elapsed };
        };

        const rUnverified = await measureResend(unverifiedEmail);
        const rVerified = await measureResend(verifiedEmail);
        const rNonExisting = await measureResend('nonexisting.merchant987@gmail.com');

        assert.equal(rUnverified.status, 200);
        assert.equal(rVerified.status, 200);
        assert.equal(rNonExisting.status, 200);

        assert.deepEqual(rUnverified.body, rVerified.body);
        assert.deepEqual(rVerified.body, rNonExisting.body);

        const maxElapsed = Math.max(
          rUnverified.elapsed,
          rVerified.elapsed,
          rNonExisting.elapsed
        );
        const minElapsed = Math.min(
          rUnverified.elapsed,
          rVerified.elapsed,
          rNonExisting.elapsed
        );
        assert.ok(
          maxElapsed - minElapsed <= 100,
          `Timing spread ${maxElapsed - minElapsed}ms exceeded 100ms tolerance (${rUnverified.elapsed}ms, ${rVerified.elapsed}ms, ${rNonExisting.elapsed}ms)`
        );
      }
    );

    // 5. Public POST /api/orders/submit WITH valid CAPTCHA still works without auth
    await t.test(
      '5. Public POST /api/orders/submit WITH valid CAPTCHA still works without auth',
      async () => {
        const merchant = createUser('fixture-order@demo.ma', 'Fixture-Password12', 'Fixture');
        const page = saveUserPage(merchant.id, { title: 'Fixture watch', slug: 'fixture-watch', data: { price: 299, currency: 'MAD' } }).page;
        publishPage(merchant.id, page.id, page.slug);
        const res = await fetch(`${baseUrl}/api/orders/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'أمين العلوي',
            customerPhone: '0612345678',
            customerCity: 'الدار البيضاء',
            customerAddress: 'شارع الزرقطوني رقم 10',
            productTitle: 'ساعة ذكية احترافية',
            totalPrice: 299,
            pageSlug: page.slug,
            turnstileToken: 'valid-test-bypass-token',
          }),
        });
        assert.equal(res.status, 200);
        const body = (await res.json()) as Record<string, any>;
        assert.equal(body.success, true);
        assert.ok(body.orderId);
      }
    );
  } finally {
    setEmailVerificationTestInterceptor(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));

    fs.writeFileSync(USERS_PATH, originalUsers, 'utf-8');
    fs.writeFileSync(VERIFICATIONS_PATH, originalVerifications, 'utf-8');
    fs.writeFileSync(SESSIONS_PATH, originalSessions, 'utf-8');
    fs.writeFileSync(ORDERS_PATH, originalOrders, 'utf-8');

    if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
    else delete process.env.BYPASS_CAPTCHA;
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    else delete process.env.NODE_ENV;
    if (prevOwnerEmail !== undefined) process.env.OWNER_EMAIL = prevOwnerEmail;
    else delete process.env.OWNER_EMAIL;
  }
});

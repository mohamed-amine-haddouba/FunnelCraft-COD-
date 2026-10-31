import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  clearEmailValidationCacheForTest,
  setCustomMxResolverForTest,
  getDisposableDomainsCount,
} from './emailValidation';
import { setEmailVerificationTestInterceptor } from './mailer';
import {
  getEmailVerificationRecordsByEmail,
  updateEmailVerificationRecordForTest,
  findUserByEmail as getUserByEmail,
  createSession,
} from './db';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const VERIFICATIONS_PATH = path.join(DATA_DIR, 'email_verifications.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');

test('Email Verification & Invalid/Fake/Disposable Email Rejection Suite (11 Tests)', async (t) => {
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

  process.env.BYPASS_CAPTCHA = 'true';
  process.env.OWNER_EMAIL = 'naadianajah2020@gmail.com';

  const { app, startServer } = await import('../server');
  await startServer();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const sentCodesByEmail = new Map<string, string>();
  setEmailVerificationTestInterceptor((payload) => {
    sentCodesByEmail.set(payload.email.toLowerCase(), payload.code);
  });

  const postJson = async (urlPath: string, body: unknown, token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-test-bypass-rate-limit': '1',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, any>;
    return { status: res.status, body: json };
  };

  try {
    assert.ok(
      getDisposableDomainsCount() >= 400,
      `Expected >= 400 disposable domains, got ${getDisposableDomainsCount()}`
    );

    // 1. Rejects invalid syntax ("notanemail", "a@b", "@gmail.com", "user@.com")
    await t.test('1. Rejects invalid email syntax with 400 INVALID_EMAIL_SYNTAX', async () => {
      const invalidSamples = ['notanemail', 'a@b', '@gmail.com', 'user@.com'];
      for (const badEmail of invalidSamples) {
        const { status, body } = await postJson('/api/auth/register', {
          email: badEmail,
          password: 'Password123',
          full_name: 'Test Merchant',
        });
        assert.equal(status, 400, `Expected 400 for "${badEmail}"`);
        assert.equal(body.code, 'INVALID_EMAIL_SYNTAX');
        assert.equal(body.message_ar, 'صيغة البريد الإلكتروني غير صحيحة.');
      }
    });

    // 2. Rejects disposable domains with 400 and code: 'DISPOSABLE_EMAIL_NOT_ALLOWED'
    await t.test(
      '2. Rejects disposable domains (mailinator, 10minutemail, yopmail) with 400 DISPOSABLE_EMAIL_NOT_ALLOWED',
      async () => {
        const disposableSamples = [
          'user@mailinator.com',
          'x@10minutemail.com',
          'a@yopmail.com',
        ];
        for (const dispEmail of disposableSamples) {
          const { status, body } = await postJson('/api/auth/register', {
            email: dispEmail,
            password: 'Password123',
            full_name: 'Disposable User',
          });
          assert.equal(status, 400, `Expected 400 for "${dispEmail}"`);
          assert.equal(body.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
          assert.equal(
            body.message_ar,
            'لا يمكن استخدام بريد مؤقت أو وهمي. الرجاء استخدام بريد حقيقي.'
          );
          assert.equal(getUserByEmail(dispEmail), undefined);
        }
      }
    );

    // 3. Rejects placeholder domains with 400 and code: 'PLACEHOLDER_EMAIL_NOT_ALLOWED'
    await t.test(
      '3. Rejects placeholder domains (test.com, example.com, fake.com, invalid) with 400 PLACEHOLDER_EMAIL_NOT_ALLOWED',
      async () => {
        const placeholderSamples = [
          'test@test.com',
          'a@example.com',
          'foo@fake.com',
          'x@invalid',
        ];
        for (const phEmail of placeholderSamples) {
          const { status, body } = await postJson('/api/auth/register', {
            email: phEmail,
            password: 'Password123',
            full_name: 'Placeholder User',
          });
          assert.equal(status, 400, `Expected 400 for "${phEmail}"`);
          assert.equal(body.code, 'PLACEHOLDER_EMAIL_NOT_ALLOWED');
          assert.equal(body.message_ar, 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.');
          assert.equal(getUserByEmail(phEmail), undefined);
        }
      }
    );

    // 4. Rejects domain with no MX record in production mode with 400 EMAIL_DOMAIN_HAS_NO_MX
    await t.test(
      '4. Rejects domain with no MX record in production mode with 400 EMAIL_DOMAIN_HAS_NO_MX',
      async () => {
        clearEmailValidationCacheForTest();
        const savedNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        setCustomMxResolverForTest(async (domain) => {
          if (domain === 'this-domain-definitely-does-not-exist-xyz123.com') {
            const err = new Error('queryMx ENOTFOUND') as NodeJS.ErrnoException;
            err.code = 'ENOTFOUND';
            throw err;
          }
          return [{ exchange: 'mx.valid.com', priority: 10 }];
        });

        try {
          const { status, body } = await postJson('/api/auth/register', {
            email: 'user@this-domain-definitely-does-not-exist-xyz123.com',
            password: 'Password123',
            full_name: 'No MX User',
          });
          assert.equal(status, 400);
          assert.equal(body.code, 'EMAIL_DOMAIN_HAS_NO_MX');
          assert.equal(
            body.message_ar,
            'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.'
          );
          assert.equal(
            getUserByEmail('user@this-domain-definitely-does-not-exist-xyz123.com'),
            undefined
          );
        } finally {
          setCustomMxResolverForTest(null);
          clearEmailValidationCacheForTest();
          if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv;
          else delete process.env.NODE_ENV;
        }
      }
    );

    // 5. Valid registration creates user with email_verified: false, writes hashed code to data/email_verifications.json (no plaintext code), returns 201 with requires_verification: true and NO session token
    const merchantEmail = 'merchant.verify1@gmail.com';
    await t.test(
      '5. Valid registration creates user with email_verified: false, stores only hashed code, returns 201 requires_verification: true and NO token',
      async () => {
        const { status, body } = await postJson('/api/auth/register', {
          email: merchantEmail,
          password: 'Password123',
          full_name: 'Real Merchant',
          store_name: 'Real Store',
        });

        assert.equal(status, 201);
        assert.equal(body.success, true);
        assert.equal(body.requires_verification, true);
        assert.equal(body.token, undefined, 'Must NOT return a session token on registration');
        assert.equal(
          body.message_ar,
          'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        );

        const createdUser = getUserByEmail(merchantEmail);
        assert.ok(createdUser, 'User should exist in data/users.json');
        assert.equal(createdUser.email_verified, false);
        assert.equal(createdUser.email_verified_at, null);
        assert.equal(createdUser.email_verification_required, true);
        assert.ok(createdUser.last_verification_email_sent_at);

        const rawCode = sentCodesByEmail.get(merchantEmail);
        assert.ok(rawCode && /^\d{6}$/.test(rawCode), '6-digit code must have been generated');

        const rawVerificationsFile = fs.readFileSync(VERIFICATIONS_PATH, 'utf-8');
        assert.equal(
          rawVerificationsFile.includes(`"${rawCode}"`),
          false,
          'Plaintext verification code MUST NOT appear in data/email_verifications.json'
        );

        const records = getEmailVerificationRecordsByEmail(merchantEmail);
        assert.equal(records.length, 1);
        assert.equal(records[0].attempts, 0);
        assert.equal(records[0].max_attempts, 5);
        assert.equal(records[0].used_at, null);
        assert.equal(records[0].code_hash.length, 64);
      }
    );

    // 6. Login before verification returns 403 with code: 'EMAIL_NOT_VERIFIED' and no token
    await t.test(
      '6. Login before verification returns 403 EMAIL_NOT_VERIFIED and no token',
      async () => {
        const { status, body } = await postJson('/api/auth/login', {
          email: merchantEmail,
          password: 'Password123',
        });
        assert.equal(status, 403);
        assert.equal(body.success, false);
        assert.equal(body.code, 'EMAIL_NOT_VERIFIED');
        assert.equal(body.email, merchantEmail);
        assert.equal(body.message_ar, 'يرجى تأكيد بريدك الإلكتروني أولاً');
        assert.equal(body.token, undefined);
      }
    );

    // 7. Wrong verification code increments attempts; after 5 wrong attempts, the 6th attempt with the (now-correct) code STILL fails because the record is locked
    await t.test(
      '7. Wrong verification code increments attempts; after 5 wrong attempts, the 6th attempt with the correct code STILL fails (locked)',
      async () => {
        const correctCode = sentCodesByEmail.get(merchantEmail)!;
        const wrongCode = correctCode === '999999' ? '888888' : '999999';

        for (let i = 1; i <= 5; i++) {
          const { status, body } = await postJson('/api/auth/verify-email', {
            email: merchantEmail,
            code: wrongCode,
          });
          assert.equal(status, 400);
          assert.equal(body.success, false);
        }

        const recordsAfter5 = getEmailVerificationRecordsByEmail(merchantEmail);
        assert.equal(recordsAfter5[0].attempts, 5);

        // 6th attempt with the actual CORRECT code must still fail because record is locked
        const sixthRes = await postJson('/api/auth/verify-email', {
          email: merchantEmail,
          code: correctCode,
        });
        assert.equal(sixthRes.status, 400);
        assert.equal(sixthRes.body.success, false);
        assert.equal(sixthRes.body.code, 'MAX_ATTEMPTS_EXCEEDED');

        const userAfter6 = getUserByEmail(merchantEmail);
        assert.equal(userAfter6?.email_verified, false);
      }
    );

    // 8. Expired code (expires_at in the past) fails verification
    await t.test('8. Expired code (expires_at in the past) fails verification', async () => {
      // Request a fresh code via resend
      const resendRes = await postJson('/api/auth/resend-verification', {
        email: merchantEmail,
      });
      assert.equal(resendRes.status, 200);
      const freshCode = sentCodesByEmail.get(merchantEmail)!;

      // Force expires_at into the past
      const records = getEmailVerificationRecordsByEmail(merchantEmail);
      const activeRecord = records.find((r) => !r.used_at)!;
      updateEmailVerificationRecordForTest(activeRecord.id, {
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      });

      const verifyExpired = await postJson('/api/auth/verify-email', {
        email: merchantEmail,
        code: freshCode,
      });
      assert.equal(verifyExpired.status, 400);
      assert.equal(verifyExpired.body.success, false);
      assert.equal(verifyExpired.body.code, 'INVALID_OR_EXPIRED_CODE');
      assert.equal(getUserByEmail(merchantEmail)?.email_verified, false);
    });

    // 9. Correct code within TTL flips email_verified to true, sets email_verified_at, marks used_at, and subsequent login succeeds
    await t.test(
      '9. Correct code within TTL flips email_verified to true, sets email_verified_at, marks used_at, and subsequent login succeeds',
      async () => {
        const resendRes = await postJson('/api/auth/resend-verification', {
          email: merchantEmail,
        });
        assert.equal(resendRes.status, 200);
        const validCode = sentCodesByEmail.get(merchantEmail)!;

        const verifyRes = await postJson('/api/auth/verify-email', {
          email: merchantEmail,
          code: validCode,
        });
        assert.equal(verifyRes.status, 200);
        assert.equal(verifyRes.body.success, true);

        const verifiedUser = getUserByEmail(merchantEmail)!;
        assert.equal(verifiedUser.email_verified, true);
        assert.ok(verifiedUser.email_verified_at);

        const records = getEmailVerificationRecordsByEmail(merchantEmail);
        assert.ok(records[0].used_at, 'Verification record must have used_at set');

        // Subsequent login succeeds and returns a token
        const loginRes = await postJson('/api/auth/login', {
          email: merchantEmail,
          password: 'Password123',
        });
        assert.equal(loginRes.status, 200);
        assert.equal(loginRes.body.success, true);
        assert.ok(loginRes.body.token, 'Verified user login must return token');
      }
    );

    // 10. Reusing the same code a second time fails
    await t.test('10. Reusing the same code a second time fails', async () => {
      const usedCode = sentCodesByEmail.get(merchantEmail)!;
      const reuseRes = await postJson('/api/auth/verify-email', {
        email: merchantEmail,
        code: usedCode,
      });
      assert.equal(reuseRes.status, 400);
      assert.equal(reuseRes.body.success, false);
    });

    // 11. Owner account (process.env.OWNER_EMAIL) logs in and uses all protected routes regardless of verification state
    await t.test(
      '11. Owner account (process.env.OWNER_EMAIL) bypasses verification and accesses protected routes',
      async () => {
        const ownerUser = getUserByEmail('naadianajah2020@gmail.com')!;
        assert.ok(ownerUser, 'Owner account must exist');
        const ownerToken = createSession(ownerUser.id);

        const statusRes = await fetch(`${baseUrl}/api/auth/verification-status`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(statusRes.status, 200);
        const statusData = (await statusRes.json()) as Record<string, any>;
        assert.equal(statusData.email_verified, true);
        assert.equal(statusData.owner_bypass, true);

        const pagesRes = await fetch(`${baseUrl}/api/pages`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(pagesRes.status, 200);

        const analyticsRes = await fetch(`${baseUrl}/api/analytics`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(analyticsRes.status, 200);
      }
    );
  } finally {
    setEmailVerificationTestInterceptor(null);
    setCustomMxResolverForTest(null);
    clearEmailValidationCacheForTest();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    fs.writeFileSync(USERS_PATH, originalUsers, 'utf-8');
    fs.writeFileSync(VERIFICATIONS_PATH, originalVerifications, 'utf-8');
    fs.writeFileSync(SESSIONS_PATH, originalSessions, 'utf-8');

    if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
    else delete process.env.BYPASS_CAPTCHA;
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    else delete process.env.NODE_ENV;
    if (prevOwnerEmail !== undefined) process.env.OWNER_EMAIL = prevOwnerEmail;
    else delete process.env.OWNER_EMAIL;
  }
});

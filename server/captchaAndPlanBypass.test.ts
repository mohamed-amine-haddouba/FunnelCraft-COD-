import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  verifyCaptchaToken,
  verifyTurnstileToken,
  verifyRecaptchaToken,
  isAdminCaptchaBypass,
} from './captcha';
import { getPlanCapabilities, checkFeatureAccess } from '../src/utils/planLimits';

test('P0 CAPTCHA Fail-Closed & Admin Bypass Regression Suite', async (t) => {
  await t.test('verifyCaptchaToken({}) with no secret env and BYPASS_CAPTCHA unset -> false', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    const prevRecaptcha = process.env.RECAPTCHA_SECRET_KEY;
    try {
      delete process.env.BYPASS_CAPTCHA;
      delete process.env.TURNSTILE_SECRET_KEY;
      delete process.env.RECAPTCHA_SECRET_KEY;

      const valid = await verifyCaptchaToken({});
      assert.equal(valid, false);
      assert.equal(await verifyTurnstileToken('some-token'), false);
      assert.equal(await verifyRecaptchaToken('some-token'), false);
    } finally {
      if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
      else delete process.env.BYPASS_CAPTCHA;
      if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
      else delete process.env.TURNSTILE_SECRET_KEY;
      if (prevRecaptcha !== undefined) process.env.RECAPTCHA_SECRET_KEY = prevRecaptcha;
      else delete process.env.RECAPTCHA_SECRET_KEY;
    }
  });

  await t.test('verifyCaptchaToken({ turnstileToken: "" }) -> false', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    try {
      delete process.env.BYPASS_CAPTCHA;
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({ turnstileToken: '' });
      assert.equal(valid, false);
    } finally {
      if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
      else delete process.env.BYPASS_CAPTCHA;
      if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
      else delete process.env.TURNSTILE_SECRET_KEY;
    }
  });

  await t.test('verifyCaptchaToken({ email: "naadianajah2020@gmail.com" }) -> true', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'false';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      assert.equal(isAdminCaptchaBypass('naadianajah2020@gmail.com', 'merchant'), true);
      const valid = await verifyCaptchaToken({ email: 'naadianajah2020@gmail.com' });
      assert.equal(valid, true);
    } finally {
      if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
      else delete process.env.BYPASS_CAPTCHA;
      if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
      else delete process.env.TURNSTILE_SECRET_KEY;
    }
  });

  await t.test('verifyCaptchaToken({ email: "random@user.com", role: "merchant" }) -> false (no valid token)', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    try {
      delete process.env.BYPASS_CAPTCHA;
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({
        email: 'random@user.com',
        role: 'merchant',
      });
      assert.equal(valid, false);
    } finally {
      if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
      else delete process.env.BYPASS_CAPTCHA;
      if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
      else delete process.env.TURNSTILE_SECRET_KEY;
    }
  });

  await t.test('verifyCaptchaToken({}) with BYPASS_CAPTCHA="true" -> true', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'true';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({});
      assert.equal(valid, true);
    } finally {
      if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
      else delete process.env.BYPASS_CAPTCHA;
      if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
      else delete process.env.TURNSTILE_SECRET_KEY;
    }
  });

  await t.test(
    'POST /api/orders/submit integration test: empty body and missing CAPTCHA token return 400 and do NOT modify data/orders.json',
    async () => {
      process.env.NODE_TEST_NO_LISTEN = '1';
      const prevBypass = process.env.BYPASS_CAPTCHA;
      const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
      const ordersFilePath = path.resolve(process.cwd(), 'data', 'orders.json');

      const { app, startServer } = await import('../server');
      await startServer();

      const beforeContent = fs.existsSync(ordersFilePath)
        ? fs.readFileSync(ordersFilePath, 'utf-8')
        : '[]';

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const addr = server.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      try {
        delete process.env.BYPASS_CAPTCHA;
        process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

        // 1. Empty body -> 400 CAPTCHA error
        const emptyRes = await fetch(`${baseUrl}/api/orders/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.equal(emptyRes.status, 400);
        const emptyBody = (await emptyRes.json()) as { success: boolean; error: string };
        assert.equal(emptyBody.success, false);
        assert.equal(
          emptyBody.error,
          'يرجى إتمام التحقق الأمني (CAPTCHA) قبل تأكيد الطلب.'
        );

        // 2. Payload with customerPhone but no CAPTCHA token -> 400 CAPTCHA error
        const phoneOnlyRes = await fetch(`${baseUrl}/api/orders/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerPhone: '0000000000' }),
        });
        assert.equal(phoneOnlyRes.status, 400);
        const phoneOnlyBody = (await phoneOnlyRes.json()) as { success: boolean; error: string };
        assert.equal(phoneOnlyBody.success, false);
        assert.equal(
          phoneOnlyBody.error,
          'يرجى إتمام التحقق الأمني (CAPTCHA) قبل تأكيد الطلب.'
        );

        const afterContent = fs.existsSync(ordersFilePath)
          ? fs.readFileSync(ordersFilePath, 'utf-8')
          : '[]';
        assert.equal(
          afterContent,
          beforeContent,
          'data/orders.json must remain completely unchanged when CAPTCHA fails'
        );
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        if (prevBypass !== undefined) process.env.BYPASS_CAPTCHA = prevBypass;
        else delete process.env.BYPASS_CAPTCHA;
        if (prevTurnstile !== undefined) process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
        else delete process.env.TURNSTILE_SECRET_KEY;
      }
    }
  );
});

test('Admin Plan Bypass for Custom Domains & Pixels', async (t) => {
  await t.test('grants canUseCustomDomain and canUsePixels when role === "admin" even on free plan', () => {
    const caps = getPlanCapabilities('free', 'admin', 'admin@example.com');
    assert.equal(caps.isAdmin, true);
    assert.equal(caps.canUseCustomDomain, true);
    assert.equal(caps.canUsePixels, true);
    assert.equal(caps.maxPages, Infinity);

    const domainAccess = checkFeatureAccess('custom_domain', {
      plan_id: 'free',
      role: 'admin',
      email: 'admin@example.com',
    });
    assert.equal(domainAccess.allowed, true);

    const pixelAccess = checkFeatureAccess('pixels', {
      plan_id: 'free',
      role: 'admin',
      email: 'admin@example.com',
    });
    assert.equal(pixelAccess.allowed, true);
  });

  await t.test('grants canUseCustomDomain and canUsePixels when email === "naadianajah2020@gmail.com" even if role is merchant and plan is free', () => {
    const caps = getPlanCapabilities('free', 'merchant', 'naadianajah2020@gmail.com', 'different-owner@example.com');
    assert.equal(caps.isAdmin, true);
    assert.equal(caps.canUseCustomDomain, true);
    assert.equal(caps.canUsePixels, true);

    const domainAccess = checkFeatureAccess(
      'custom_domain',
      {
        plan_id: 'free',
        role: 'admin',
        email: 'naadianajah2020@gmail.com',
      },
      10,
      'different-owner@example.com'
    );
    assert.equal(domainAccess.allowed, true);

    const pixelAccess = checkFeatureAccess(
      'pixels',
      {
        plan_id: 'free',
        role: 'merchant',
        email: 'naadianajah2020@gmail.com',
      },
      10,
      'different-owner@example.com'
    );
    assert.equal(pixelAccess.allowed, true);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCaptchaToken, verifyTurnstileToken, isAdminCaptchaBypass } from './captcha';
import { getPlanCapabilities, checkFeatureAccess } from '../src/utils/planLimits';

test('CAPTCHA Verification & Admin Bypass', async (t) => {
  await t.test('bypasses CAPTCHA when BYPASS_CAPTCHA === "true" even with TURNSTILE_SECRET_KEY set', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'true';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({
        turnstileToken: '',
        email: 'merchant@example.com',
        role: 'merchant',
      });
      assert.equal(valid, true);
    } finally {
      process.env.BYPASS_CAPTCHA = prevBypass;
      process.env.TURNSTILE_SECRET_KEY = prevSecret;
    }
  });

  await t.test('bypasses CAPTCHA for Owner email (naadianajah2020@gmail.com) even when BYPASS_CAPTCHA === "false"', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'false';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      assert.equal(isAdminCaptchaBypass('naadianajah2020@gmail.com', 'merchant'), true);

      const valid = await verifyCaptchaToken({
        turnstileToken: '',
        email: 'naadianajah2020@gmail.com',
      });
      assert.equal(valid, true);

      const turnstileDirect = await verifyTurnstileToken('', '1.2.3.4', 'naadianajah2020@gmail.com');
      assert.equal(turnstileDirect, true);
    } finally {
      process.env.BYPASS_CAPTCHA = prevBypass;
      process.env.TURNSTILE_SECRET_KEY = prevSecret;
    }
  });

  await t.test('bypasses CAPTCHA for role === "admin" even when BYPASS_CAPTCHA === "false"', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'false';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({
        turnstileToken: '',
        email: 'other-admin@codworth.me',
        role: 'admin',
      });
      assert.equal(valid, true);
    } finally {
      process.env.BYPASS_CAPTCHA = prevBypass;
      process.env.TURNSTILE_SECRET_KEY = prevSecret;
    }
  });

  await t.test('rejects empty token for non-admin merchant when BYPASS_CAPTCHA === "false" and TURNSTILE_SECRET_KEY is set', async () => {
    const prevBypass = process.env.BYPASS_CAPTCHA;
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    try {
      process.env.BYPASS_CAPTCHA = 'false';
      process.env.TURNSTILE_SECRET_KEY = 'secret-live-turnstile-key';

      const valid = await verifyCaptchaToken({
        turnstileToken: '',
        email: 'regular-merchant@example.com',
        role: 'merchant',
      });
      assert.equal(valid, false);
    } finally {
      process.env.BYPASS_CAPTCHA = prevBypass;
      process.env.TURNSTILE_SECRET_KEY = prevSecret;
    }
  });
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
        role: 'merchant',
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

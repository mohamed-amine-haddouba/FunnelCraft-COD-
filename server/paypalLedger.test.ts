import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCoupon, getCoupons, saveCoupons } from './db';
import { getPayment, savePayment, settlePayment, type ExpectedPayment } from './paypalLedger';

test('PayPal settlement validates provider capture and is idempotent for duplicate delivery', () => {
  const orderId = `codworth-test-${randomUUID()}`;
  const couponCode = `T${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const ledgerFile = fileURLToPath(new URL(`../data/paypal-ledger/${orderId}.json`, import.meta.url));
  const expected: ExpectedPayment = {
    expectedAmount: '19.99',
    expectedCurrency: 'USD',
    priceMAD: 200,
    originalPriceMAD: 200,
    discountAmountMAD: 0,
    couponCode,
    identifier: 'test-product',
    sourceType: 'landing_page',
    userId: 'guest:codworth-test',
    billingCycle: 'monthly',
    createdAt: Date.now(),
  };

  createCoupon({
    code: couponCode,
    discountType: 'fixed',
    discountValue: 1,
    maxUses: 5,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true,
  });

  try {
    savePayment(orderId, expected);
    assert.throws(() => settlePayment(orderId, {
      id: 'capture-not-completed',
      status: 'PENDING',
      amount: '19.99',
      currency: 'USD',
      time: '2026-11-03T12:00:00.000Z',
    }), /does not match/);
    assert.throws(() => settlePayment(orderId, {
      id: 'capture-wrong-amount',
      status: 'COMPLETED',
      amount: '20.00',
      currency: 'USD',
      time: '2026-11-03T12:00:00.000Z',
    }), /does not match/);
    assert.equal(getPayment(orderId)?.captureId, undefined);

    const capture = {
      id: 'capture-codworth-test',
      status: 'COMPLETED',
      amount: '19.99',
      currency: 'USD',
      time: '2026-11-03T12:00:00.000Z',
    };
    assert.equal(settlePayment(orderId, capture), undefined);
    assert.equal(getPayment(orderId)?.captureId, capture.id);
    assert.equal(getCoupons().find(coupon => coupon.code === couponCode)?.currentUses, 1);

    // PayPal may redeliver a webhook or the browser may retry capture.
    settlePayment(orderId, capture);
    assert.equal(getCoupons().find(coupon => coupon.code === couponCode)?.currentUses, 1);

    assert.throws(() => settlePayment(orderId, {
      ...capture,
      id: 'conflicting-capture-id',
    }), /Conflicting capture/);
  } finally {
    saveCoupons(getCoupons().filter(coupon => coupon.code !== couponCode));
    fs.rmSync(ledgerFile, { force: true });
  }
});

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
  const ledgerDirectory = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
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
    assert.throws(() => getPayment('../outside'), /Invalid payment ID/);
    assert.throws(() => savePayment('../outside', expected), /Invalid payment ID/);
    assert.throws(() => savePayment(orderId, { ...expected, expectedAmount: '-1.00' }), /Invalid expected payment/);
    assert.throws(() => savePayment(orderId, { ...expected, expectedCurrency: 'usd' }), /Invalid expected payment/);
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
    assert.equal(getPayment(orderId)?.settlementVersion, 2);
    assert.equal(typeof getPayment(orderId)?.entitlementsAppliedAt, 'number');
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
    if (fs.existsSync(ledgerDirectory)) {
      for (const name of fs.readdirSync(ledgerDirectory)) {
        const file = fileURLToPath(new URL(`../data/paypal-ledger/${name}`, import.meta.url));
        try {
          if (JSON.parse(fs.readFileSync(file, 'utf8')).orderId === orderId) fs.rmSync(file, { force: true });
        } catch { /* unrelated ledger entry */ }
      }
    }
  }
});

test('PayPal ledger remains readable after upgrading from legacy order-ID filenames', () => {
  const id = 'LEGACY-' + randomUUID();
  const dir = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
  const file = fileURLToPath(new URL(`../data/paypal-ledger/${id}.json`, import.meta.url));
  fs.mkdirSync(dir, { recursive: true });
  const legacy: ExpectedPayment = {
    expectedAmount: '15.00', expectedCurrency: 'USD', priceMAD: 150,
    originalPriceMAD: 150, discountAmountMAD: 0,
    identifier: 'legacy-product', sourceType: 'landing_page',
    userId: 'guest:legacy-test', billingCycle: 'monthly', createdAt: Date.now(),
  };
  try {
    // Legacy files have no embedded orderId; loading them must not trigger
    // a new purchase or silently forget a captured payment.
    fs.writeFileSync(file, JSON.stringify(legacy), { flag: 'wx', mode: 0o600 });
    assert.equal(getPayment(id)?.expectedAmount, '15.00');
    assert.equal(getPayment(id)?.captureId, undefined);
    savePayment(id, { ...legacy, captureId: 'CAPTURE-LEGACY', capturedAt: Date.now() });
    assert.equal(getPayment(id)?.captureId, 'CAPTURE-LEGACY');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).orderId, id);
    assert.equal(fs.readdirSync(dir).filter(name => name === id + '.json').length, 1);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('Corrupted legacy ledger fails closed instead of being treated as an unpaid order', () => {
  const id = 'CORRUPT-' + randomUUID();
  const dir = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
  const file = fileURLToPath(new URL(`../data/paypal-ledger/${id}.json`, import.meta.url));
  fs.mkdirSync(dir, { recursive: true });
  try {
    // Populate a negative cache entry before the legacy file arrives.
    // A rapid write must not make a corrupt checkout look unpaid/unknown.
    assert.equal(getPayment(id), undefined);
    fs.writeFileSync(file, '{BROKEN JSON', { flag: 'wx', mode: 0o600 });
    assert.throws(() => getPayment(id), /corrupt/i);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('Interrupted v2 settlement is resumed exactly once without duplicate coupon redemption', () => {
  const orderId = 'RECOVER-' + randomUUID();
  const couponCode = 'R' + randomUUID().replace(/-/g,'').slice(0, 10).toUpperCase();
  const dir = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
  const capturedAt = Date.parse('2026-11-03T12:00:00Z');
  createCoupon({
    code: couponCode, discountType: 'fixed', discountValue: 1,
    maxUses: 5, expiresAt: '2027-12-31T23:59:59.000Z', isActive: true,
  });
  const ledger: ExpectedPayment = {
    expectedAmount: '25.00', expectedCurrency: 'USD', priceMAD: 250,
    originalPriceMAD: 251, discountAmountMAD: 1, couponCode,
    identifier: 'recoverable-fixture', sourceType: 'landing_page',
    userId: 'guest:recoverable-fixture', billingCycle: 'monthly',
    createdAt: capturedAt - 1000, captureId: 'RECOVERY-CAPTURE',
    capturedAt, settlementVersion: 2,
  };
  try {
    // Simulate a crash after the verified capture is durably recorded but
    // before the coupon/entitlement side effects have been applied.
    savePayment(orderId, ledger);
    const capture = { id: 'RECOVERY-CAPTURE', status: 'COMPLETED',
      amount: '25.00', currency: 'USD', time: new Date(capturedAt).toISOString() };
    settlePayment(orderId, capture);
    const applied = getPayment(orderId)!;
    assert.equal(typeof applied.entitlementsAppliedAt, 'number');
    assert.equal(getCoupons().find(c=>c.code===couponCode)?.currentUses, 1);
    settlePayment(orderId, capture);
    assert.equal(getPayment(orderId)?.entitlementsAppliedAt, applied.entitlementsAppliedAt);
    assert.equal(getCoupons().find(c=>c.code===couponCode)?.currentUses, 1);
  } finally {
    saveCoupons(getCoupons().filter(c=>c.code!==couponCode));
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const file = fileURLToPath(new URL(`../data/paypal-ledger/${name}`, import.meta.url));
        try {
          if (JSON.parse(fs.readFileSync(file,'utf8')).orderId===orderId) fs.rmSync(file,{force:true});
        } catch { /* unrelated data */ }
      }
    }
  }
});

test('Legacy captured checkouts never replay subscription or coupon side effects', () => {
  const orderId = 'LEGACY-CAPTURE-' + randomUUID();
  const dir = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
  const captureTime = Date.parse('2026-11-03T12:00:00Z');
  const ledger: ExpectedPayment = {
    expectedAmount:'12.00',expectedCurrency:'USD',priceMAD:120,
    originalPriceMAD:120,discountAmountMAD:0,
    identifier:'legacy',sourceType:'landing_page',userId:'guest:legacy',
    billingCycle:'monthly',createdAt:captureTime-1000,
    captureId:'LEGACY-CAPTURE',capturedAt:captureTime,
  };
  try {
    savePayment(orderId, ledger);
    settlePayment(orderId, {id:'LEGACY-CAPTURE',status:'COMPLETED',amount:'12.00',currency:'USD',time:new Date(captureTime).toISOString()});
    assert.equal(getPayment(orderId)?.entitlementsAppliedAt, undefined);
    assert.equal(getPayment(orderId)?.settlementVersion, undefined);
  } finally {
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        const file = fileURLToPath(new URL(`../data/paypal-ledger/${name}`, import.meta.url));
        try {
          if (JSON.parse(fs.readFileSync(file,'utf8')).orderId===orderId) fs.rmSync(file,{force:true});
        } catch { /* unrelated data */ }
      }
    }
  }
});

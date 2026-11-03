import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePayPalSnapshots, type PayPalLedgerSnapshot, type PaidOrderSnapshot } from './paymentReconciliation';

const now = Date.parse('2026-11-03T12:00:00Z');
const settled: PayPalLedgerSnapshot = {
  orderId: 'PAYPAL-ORDER-1', expectedAmount: '18.20', expectedCurrency: 'USD',
  createdAt: now - 60 * 60 * 1000,
  capturedAt: now - 45 * 60 * 1000, captureId: 'CAPTURE-1',
  sourceType: 'landing_page', userId: 'guest-id',
  quote: { ownerId: 'merchant-a', price: 185, currency: 'MAD' },
};
const storefront: PaidOrderSnapshot = {
  id: 'store-order-a', paypalOrderId: 'PAYPAL-ORDER-1', paymentMethod: 'paypal',
  status: 'paid', userId: 'merchant-a', price: 185, currency: 'MAD',
};
const codes = (ledgers: PayPalLedgerSnapshot[], orders: PaidOrderSnapshot[]) =>
  reconcilePayPalSnapshots(ledgers, orders, now).findings.map(f => f.code);

test('financial reconciliation leaves a consistent paid product order with no findings', () => {
  const result = reconcilePayPalSnapshots([settled], [storefront], now);
  assert.deepEqual(result.findings, []);
  assert.equal(result.hasBlockers, false);
  assert.equal(result.capturedPayments, 1);
  assert.equal(result.paypalStorefrontOrders, 1);
});

test('finds missing and duplicated capture records without outputting customer data', () => {
  const results = reconcilePayPalSnapshots(
    [settled, {...settled, orderId:'PAYPAL-ORDER-2'}, {...settled, captureId:'CAPTURE-3'}],
    [storefront, {...storefront, id:'store-order-b'}],
    now
  );
  const findings = results.findings;
  assert.ok(findings.some(f => f.code === 'DUPLICATE_CAPTURE'));
  assert.ok(findings.some(f => f.code === 'DUPLICATE_PAYMENT_ORDER'));
  assert.ok(findings.some(f => f.code === 'DUPLICATE_PRODUCT_ORDER'));
  assert.equal(results.hasBlockers, true);
  const report = JSON.stringify(results);
  assert.equal(report.includes('merchant-a'), false);
  assert.equal(report.includes('PAYPAL-ORDER-1'), false);
});

test('flags paid orders without a verified ledger, merchant mismatches and wrong quotes', () => {
  const missing = {...storefront, paypalOrderId:'PAYPAL-MISSING'};
  const wrongOwner = {...storefront, userId:'merchant-b', price:100};
  const result = reconcilePayPalSnapshots([settled], [missing, wrongOwner], now);
  assert.deepEqual(result.findings.filter(f => f.severity==='blocker').map(f=>f.code),
    ['MERCHANT_OWNERSHIP_MISMATCH', 'PAID_ORDER_MISSING_PAYMENT', 'PRODUCT_QUOTE_MISMATCH']);
});

test('alerts when captured product checkout has no order after 30 minutes', () => {
  const missing = reconcilePayPalSnapshots([settled], [], now);
  assert.deepEqual(missing.findings.map(f=>f.code), ['CAPTURED_PRODUCT_NO_ORDER']);
  assert.equal(missing.hasBlockers, false);
  assert.equal(codes([{...settled,capturedAt:now-1000}], []).length,0);
});

test('flags stale uncaptured checkout and forged paid status without capture', () => {
  const result = reconcilePayPalSnapshots(
    [{...settled,captureId:undefined,capturedAt:undefined,createdAt:now-90000000}],
    [storefront], now
  );
  assert.deepEqual(result.findings.map(f=>f.code), ['PAID_ORDER_UNCAPTURED', 'STALE_UNCAPTURED_CHECKOUT']);
  assert.equal(result.hasBlockers,true);
});

test('rejects malformed amounts or missing order IDs without throwing or leaking IDs', () => {
  const result = reconcilePayPalSnapshots(
    [{...settled,expectedAmount:'-1.00'},{...settled,expectedCurrency:'usd'},{...settled,orderId:undefined}],
    [],now
  );
  assert.deepEqual(result.findings, [{code:'INVALID_LEDGER',count:3,severity:'blocker'}]);
});

test('flags verified captures whose v2 settlement side effects are incomplete', () => {
  const interrupted = { ...settled, settlementVersion: 2, entitlementsAppliedAt: undefined };
  const broken = reconcilePayPalSnapshots([interrupted], [storefront], now);
  assert.deepEqual(broken.findings, [{ code:'CAPTURE_SIDE_EFFECTS_PENDING', count:1, severity:'blocker' }]);
  assert.equal(broken.hasBlockers,true);
  const done = reconcilePayPalSnapshots([{ ...interrupted, entitlementsAppliedAt: now }], [storefront], now);
  assert.equal(done.hasBlockers,false);
});

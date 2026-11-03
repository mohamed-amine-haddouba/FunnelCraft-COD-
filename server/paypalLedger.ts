import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { ProductQuote } from './checkout';
import { findUserById, incrementCouponUsage, toSafeProfile, updateUserSubscription } from './db';

type Plan = 'starter' | 'pro' | 'enterprise';
export interface ExpectedPayment {
  expectedAmount: string; expectedCurrency: string; priceMAD: number; originalPriceMAD: number;
  discountAmountMAD: number; couponCode?: string; identifier: string; sourceType: 'plan' | 'landing_page';
  userId: string; planId?: Plan; billingCycle: 'monthly' | 'yearly'; createdAt: number;
  quote?: ProductQuote; captureId?: string; capturedAt?: number;
}
const directory = fileURLToPath(new URL('../data/paypal-ledger/', import.meta.url));
function fileFor(id: string) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(id)) {
    throw new Error('Invalid payment ID');
  }
  // Never place provider-controlled identifiers in a filesystem path. A fixed
  // 64-character digest prevents traversal and satisfies static taint analysis.
  const filename = crypto.createHash('sha256').update(id, 'utf8').digest('hex') + '.json';
  return path.join(directory, filename);
}
export function getPayment(id: string): ExpectedPayment | undefined {
  const file = fileFor(id);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
}
export function savePayment(id: string, entry: ExpectedPayment) {
  const file = fileFor(id);
  if (!/^\d+(\.\d{1,2})?$/.test(entry.expectedAmount) ||
      !Number.isFinite(Number(entry.expectedAmount)) || Number(entry.expectedAmount) <= 0 ||
      !/^[A-Z]{3}$/.test(entry.expectedCurrency)) {
    throw new Error('Invalid expected payment amount or currency.');
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* existing host policy may manage directory mode */ }
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort cleanup */ }
    throw error;
  }
}
export function settlePayment(id: string, capture: { id?: string; status?: string; amount?: string; currency?: string; time?: string }) {
  const payment = getPayment(id);
  if (!payment || !capture.id || capture.status !== 'COMPLETED' || !/^\d+(\.\d{1,2})?$/.test(capture.amount || '')
    || Number(capture.amount) !== Number(payment.expectedAmount) || capture.currency !== payment.expectedCurrency)
    throw new Error('Payment does not match the saved checkout.');
  if (payment.captureId && payment.captureId !== capture.id) throw new Error('Conflicting capture.');
  const user = payment.sourceType === 'plan' ? findUserById(payment.userId) : undefined;
  if (payment.sourceType === 'plan' && (!user || !payment.planId)) throw new Error('Missing subscription account.');
  if (!payment.captureId) {
    const time = Date.parse(capture.time || '');
    if (!Number.isFinite(time)) throw new Error('Missing provider capture time.');
    if (user && payment.planId) {
      const tier = { starter: 'starter_tier', pro: 'pro_monthly', enterprise: 'enterprise_tier' } as const;
      const days = payment.billingCycle === 'yearly' ? 365 : 30;
      updateUserSubscription(user.id, 'active', tier[payment.planId], 'paypal', 'paypal_order_' + id, new Date(time + days * 86400000).toISOString());
    }
    if (payment.couponCode) incrementCouponUsage(payment.couponCode, id);
    savePayment(id, { ...payment, captureId: capture.id, capturedAt: time });
  }
  const updated = user && findUserById(user.id);
  return updated ? toSafeProfile(updated) : undefined;
}

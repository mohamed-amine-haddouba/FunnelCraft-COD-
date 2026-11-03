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
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) throw new Error('Invalid payment ID');
  return path.join(directory, id + '.json');
}
export function getPayment(id: string): ExpectedPayment | undefined {
  const file = fileFor(id);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
}
export function savePayment(id: string, entry: ExpectedPayment) {
  fs.mkdirSync(directory, { recursive: true });
  const file = fileFor(id), tmp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entry), { mode: 0o600 });
  fs.renameSync(tmp, file);
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

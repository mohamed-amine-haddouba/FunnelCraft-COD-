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
function validatePaymentId(id: string): void {
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(id)) {
    throw new Error('Invalid payment ID');
  }
}

// Provider order IDs are stored as data, never used to construct a filesystem
// path. Each ledger file receives a random server-generated UUID filename.
const paymentFileIndex = new Map<string, string>();
let paymentFileIndexLoaded = false;

function findPaymentFile(id: string): string | undefined {
  validatePaymentId(id);
  const cached = paymentFileIndex.get(id);
  if (cached && fs.existsSync(cached)) return cached;
  if (!fs.existsSync(directory)) return undefined;

  // Compatibility with earlier releases: old ledgers were written as
  // <paypalOrderId>.json without an orderId field inside the record.
  // Never derive a filesystem path from a network-supplied order ID.
  // Instead, enumerate directory entries and validate them before reading.
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!item.isFile() || !/^[A-Za-z0-9-]{1,80}\.json$/.test(item.name)) continue;
    const file = path.join(directory, item.name);
    const basename = item.name.slice(0, -5);
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // A corrupt legacy ledger belonging to this order must not look like an
      // unpaid/unknown checkout. Other corrupt files are flagged by the
      // read-only reconciliation report.
      if (basename === id) throw new Error('Payment ledger is corrupt; reconcile before continuing.');
      continue;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const storedId = typeof record.orderId === 'string'
      ? record.orderId
      : typeof record.expectedAmount === 'string' && typeof record.userId === 'string'
        ? basename
        : undefined;
    if (storedId && /^[A-Za-z0-9-]{1,80}$/.test(storedId)) {
      const indexed = paymentFileIndex.get(storedId);
      if (indexed && indexed !== file) {
        throw new Error('Duplicate payment ledgers detected; manual reconciliation required.');
      }
      paymentFileIndex.set(storedId, file);
    }
  }
  return paymentFileIndex.get(id);
}

export function getPayment(id: string): ExpectedPayment | undefined {
  const file = findPaymentFile(id);
  if (!file) return undefined;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid payment ledger entry.');
  }
  // Pre-upgrade records have no embedded orderId but are addressed only by
  // a validated, enumerated legacy filename.
  if (record.orderId !== undefined && record.orderId !== id) {
    throw new Error('Payment ledger order ID mismatch.');
  }
  const { orderId: _storedOrderId, ...payment } = record;
  return payment as ExpectedPayment;
}

export function savePayment(id: string, entry: ExpectedPayment) {
  const existing = findPaymentFile(id);
  if (!/^\d+(\.\d{1,2})?$/.test(entry.expectedAmount) ||
      !Number.isFinite(Number(entry.expectedAmount)) || Number(entry.expectedAmount) <= 0 ||
      !/^[A-Z]{3}$/.test(entry.expectedCurrency)) {
    throw new Error('Invalid expected payment amount or currency.');
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* host policy may manage directory mode */ }
  const file = existing || path.join(directory, crypto.randomUUID() + '.json');
  const tmp = path.join(directory, crypto.randomUUID() + '.tmp');
  try {
    fs.writeFileSync(tmp, JSON.stringify({ ...entry, orderId: id }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(tmp, file);
    paymentFileIndex.set(id, file);
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

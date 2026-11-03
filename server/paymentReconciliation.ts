/**
 * Offline, read-only payment reconciliation. The report deliberately contains
 * aggregate counts only: no payer, merchant, order, capture IDs or file paths.
 * It does not replace retrieving refunds/disputes from the payment providers.
 */
export interface PayPalLedgerSnapshot {
  orderId?: unknown;
  expectedAmount?: unknown;
  expectedCurrency?: unknown;
  sourceType?: unknown;
  userId?: unknown;
  quote?: { ownerId?: unknown; price?: unknown; currency?: unknown } | null;
  captureId?: unknown;
  capturedAt?: unknown;
  createdAt?: unknown;
}
export interface PaidOrderSnapshot {
  id?: unknown;
  userId?: unknown;
  paypalOrderId?: unknown;
  paymentMethod?: unknown;
  status?: unknown;
  price?: unknown;
  currency?: unknown;
}
export type ReconciliationFindingCode =
  | 'INVALID_LEDGER'
  | 'DUPLICATE_PAYMENT_ORDER'
  | 'DUPLICATE_CAPTURE'
  | 'INVALID_CAPTURE_TIME'
  | 'PAID_ORDER_MISSING_PAYMENT'
  | 'PAID_ORDER_UNCAPTURED'
  | 'DUPLICATE_PRODUCT_ORDER'
  | 'MERCHANT_OWNERSHIP_MISMATCH'
  | 'PRODUCT_QUOTE_MISMATCH'
  | 'CAPTURED_PRODUCT_NO_ORDER'
  | 'STALE_UNCAPTURED_CHECKOUT'
  | 'UNLINKED_PAYPAL_ORDER';
export interface ReconciliationFinding {
  code: ReconciliationFindingCode;
  severity: 'blocker' | 'review';
  count: number;
}
const orderIdPattern = /^[A-Za-z0-9-]{1,80}$/;
const amountPattern = /^\d+(\.\d{1,2})?$/;
const thirtyMinutes = 30 * 60 * 1000;

export function reconcilePayPalSnapshots(
  ledgerEntries: ReadonlyArray<PayPalLedgerSnapshot>,
  storefrontOrders: ReadonlyArray<PaidOrderSnapshot>,
  now = Date.now()
): {
  ledgerEntries: number;
  capturedPayments: number;
  paypalStorefrontOrders: number;
  findings: ReconciliationFinding[];
  hasBlockers: boolean;
} {
  const counts = new Map<ReconciliationFindingCode, number>();
  const add = (code: ReconciliationFindingCode) => counts.set(code, (counts.get(code) || 0) + 1);
  const ledgerById = new Map<string, PayPalLedgerSnapshot>();
  const captureIds = new Set<string>();
  const ordersByPayment = new Map<string, PaidOrderSnapshot[]>();
  let capturedPayments = 0;

  for (const order of storefrontOrders) {
    if (order.paymentMethod !== 'paypal') continue;
    const id = order.paypalOrderId;
    if (typeof id !== 'string' || !orderIdPattern.test(id)) {
      add('UNLINKED_PAYPAL_ORDER');
      continue;
    }
    const matches = ordersByPayment.get(id) || [];
    matches.push(order);
    ordersByPayment.set(id, matches);
  }

  for (const entry of ledgerEntries) {
    const id = entry?.orderId;
    const amount = entry?.expectedAmount;
    const currency = entry?.expectedCurrency;
    if (typeof id !== 'string' || !orderIdPattern.test(id) ||
        typeof amount !== 'string' || !amountPattern.test(amount) ||
        Number(amount) <= 0 || !Number.isFinite(Number(amount)) ||
        typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
        (entry.sourceType !== 'plan' && entry.sourceType !== 'landing_page')) {
      add('INVALID_LEDGER');
      continue;
    }
    if (ledgerById.has(id)) {
      add('DUPLICATE_PAYMENT_ORDER');
      continue;
    }
    ledgerById.set(id, entry);
    if (entry.captureId !== undefined) {
      if (typeof entry.captureId !== 'string' || entry.captureId.length === 0) {
        add('INVALID_LEDGER');
        continue;
      }
      capturedPayments += 1;
      if (captureIds.has(entry.captureId)) add('DUPLICATE_CAPTURE');
      captureIds.add(entry.captureId);
      if (typeof entry.capturedAt !== 'number' || !Number.isFinite(entry.capturedAt)) {
        add('INVALID_CAPTURE_TIME');
      }
      if (entry.sourceType === 'landing_page') {
        const orders = ordersByPayment.get(id) || [];
        const timestamp = typeof entry.capturedAt === 'number' ? entry.capturedAt : Number.NaN;
        if (!orders.length && Number.isFinite(timestamp) && now - timestamp >= thirtyMinutes) {
          add('CAPTURED_PRODUCT_NO_ORDER');
        }
      }
    } else {
      if (typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) &&
          now - entry.createdAt >= 24 * 60 * 60 * 1000) add('STALE_UNCAPTURED_CHECKOUT');
    }
  }

  for (const [id, orders] of ordersByPayment) {
    if (orders.length > 1) add('DUPLICATE_PRODUCT_ORDER');
    const payment = ledgerById.get(id);
    for (const order of orders) {
      if (!payment) {
        if (order.status === 'paid') add('PAID_ORDER_MISSING_PAYMENT');
        else add('UNLINKED_PAYPAL_ORDER');
        continue;
      }
      if (!payment.captureId && order.status === 'paid') add('PAID_ORDER_UNCAPTURED');
      if (payment.sourceType !== 'landing_page') {
        add('PRODUCT_QUOTE_MISMATCH');
        continue;
      }
      const quote = payment.quote;
      if (quote && typeof quote.ownerId === 'string' &&
          order.userId !== quote.ownerId) add('MERCHANT_OWNERSHIP_MISMATCH');
      if (quote && typeof quote.price === 'number' && typeof order.price === 'number' &&
          (Math.abs(quote.price - order.price) > 0.001 ||
           (typeof quote.currency === 'string' && order.currency !== quote.currency))) {
        add('PRODUCT_QUOTE_MISMATCH');
      }
    }
  }

  const blockers = new Set<ReconciliationFindingCode>([
    'INVALID_LEDGER', 'DUPLICATE_PAYMENT_ORDER', 'DUPLICATE_CAPTURE',
    'INVALID_CAPTURE_TIME', 'PAID_ORDER_MISSING_PAYMENT', 'PAID_ORDER_UNCAPTURED',
    'DUPLICATE_PRODUCT_ORDER', 'MERCHANT_OWNERSHIP_MISMATCH', 'PRODUCT_QUOTE_MISMATCH',
  ]);
  const findings: ReconciliationFinding[] = [...counts.entries()].map(([code, count]) => ({
    code, count, severity: blockers.has(code) ? 'blocker' : 'review',
  })).sort((a,b) => a.code.localeCompare(b.code));
  return {
    ledgerEntries: ledgerEntries.length,
    capturedPayments,
    paypalStorefrontOrders: [...ordersByPayment.values()].reduce((n, rows) => n + rows.length, 0),
    findings,
    hasBlockers: findings.some(item => item.severity === 'blocker'),
  };
}

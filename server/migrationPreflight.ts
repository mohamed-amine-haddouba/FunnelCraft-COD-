/**
 * Read-only migration preflight for moving JSON/Map state into PostgreSQL.
 * Emits aggregate counts only; never displays user records, IDs or PII.
 * This is NOT a migration and performs no writes.
 */
export interface MigrationPreflightInput {
  users: unknown;
  pages: unknown;
  orders: unknown;
  payments: unknown;
}
type Dataset = 'users' | 'pages' | 'orders' | 'payments';
export type MigrationIssueCode =
  | 'MALFORMED_ROW'
  | 'MISSING_ID'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_EMAIL'
  | 'PAGE_OWNER_MISSING'
  | 'ORDER_OWNER_MISSING'
  | 'MANUAL_PAYMENT_OWNER_MISSING'
  | 'INVALID_ORDER_AMOUNT'
  | 'INVALID_ORDER_DATE';
export interface MigrationIssue {
  dataset: Dataset;
  code: MigrationIssueCode;
  count: number;
  severity: 'blocker' | 'review';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function preflightLegacyData(input: MigrationPreflightInput) {
  const errors = new Map<string, MigrationIssue>();
  const counts: Record<Dataset, number> = { users: 0, pages: 0, orders: 0, payments: 0 };
  const keys: Dataset[] = ['users', 'pages', 'orders', 'payments'];
  const rows: Record<Dataset, Record<string, unknown>[]> =
    { users: [], pages: [], orders: [], payments: [] };
  const report = (dataset: Dataset, code: MigrationIssueCode, severity: 'blocker' | 'review' = 'blocker') => {
    const k = dataset + ':' + code;
    const old = errors.get(k);
    errors.set(k, { dataset, code, severity, count: (old?.count || 0) + 1 });
  };
  for (const dataset of keys) {
    const raw = input[dataset];
    if (!Array.isArray(raw)) {
      report(dataset, 'MALFORMED_ROW');
      continue;
    }
    counts[dataset] = raw.length;
    const ids = new Set<string>();
    for (const item of raw) {
      if (!isRecord(item)) { report(dataset, 'MALFORMED_ROW'); continue; }
      rows[dataset].push(item);
      if (typeof item.id !== 'string' || !item.id.trim()) {
        report(dataset, 'MISSING_ID');
      } else if (ids.has(item.id)) {
        report(dataset, 'DUPLICATE_ID');
      } else ids.add(item.id);
    }
  }
  const userIds = new Set(rows.users.filter(r => typeof r.id === 'string').map(r => r.id));
  const emails = new Set<string>();
  for (const user of rows.users) {
    if (typeof user.email !== 'string' || !user.email.trim()) {
      report('users', 'MALFORMED_ROW');
    } else {
      const email = user.email.trim().toLowerCase();
      if (emails.has(email)) report('users', 'DUPLICATE_EMAIL');
      emails.add(email);
    }
  }
  for (const page of rows.pages) {
    if (typeof page.userId !== 'string' || !userIds.has(page.userId))
      report('pages', 'PAGE_OWNER_MISSING');
  }
  for (const order of rows.orders) {
    if (typeof order.userId !== 'string' || !userIds.has(order.userId))
      report('orders', 'ORDER_OWNER_MISSING', 'review'); // legacy orders may be unassigned
    if (typeof order.price !== 'number' || !Number.isFinite(order.price) || order.price < 0)
      report('orders', 'INVALID_ORDER_AMOUNT');
    if (typeof order.createdAt !== 'string' || !Number.isFinite(Date.parse(order.createdAt)))
      report('orders', 'INVALID_ORDER_DATE');
  }
  for (const payment of rows.payments) {
    if (typeof payment.userId !== 'string' || !userIds.has(payment.userId))
      report('payments', 'MANUAL_PAYMENT_OWNER_MISSING', 'review');
  }
  const issues = [...errors.values()].sort((a,b) =>
    (a.dataset + ':' + a.code).localeCompare(b.dataset + ':' + b.code));
  return {
    mode: 'read-only',
    counts,
    issues,
    hasBlockers: issues.some(issue => issue.severity === 'blocker'),
    needsManualReview: issues.some(issue => issue.severity === 'review'),
  };
}

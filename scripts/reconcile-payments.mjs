#!/usr/bin/env node
/**
 * Read-only PayPal ledger / storefront-order audit.
 * Run: node --import tsx scripts/reconcile-payments.mjs
 * Does not call Stripe/PayPal, edit files, grant access, or log PII.
 * Run against a stopped service or a consistent snapshot to avoid transient
 * mismatches while separate JSON files are being updated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcilePayPalSnapshots } from '../server/paymentReconciliation.ts';

const data = fileURLToPath(new URL('../data/', import.meta.url));
const ledgerDirectory = path.join(data, 'paypal-ledger');
const ordersFile = path.join(data, 'orders.json');
let badLedgerFiles = 0;
let otherStorageErrors = 0;
let ledgerEntries = [];
let orders = [];

try {
  if (fs.existsSync(ledgerDirectory)) {
    for (const item of fs.readdirSync(ledgerDirectory, { withFileTypes: true })) {
      if (!item.isFile() || !/^[A-Za-z0-9-]{1,80}\.json$/.test(item.name)) {
        badLedgerFiles += 1;
        continue;
      }
      try {
        const file = path.join(ledgerDirectory, item.name);
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          badLedgerFiles += 1;
          continue;
        }
        // Old releases used <orderId>.json and stored no orderId property.
        const inferredId = item.name.slice(0, -5);
        ledgerEntries.push({ ...raw, orderId: raw.orderId ?? inferredId });
      } catch {
        badLedgerFiles += 1;
      }
    }
  }
  if (fs.existsSync(ordersFile)) {
    const parsed = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('orders.json is not an array');
    orders = parsed;
  } else if (ledgerEntries.length) {
    otherStorageErrors += 1;
  }
} catch {
  otherStorageErrors += 1;
}

const audit = reconcilePayPalSnapshots(ledgerEntries, orders);
const result = {
  mode: 'read-only',
  provider: 'paypal',
  dataSource: 'local data/ snapshot',
  ledgerEntries: audit.ledgerEntries,
  capturedPayments: audit.capturedPayments,
  paypalStorefrontOrders: audit.paypalStorefrontOrders,
  unreadableOrUnsafeLedgerFiles: badLedgerFiles,
  storageErrors: otherStorageErrors,
  findings: audit.findings,
  hasBlockingFindings: audit.hasBlockers || badLedgerFiles > 0 || otherStorageErrors > 0,
  limitations: [
    'Not proof of provider settlement, refunds, reversals, or chargebacks.',
    'Run against a consistent snapshot for meaningful cross-file comparisons.',
    'Do not auto-fix records or grant entitlements based on this report.',
  ],
};
console.log(JSON.stringify(result, null, 2));
if (result.hasBlockingFindings) process.exitCode = 2;

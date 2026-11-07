# CodWorth — PayPal ledger and order reconciliation

## Purpose

A **read-only**, local audit of PayPal expected checkouts and paid product orders. It identifies consistency gaps and emits **aggregate counts**, not buyer names, emails, phone numbers, payment IDs, or raw ledger records.

### Run on an isolated snapshot

From a CodWorth checkout containing a consistent snapshot of `data/`:

```bash
node --import tsx scripts/reconcile-payments.mjs
```

For a production review, stop writes briefly or restore a **GPG-encrypted backup** into a separately isolated workspace first. Do not run against actively changing files and mistake a transient cross-file timing gap for a confirmed financial discrepancy. The command only reads `data/orders.json` and `data/paypal-ledger/*.json`.

Exit codes: `0` means **no blocking local consistency findings** (not proof of settlement); `2` means at least one blocking issue or unreadable storage entry. Non-blocking `review` findings require manual follow-up. There are **no automatic data changes**, refunds, subscription grants, or live API calls.

### Checks included

- Legacy PayPal checkout records with filenames `<providerOrderId>.json` remain readable after the UUID ledger filename upgrade; corrupt legacy files fail closed.
- Multiple ledger records for the same PayPal order, duplicate capture IDs, invalid currency/amount/time.
- `CAPTURE_SIDE_EFFECTS_PENDING`: a **verified v2** capture was saved but durable subscription/coupon side effects have not yet been marked complete. The buyer's authorized retry or verified PayPal webhook can resume this settlement idempotently; do not assume that an older legacy checkout should be replayed.
- Paid storefront order without a saved verified capture, or duplicate product orders linked to the same PayPal checkout.
- Cross-merchant ownership or published quote amount/currency mismatch.
- Old captured product checkouts without a corresponding order; very old uncaptured checkouts.

### What this does **not** verify

The local ledger records an expected amount and a capture ID, **not** provider-confirmed refund, chargeback, reversal, dispute, settlement, exchange rate, or cash-received status. For financial sign-off, compare this report with **signed provider events, PayPal Transaction Reports and Stripe balance transactions** in a sandbox, then separately in production with dual-control procedures.

For new PayPal checkouts, CodWorth now records the verified capture **before** local entitlement/coupon changes. A retry can finish an interrupted v2 settlement without extending the subscription twice or consuming the same coupon twice. Legacy captured checkouts lack the v2 marker and are deliberately not replayed: review them manually if reconciliation indicates a discrepancy.

Never mark an order as paid or active, issue refunds, or overwrite customer records solely because this report shows a finding. Investigate discrepancies by authorized operator using provider dashboards and immutable event references. Keep sensitive raw records private; the aggregate JSON report is suitable for sharing in a bug report.

### Release gate

Before merging PR #2, replay fixture tests and confirm that at least one legacy checkout remains readable. Before public launch, test PayPal Sandbox and Stripe Test Mode end to end, duplicate webhooks, out-of-order events, refund/chargeback handling and order-state consistency. Replace JSON/Map payment state with transactional storage before multi-instance deployment.

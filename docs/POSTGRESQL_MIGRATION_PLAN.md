# CodWorth — PostgreSQL migration plan (safe staged approach)

The current application uses in-memory Maps plus local JSON files. **Do not switch the live app to PostgreSQL by changing an env variable**: the persistence layer is not yet transactional and a blind cutover could lose merchant orders/payments.

## Phase 0 — preflight (implemented, read-only)

On a **separately restored GPG backup**:

```bash
node --import tsx scripts/postgres-preflight.mjs
node --import tsx scripts/reconcile-payments.mjs
```

The first audit emits only aggregate counts of users, pages, orders, manual payments, duplicate identifiers, duplicate normalized emails, missing owner references, and invalid order dates/amounts. Exit code `2` requires manual review. Neither script changes production state or performs actual migrations. Review ambiguous legacy orders with absent owner IDs before assigning them to merchants. Payment provider events still need independent reconciliation.

## Phase 1 — schema design and transactional persistence (not implemented yet)

Create versioned SQL migrations for `users`, `sessions`, `pages`, `orders`, `manual_payments`, `paypal_expected_payments`, `paypal_capture_events`, `stripe_events`, `subscription_entitlements`, `coupons`, `coupon_redemptions`, `login_audit` and `migration_state`.

Key requirements:
- UUID/surrogate primary keys and immutable `merchant_id` foreign keys, with database-enforced tenancy (optionally row-level security after app user contexts are audited).
- Unique provider event/order/capture IDs, compound unique `(coupon_id, redemption_id)` and explicit transactional idempotency.
- Decimal amounts stored as integers in minor currency units with ISO 4217 currency identifiers; never add dissimilar currencies.
- `timestamptz` consistently, preserving original provider times and original timezone offsets in imports where necessary.
- FK rules that preserve financial history on user deletion (anonymize PII separately where legally appropriate, rather than cascading financial ledger deletion).
- Append-only raw event references (avoid logging sensitive payment payloads or secrets), attempt logs, webhook signature verification before processing.
- An outbox/queue for notifications and per-payment processing; provider calls must not happen inside long DB transactions.

## Phase 2 — shadow imports and verification (not implemented yet)

1. Generate and test migrations against a dedicated staging PostgreSQL instance; no real payment keys or production user PII.
2. Import a **consistent** restored snapshot and record file checksum, row count, orphan/duplicate counts and data shape for each table.
3. Compare stable merchant-order relationships and totals **per currency and payment status**, not a single GMV sum. Audit original and imported pages, orders, entitlements, coupons and provider ledgers.
4. Replay idempotent synthetic events and crashes. Test concurrent duplicate webhook delivery, delayed/out-of-order events, subscription downgrades, manual payment approvals, refunds and partial payments.
5. Restore and revert to the prior version on a disposable environment, proving backups and rollback independently.

## Phase 3 — controlled cutover (not implemented yet)

Use a scheduled write-freeze or correct dual-write/outbox migration scheme (dual writes are **not safe** without consistent transaction boundaries). Take a final encrypted snapshot, import delta, compare counts/hashes, then switch traffic with one selected writer. Monitor errors and reconciliation reports, keep old files read-only until formally retired. Only move to multiple application instances after DB transaction and session/job design are proven.

## Blockers

PostgreSQL deployment URL and access policy; backup encryption/restore; API and domain checkout E2E; Stripe/PayPal sandbox and refund/dispute flows; owners of orphaned legacy records; documented retention and rollback. **No database cutover, real-money refund or live payment activation is performed by this plan.**

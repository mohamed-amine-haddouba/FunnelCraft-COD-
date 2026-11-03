# CodWorth — Staging acceptance and release evidence

**Status (3 Nov 2026):** isolated production-mode CI smoke is implemented and passing. **There is no verified VPS staging deployment or provider E2E sign-off yet.** Keep PR #2 in Draft.

## Verified without a live server

- [x] Clean `npm ci`, TypeScript, 109 isolated tests, production build and CodeQL.
- [x] `scripts/staging-smoke.mjs` starts the **real production-mode server** in a temporary isolated project directory without `.env` or customer `data/`. It uses only a synthetic disposable-domain fixture, sandbox PayPal selection and no real payment credentials.
- [x] GET `/api/health` returns OK; production `/` serves built SPA assets.
- [x] Browser CORS allowlist does not reflect untrusted Origin; configured staging origin is allowed.
- [x] Fake subscription upgrade endpoint is disabled with HTTP 410.
- [x] Fixture backup, encryption, isolated restore, PM2 preflight, factory-reset guard and read-only reconciliation/migration preflight have independent CI coverage.

## Required on an actual **separate staging** environment

This phase **cannot** be marked complete from GitHub CI alone. Do not copy live `data/` or `.env` and do not configure real payment keys.

1. Provision separate host/container, process, application directory, **data volume**, SMTP test inbox, HTTPS domain and TLS certificate. Keep it isolated from production's PM2 service and backup keys.
2. Deploy branch `fix/codworth-staging-hardening-20261103` on staging only. Set `CODWORTH_DEPLOY_BRANCH` accordingly if using `deploy.sh`; note that the guarded script assumes an existing single PM2 process named `funnelcraft-api` and will not bootstrap a new deployment by itself. Give staging its own service name/host so a production restart is impossible.
3. Configure `NODE_ENV=production`, `APP_ORIGIN=https://<actual-staging-origin>`, `PAYPAL_ENVIRONMENT=sandbox`, Stripe **test-mode** keys/webhook endpoint, `BYPASS_CAPTCHA=false`, trusted reverse-proxy CIDRs and only the necessary CORS origins. Keep `ENABLE_OWNER_COCKPIT=false` unless explicitly testing it.
4. Verify DNS/TLS, redirects, session cookies, two-factor email, Google OAuth, registration, recovery, password reset and rate limits with synthetic merchants and no customer data.
5. From two distinct synthetic merchant accounts, publish offers and submit COD orders. Verify order ownership, pricing, delivery status, refunds/cancellations semantics, mobile view and exported/custom-domain checkout.
6. Exercise real **sandbox/test** Stripe checkout/webhooks and PayPal create/capture/webhooks, plus duplicates, retries, invalid signatures, missing provider events, capture crash recovery, coupon/renewal and reconciliation; no live charges.
7. Run GPG backup, verify checksum, restore into a new isolated directory with the recovery private key, and compare counts per merchant/currency. Prove rollback and preserve the original data.
8. Record screenshots/HTTP traces (with secrets redacted), CI commit SHA, staging URL, pass/fail by journey, open issues and remediation dates. A second review should sign off on payment edge cases.

## Go / no-go

**Do not merge PR #2 merely because CI or this isolated smoke passes.** Merge approval depends on a separately verified staging environment, payment-provider E2E and rollback restore. PostgreSQL cutover and full refund/chargeback reconciliation are not complete; do not describe them as deployed.

For reproducible offline checks after `npm ci` and `npm run build`:

```bash
node scripts/staging-smoke.mjs
npm test
```

Both commands are non-production checks. The smoke script uses a temporary process and deletes its own temporary data; it never contacts live payment providers.

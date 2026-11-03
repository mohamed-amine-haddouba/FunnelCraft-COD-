# CodWorth — Remediation status (2026-11-03)

This document tracks the findings of `FunnelCraft_COD_Technical_Review_AR(2).md` (baseline commit `906199abe...`) against the **current** repository, not the old baseline. It is not a certification of production security.

## Changes in this PR
- Restore the tracked disposable-email domain list removed by a later change, so the validator and isolated test runner have a consistent fixture.
- PayPal live API is used **only** when `PAYPAL_ENVIRONMENT=live` (or the explicitly supported `production`/`prod` aliases). An unset setting resolves to sandbox even with `NODE_ENV=production`; invalid values fail instead of silently selecting the wrong provider.
- Google OAuth client configuration is read when authentication is invoked (avoids reading `GOOGLE_CLIENT_ID` before dotenv initialization).
- Password-reset email links use a validated HTTPS `APP_ORIGIN` (falling back to the existing codworth.me origin for backward compatibility).
- Explicit allowlist for **credentialed CORS**. Configure `APP_ORIGIN` and `CORS_ALLOWED_ORIGINS` before staging. Third-party storefronts/exported HTML hosted on different origins need an intentionally approved origin. This change needs cross-origin browser E2E testing.
- Invalidate stored user sessions on owner password replacement, and ensure the admin account list counts orders by stable owner ID only.
- Document environment variables and add Node 24 PR checks (install, typecheck, isolated tests, build). Add focused regression tests for PayPal mode selection and CORS.

## Findings from the original review
- **Previously addressed in PR #1 or follow-up commits, but still subject to staging verification:** F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F14, F15. See code, tests, and prior PR; do not equate a unit test with production proof.
- **Partially addressed here:** F01 (admin counts), F13 (safe payment environment selection, not complete subscription/refund lifecycle), F16 (admin counts only).
- **Still needing dedicated work:** F13 (refunds/reversals/chargebacks, idempotent distributed transactions, reconciliation), F16 (analytics semantics and date/currency ranges), the remaining legacy order/domain migrations, resilient storage and backup/restore, performance/code-splitting, end-to-end payment/OTP flows, hard-coded identity fixtures, deployment rollback and multi-instance database migration.

## Verification and release gates
1. Let GitHub Actions run against this PR. Do not merge while any check fails. The branch has not been locally fully built/tested in this editing environment.
2. In a **separate staging environment**, configure only test-mode Stripe and PayPal credentials, `PAYPAL_ENVIRONMENT=sandbox`, `APP_ORIGIN=https://<staging-host>`, approved `CORS_ALLOWED_ORIGINS`, CAPTCHA and SMTP. Never include live secrets in Git or logs.
3. Test Google login, owner password reset and session invalidation, COD on mobile, order ownership with two merchants, exported HTML and custom domains, recurring Stripe payment and webhook, PayPal sandbox capture/refund, provider duplicate events, and cross-origin requests.
4. Keep one application process for the current JSON/in-memory storage. Back up **all** persistent data including PayPal ledger; rehearse restore on an isolated server and compare merchant/order/payment totals.
5. Require owner approval and a rollout/rollback plan before merging or deploying.

## Known limitations
- Stateless owner-cockpit JWTs are not automatically revoked by user-session invalidation: this requires a dedicated token version/revocation mechanism.
- A fail-closed CORS policy can intentionally block unconfigured third-party hosted storefronts until their origin is trusted.
- This PR does not promise all findings are fixed and does not alter production payment/data settings.

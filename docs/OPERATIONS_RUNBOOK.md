# CodWorth Operations & Release Runbook

This runbook describes a safe staging and deployment process for the current JSON-backed CodWorth application. It does not authorize a production release by itself.

## 1. Required environment configuration

Set these values through the server's secret manager or protected environment file. Never commit real values.

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` on the live host |
| `APP_ORIGIN` | Exact HTTPS origin of the dashboard, with no path |
| `CORS_ALLOWED_ORIGINS` | Optional comma-separated HTTPS origins only when a trusted external frontend needs credentialed API access |
| `TRUSTED_PROXY_CIDRS` | Exact Nginx/reverse-proxy CIDRs; do not trust all proxies |
| `OWNER_EMAIL` | Dedicated owner account email |
| `SANDBOX_JWT_SECRET` | Random secret of at least 32 characters |
| `SANDBOX_REQUIRE_2FA` | `true` |
| `ENABLE_OWNER_COCKPIT` | Keep `false` unless the owner cockpit is required; if enabled, restrict it to the owner |
| `PAYPAL_ENVIRONMENT` | `sandbox` in staging; `live` only after a separate approved release |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe test credentials in staging; production keys only after sign-off |
| `BACKUP_GPG_RECIPIENT` | GPG public-key recipient installed on the host; required for deployment backups |
| `CODWORTH_BACKUP_DIR` | Optional absolute backup directory outside the repository, preferably on a separate mounted volume |
| `CODWORTH_DEPLOY_BRANCH` | `main` unless the operator deliberately changes the deployment branch |
| `CODWORTH_HEALTH_URL` | Optional exact local readiness URL if the API does not listen on port 3000 |

Do not set `BYPASS_CAPTCHA=true` in production. Keep test OTP pins out of production. `OWNER_INITIAL_PASSWORD` is only for initial owner bootstrap; changing it later does not reset an existing account.

## 2. GPG backup-key setup

1. Generate a dedicated backup key on an offline, controlled machine. Keep its private key off the application server.
2. Export only the public key and import it on the CodWorth host:
   ```bash
   gpg --export --armor backup-recipient@example.com > codworth-backup-public.asc
   gpg --import codworth-backup-public.asc
   gpg --list-keys backup-recipient@example.com
   ```
3. Set `BACKUP_GPG_RECIPIENT=backup-recipient@example.com` in the deployment environment.
4. Keep the private key and its recovery passphrase in a separate secure location. The restore host needs that private key to decrypt archives.
5. Store encrypted archives off-host, restrict access, and define a retention policy. The backup script creates an encrypted local archive; it does not upload it to remote storage automatically.

## 3. First rollout of the backup-enabled deploy script

The currently deployed older `deploy.sh` cannot call a backup script that has not yet been pulled. For the first rollout only:

1. Confirm the live host is on the `main` branch and the working tree has no tracked local changes.
2. Before pulling anything, inspect `pm2 jlist`: exactly one `funnelcraft-api` process must be online in `fork_mode`, with one instance and watch mode disabled. If watch mode is enabled, disable it or stop the service during the manual first rollout window.
3. Ensure GPG and `BACKUP_GPG_RECIPIENT` are configured in the shell environment.
4. Fetch and fast-forward the code without restarting the running PM2 process:
   ```bash
   git pull --ff-only origin main
   ```
5. Create the encrypted snapshot before installing dependencies or restarting:
   ```bash
   bash scripts/backup-data.sh
   ```
6. Copy the encrypted archive to isolated storage and rehearse decryption/verification on a separate recovery host.
7. Run the new guarded deployment script:
   ```bash
   bash deploy.sh
   ```

Subsequent deployments use the new script directly. It checks the branch and tracked working tree, verifies the single-fork/no-watch PM2 configuration before pulling, fast-forwards only, requires an encrypted backup, uses `npm ci`, runs type-check/tests/build, restarts PM2, and checks health. CI also runs CodeQL and a high-severity production dependency audit. It attempts to restore the previous Git commit if a post-pull step fails.

## 4. Restore rehearsal (never overwrite production data)

On an isolated recovery host with the GPG private key imported:

```bash
bash scripts/restore-data.sh /secure-backups/codworth-data-YYYYMMDD.tar.gz.gpg /srv/codworth-recovery/data
```

The target must be a new directory named `data` outside the live project. The script refuses to overwrite an existing target, decrypts and verifies the archive, rejects unsafe archive entries, and applies restrictive file permissions. Compare record counts and test the restored application in staging. Do not copy the recovered directory over the live `data/` until a separately approved recovery plan exists.

## 5. Staging acceptance checklist

- [ ] Staging has separate database/files, domain, SMTP credentials, Stripe test keys and PayPal sandbox credentials.
- [ ] `APP_ORIGIN` is HTTPS and matches the actual dashboard origin.
- [ ] Every external storefront origin that needs credentialed requests is explicitly listed; no wildcard origin is used.
- [ ] Owner cockpit is disabled unless needed; if enabled, 2FA and owner-only access are verified.
- [ ] Registration, email verification, password reset, Google login and OTP resend limits are exercised.
- [ ] COD order creation, update, cancellation, merchant isolation and page attribution are tested on mobile and desktop.
- [ ] PayPal create/capture/webhook retry, amount/currency mismatch, duplicate delivery and coupon idempotency are tested in Sandbox.
- [ ] Stripe checkout, signed webhook, renewal, payment failure, cancellation and downgrade are tested in Test Mode.
- [ ] Manual payment approval/rejection is tested without duplicate subscription changes.
- [ ] Backup creation, decryption, integrity verification and isolated restore are all rehearsed.
- [ ] PM2 runs one forked application instance only. The current in-memory Maps and JSON files are not safe for cluster/multi-instance operation.
- [ ] Health checks, PM2 logs and the rollback procedure are exercised.

## 6. Known architecture boundary

The current application persists core business records in JSON files and keeps live Maps in one Node.js process. Atomic file replacement protects individual files, but it does not provide multi-file transactions, distributed locking, or safe multi-process concurrency. Keep one PM2 forked instance. A PostgreSQL migration with schema migrations, transactions, backups and reconciliation is a separate release project.

Passing unit tests, TypeScript, CodeQL and dependency audit is necessary but not equivalent to a complete payment-provider or disaster-recovery rehearsal.

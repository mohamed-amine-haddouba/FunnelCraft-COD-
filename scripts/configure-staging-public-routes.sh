#!/usr/bin/env bash
# Opt-in VPS-only change: allow ONLY published pages and COD submissions
# through private staging Nginx. Do not run on the primary codworth.me site.
set -Eeuo pipefail
umask 077

if [[ "${EUID}" -ne 0 ]]; then
  echo "[STAGING] Run as root on the isolated staging VPS." >&2
  exit 1
fi

CFG="/etc/nginx/sites-available/codworth-staging"
ENABLED="/etc/nginx/sites-enabled/codworth-staging"
if [[ ! -f "$CFG" || ! -e "$ENABLED" || "$(readlink -f "$ENABLED")" != "$CFG" ]]; then
  echo "[STAGING] Independent Nginx staging configuration not found; stopping." >&2
  exit 1
fi
if [[ ! -r /etc/nginx/.codworth-staging.htpasswd ]] ||
   [[ ! -f /etc/letsencrypt/live/staging.codworth.me/fullchain.pem ]]; then
  echo "[STAGING] Basic Auth or TLS is not configured; stopping." >&2
  exit 1
fi
if ! curl -fsS --max-time 5 http://127.0.0.1:3100/api/health >/dev/null; then
  echo "[STAGING] Local Staging backend is not healthy; stopping." >&2
  exit 1
fi

# Avoid replacing the broader, intentional Basic Auth / API Cookie Gate.
if grep -q '^    # BEGIN CODWORTH PUBLIC STAGING ROUTES$' "$CFG"; then
  echo "[STAGING] Public routes already installed. No changes."
  exit 0
fi

BACKUP="/root/codworth-staging-nginx-before-public-$(date -u +%Y%m%dT%H%M%SZ)-$$.bak"
cp -a "$CFG" "$BACKUP"
chmod 600 "$BACKUP"
if ! python3 - "$CFG" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
config = p.read_text()
anchor = '    location ^~ /api/ {'
if config.count(anchor) != 1:
    raise SystemExit('[STAGING] Expected exactly one existing API Cookie Gate.')
if 'if ($cookie_codworth_staging_gate != "' not in config:
    raise SystemExit('[STAGING] Existing API Cookie Gate is missing; refusing public routing.')
if 'server_name staging.codworth.me;' not in config or 'auth_basic_user_file /etc/nginx/.codworth-staging.htpasswd;' not in config:
    raise SystemExit('[STAGING] Expected staging-only TLS and Basic Auth missing.')
if 'proxy_pass http://127.0.0.1:3100;' not in config:
    raise SystemExit('[STAGING] Unexpected application upstream.')

# The customer checkout form uses only /api/orders/submit; the private
# dashboard's GET /api/orders remains protected by the existing cookie gate.
# Every unauthenticated route is exact or tightly prefix-scoped.
public = """
    # BEGIN CODWORTH PUBLIC STAGING ROUTES
    # Public only: verified published page HTML (unpublished slugs show 404 in SPA).
    location ^~ /p/ {
        auth_basic off;
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Built app JS/CSS/fonts required to render published pages.
    location ^~ /assets/ {
        auth_basic off;
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Server returns only page data for explicitly published slugs.
    location ^~ /api/public/pages/ {
        auth_basic off;
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Currency data for the legacy public product storefront.
    location = /api/exchange-rates {
        auth_basic off;
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Public COD only. Backend performs Turnstile and validates a live offer.
    # Login, billing, page editing and GET /api/orders remain protected.
    location = /api/orders/submit {
        auth_basic off;
        if ($request_method != POST) { return 405; }
        limit_req zone=mylimit burst=20 nodelay;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
    }
    # END CODWORTH PUBLIC STAGING ROUTES

"""
config = config.replace(anchor, public + anchor, 1)
p.write_text(config)
PY
then
  cp -a "$BACKUP" "$CFG"
  echo "[STAGING] Input preflight failed; original config restored." >&2
  exit 1
fi

if ! nginx -t; then
  cp -a "$BACKUP" "$CFG"
  nginx -t
  echo "[STAGING] New Nginx config invalid; restored backup." >&2
  exit 1
fi

if ! systemctl reload nginx; then
  cp -a "$BACKUP" "$CFG"
  nginx -t && systemctl reload nginx
  echo "[STAGING] Reload failed; restored backup." >&2
  exit 1
fi

echo "[STAGING] Installed only public page/assets/COD routes. Backup: $BACKUP"
echo "[STAGING] Verify root remains 401, protected /api/orders remains 403,"
echo "[STAGING] published /p/<slug> works without Basic Auth and original codworth.me stays 200."

#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_ROOT"

DEPLOY_BRANCH="${CODWORTH_DEPLOY_BRANCH:-main}"
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  echo "[DEPLOY] Refusing to deploy: expected branch '$DEPLOY_BRANCH', found '$CURRENT_BRANCH'." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "[DEPLOY] Refusing to deploy with tracked local changes. Commit or revert them first." >&2
  exit 1
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"
HEALTH_URL="${CODWORTH_HEALTH_URL:-http://127.0.0.1:${PORT:-3000}/api/health}"
ROLLBACK_ENABLED=0
rollback_on_error() {
  local status="$?"
  local rollback_healthy=0
  trap - ERR
  if [[ "$ROLLBACK_ENABLED" == "1" ]]; then
    echo "[DEPLOY] Deployment failed. Attempting rollback to $PREVIOUS_SHA ..." >&2
    if git reset --hard "$PREVIOUS_SHA" \
      && npm ci --include=dev --legacy-peer-deps \
      && npm run build \
      && NODE_ENV=production pm2 restart funnelcraft-api --update-env; then
      for attempt in $(seq 1 30); do
        if curl --fail --silent --max-time 3 "$HEALTH_URL" >/dev/null; then
          rollback_healthy=1
          break
        fi
        sleep 2
      done
      if [[ "$rollback_healthy" == "1" ]] && pm2 save; then
        echo "[DEPLOY] Previous version restored and healthy at $PREVIOUS_SHA." >&2
      else
        echo "[DEPLOY] CRITICAL: rollback did not pass health checks. Keep traffic disabled and restore manually." >&2
      fi
    else
      echo "[DEPLOY] CRITICAL: automatic rollback failed. Keep traffic disabled and restore manually." >&2
    fi
  fi
  exit "$status"
}
trap rollback_on_error ERR

echo "[CodWorth] Deploy started at $(date -u +%FT%TZ)"
echo ">>> [1/6] Fast-forward only from origin/$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"
ROLLBACK_ENABLED=1

echo ">>> [2/6] Snapshot persistent data before installing or restarting"
if [[ ! -f scripts/backup-data.sh ]]; then
  echo "[DEPLOY] Backup script is missing after update; refusing deployment." >&2
  exit 1
fi
bash scripts/backup-data.sh

echo ">>> [3/6] Install exact locked dependencies"
npm ci --include=dev --legacy-peer-deps

echo ">>> [4/6] Type-check and run isolated tests"
npm run lint
npm test

echo ">>> [5/6] Build production assets"
npm run build

echo ">>> [6/6] Restart and verify application health"
NODE_ENV=production pm2 restart funnelcraft-api --update-env

HEALTH_OK=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 "$HEALTH_URL" >/dev/null; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done
if [[ "$HEALTH_OK" != "1" ]]; then
  echo "[DEPLOY] Health check failed after 60 seconds: $HEALTH_URL" >&2
  exit 1
fi

pm2 save
ROLLBACK_ENABLED=0
trap - ERR
echo "[DEPLOY] Success. Commit: $(git rev-parse --short HEAD)"

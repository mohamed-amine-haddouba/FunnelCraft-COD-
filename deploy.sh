#!/usr/bin/env bash
set -euo pipefail

echo "[FunnelCraft-COD] Deploy $(date -u +%FT%TZ)"

echo ">>> [1/5] git pull"
git pull origin main

echo ">>> [2/5] npm ci"
npm ci

echo ">>> [3/5] ./node_modules/.bin/tsc --noEmit"
./node_modules/.bin/tsc --noEmit

echo ">>> [4/5] npm run build"
npm run build

echo ">>> [5/5] restart + health check"
NODE_ENV=production pm2 restart funnelcraft-api --update-env
pm2 save
sleep 3
curl -fsS http://127.0.0.1:3000/api/health || { echo "❌ health failed"; exit 1; }

echo "✅ Deploy complete"

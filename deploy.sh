#!/usr/bin/env bash
set -e

echo "========================================================"
echo "[FunnelCraft-COD] Starting Direct Local VPS Deployment"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

echo ""
echo ">>> [1/5] Pulling latest code from origin/main..."
git pull origin main

echo ""
echo ">>> [2/5] Removing package-lock.json to prevent esbuild/vite conflicts..."
rm -f package-lock.json

echo ""
echo ">>> [3/5] Installing dependencies (npm install --legacy-peer-deps)..."
npm install --legacy-peer-deps

echo ""
echo ">>> [4/5] Building production frontend & bundle (npm run build)..."
npm run build

echo ""
echo ">>> [5/5] Restarting PM2 service (funnelcraft-api)..."
pm2 restart funnelcraft-api --update-env

echo ""
echo "========================================================"
echo "[FunnelCraft-COD] Local VPS Deployment Completed Successfully!"
echo "========================================================"

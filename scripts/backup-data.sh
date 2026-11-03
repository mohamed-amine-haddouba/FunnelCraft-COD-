#!/usr/bin/env bash
# Creates a private snapshot of all persistent JSON data before a deployment.
set -euo pipefail
umask 077
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "[BACKUP] No data directory yet; skipping first-install backup."
  exit 0
fi
BACKUP_DIR="${CODWORTH_BACKUP_DIR:-$(dirname "$PROJECT_ROOT")/codworth-backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/codworth-data-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
TEMP="$FILE.partial"
trap 'rm -f "$TEMP"' EXIT
tar -czf "$TEMP" -C "$PROJECT_ROOT" data
tar -tzf "$TEMP" >/dev/null
mv "$TEMP" "$FILE"
chmod 600 "$FILE"
# The checksum is useful when moving the encrypted backup to isolated storage.
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$BACKUP_DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
  chmod 600 "$FILE.sha256"
fi
echo "[BACKUP] Private archive created outside the repository: $FILE"
echo "[BACKUP] Store the archive encrypted and rehearse restoration separately."

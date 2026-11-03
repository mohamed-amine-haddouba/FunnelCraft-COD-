#!/usr/bin/env bash
# Creates an encrypted, private snapshot of persistent application data.
set -euo pipefail
umask 077

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DATA_DIR="$PROJECT_ROOT/data"
if [[ ! -d "$DATA_DIR" ]]; then
  echo "[BACKUP] No data directory yet; skipping first-install backup."
  exit 0
fi

: "${BACKUP_GPG_RECIPIENT:?Set BACKUP_GPG_RECIPIENT to an installed GPG public-key recipient before deploying.}"
if ! command -v gpg >/dev/null 2>&1; then
  echo "[BACKUP] GPG is required to encrypt persistent data backups." >&2
  exit 1
fi
if ! gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1; then
  echo "[BACKUP] No GPG public key found for BACKUP_GPG_RECIPIENT." >&2
  exit 1
fi

BACKUP_DIR="${CODWORTH_BACKUP_DIR:-$(dirname "$PROJECT_ROOT")/codworth-backups}"
mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"
case "$BACKUP_DIR/" in
  "$PROJECT_ROOT/"*)
    echo "[BACKUP] Backup directory must be outside the project repository." >&2
    exit 1
    ;;
esac
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/codworth-data-$STAMP-$$.tar.gz.gpg"
TEMP="$BACKUP_DIR/.codworth-data-$STAMP-$$.tar.gz.partial"
ENCRYPTED_TEMP="$FILE.partial"
trap 'rm -f "$TEMP" "$ENCRYPTED_TEMP"' EXIT

tar -czf "$TEMP" -C "$PROJECT_ROOT" data
tar -tzf "$TEMP" >/dev/null
gpg --batch --yes --trust-model always --encrypt \
  --recipient "$BACKUP_GPG_RECIPIENT" --output "$ENCRYPTED_TEMP" "$TEMP"
test -s "$ENCRYPTED_TEMP"
mv "$ENCRYPTED_TEMP" "$FILE"
rm -f "$TEMP"
chmod 600 "$FILE"

if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$BACKUP_DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
  chmod 600 "$FILE.sha256"
fi

echo "[BACKUP] Encrypted archive created outside the repository: $FILE"
echo "[BACKUP] Restore the archive only on an isolated host after GPG decryption and verification."

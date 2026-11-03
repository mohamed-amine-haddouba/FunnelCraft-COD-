#!/usr/bin/env bash
# Decrypt and restore an archive into a NEW isolated data directory only.
set -euo pipefail
umask 077

if [[ "$#" -ne 2 ]]; then
  echo "Usage: bash scripts/restore-data.sh <backup.tar.gz.gpg> <new-target>/data" >&2
  exit 2
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ARCHIVE="$(realpath -e "$1")"
TARGET_INPUT="$2"
TARGET_NAME="$(basename "$TARGET_INPUT")"
if [[ "$TARGET_NAME" != "data" ]]; then
  echo "[RESTORE] Target path must end in a new directory named 'data'." >&2
  exit 1
fi
if ! command -v gpg >/dev/null 2>&1; then
  echo "[RESTORE] GPG is required to decrypt this archive." >&2
  exit 1
fi

TARGET_PARENT_INPUT="$(dirname "$TARGET_INPUT")"
mkdir -p "$TARGET_PARENT_INPUT"
TARGET_PARENT="$(cd "$TARGET_PARENT_INPUT" && pwd -P)"
TARGET_DIR="$TARGET_PARENT/data"
case "$TARGET_DIR/" in
  "$PROJECT_ROOT/"*)
    echo "[RESTORE] Refusing to restore inside the live project directory." >&2
    exit 1
    ;;
esac
if [[ -e "$TARGET_DIR" ]]; then
  echo "[RESTORE] Target already exists; refusing to overwrite data." >&2
  exit 1
fi

TEMP="$(mktemp "$TARGET_PARENT/.codworth-restore.XXXXXX.tar.gz")"
trap 'rm -f "$TEMP"' EXIT
gpg --batch --yes --decrypt --output "$TEMP" "$ARCHIVE"
node "$PROJECT_ROOT/scripts/verify-backup.mjs" "$TEMP"
tar -xzf "$TEMP" -C "$TARGET_PARENT" --no-same-owner --no-same-permissions
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "[RESTORE] Archive did not create the expected data directory." >&2
  exit 1
fi
find "$TARGET_DIR" -type d -exec chmod 700 {} +
find "$TARGET_DIR" -type f -exec chmod 600 {} +
echo "[RESTORE] Data restored to isolated target: $TARGET_DIR"
echo "[RESTORE] This script never replaces the live data directory. Validate counts and application behavior before any manual cutover."

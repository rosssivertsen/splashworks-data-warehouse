#!/usr/bin/env bash
# sync-extracts.sh — Sync Skimmer nightly extracts from OneDrive to local data dir
#
# Usage:
#   ./etl/scripts/sync-extracts.sh              # Sync from OneDrive
#   ./etl/scripts/sync-extracts.sh --dry-run    # Show what would be synced
#
# Requires rclone configured with an "onedrive" remote.
# Designed to run via cron on the VPS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_DIR/data/extracts"
LOG_FILE="$PROJECT_DIR/data/sync.log"
REMOTE="onedrive:Skimmer User's files - Splashworks/Skimmer Nightly Extract"

DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
fi

mkdir -p "$DATA_DIR"

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Starting sync..." | tee -a "$LOG_FILE"

rclone sync "$REMOTE" "$DATA_DIR" \
    --include "*.db.gz" \
    --stats-one-line \
    --log-file "$LOG_FILE" \
    --log-level INFO \
    $DRY_RUN \
    2>&1

FILE_COUNT=$(ls "$DATA_DIR"/*.db.gz 2>/dev/null | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Sync complete: $FILE_COUNT files, $TOTAL_SIZE total" | tee -a "$LOG_FILE"

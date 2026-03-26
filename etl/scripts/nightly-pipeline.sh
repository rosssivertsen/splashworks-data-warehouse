#!/usr/bin/env bash
# nightly-pipeline.sh — Full nightly ETL: sync → import → dbt → health check
#
# Usage:
#   ./etl/scripts/nightly-pipeline.sh          # Run full pipeline
#   ./etl/scripts/nightly-pipeline.sh --skip-sync  # Skip rclone (for re-runs)
#
# Designed to run via cron on the VPS at 1:15 AM UTC (after sync-extracts.sh at 1:00 AM).
# Logs to data/pipeline.log with timestamped entries.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_DIR/data/pipeline.log"
ENV_FILE="$PROJECT_DIR/.env"

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" | tee -a "$LOG_FILE"; }

log "=== Pipeline starting ==="

# Load env vars
if [ -f "$ENV_FILE" ]; then
    export DATABASE_URL="postgresql://splashworks:$(grep DB_PASSWORD "$ENV_FILE" | cut -d= -f2)@localhost:5432/splashworks"
    export DBT_PASSWORD="$(grep DB_PASSWORD "$ENV_FILE" | cut -d= -f2)"
    export EXTRACT_DIR="$PROJECT_DIR/data/extracts"
else
    log "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

# Step 1: Sync (unless --skip-sync)
if [ "${1:-}" != "--skip-sync" ]; then
    log "Step 1: Syncing extracts from OneDrive..."
    if "$SCRIPT_DIR/sync-extracts.sh" 2>&1 | tee -a "$LOG_FILE"; then
        log "Step 1: Sync complete"
    else
        log "ERROR: Sync failed (exit $?). Continuing with existing files."
    fi
else
    log "Step 1: Skipped (--skip-sync)"
fi

# Step 2: Python ETL — SQLite to Postgres
log "Step 2: Running ETL (SQLite → Postgres)..."
cd "$PROJECT_DIR"
if python3 -m etl.main 2>&1 | tee -a "$LOG_FILE"; then
    log "Step 2: ETL complete"
else
    log "ERROR: ETL failed (exit $?). Aborting."
    exit 1
fi

# Step 3: dbt run
log "Step 3: Running dbt..."
cd "$PROJECT_DIR/dbt"
if dbt run --profiles-dir . 2>&1 | tee -a "$LOG_FILE"; then
    log "Step 3: dbt complete"
else
    log "ERROR: dbt run failed (exit $?). Aborting."
    exit 1
fi

# Step 4: Reconciliation — compare raw vs warehouse
log "Step 4: Running reconciliation checks..."
cd "$PROJECT_DIR"
if python3 -m etl.reconcile 2>&1 | tee -a "$LOG_FILE"; then
    log "Step 4: Reconciliation passed"
else
    log "WARNING: Reconciliation found discrepancies (see data/reconciliation.json)"
fi

# Step 5: Health check
log "Step 5: Health check..."
cd "$PROJECT_DIR"
HEALTH=$(curl -sf http://localhost:8080/api/health 2>/dev/null || echo '{"status":"unreachable"}')
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "parse_error")

if [ "$STATUS" = "healthy" ]; then
    log "Step 4: API healthy"
else
    log "WARNING: API health check returned: $STATUS"
fi

log "=== Pipeline complete ==="

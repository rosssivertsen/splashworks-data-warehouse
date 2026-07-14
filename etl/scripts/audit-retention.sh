#!/usr/bin/env bash
# audit-retention.sh — nightly PII retention on the `audit` schema (MEDIUM-2).
#
# Redacts customer-PII free-text older than 90 days and hard-deletes rows older
# than 365 days, on both audit.query_audit_log and audit.etl_incident_log.
# Decoupled from the ETL pipeline on purpose: it must run regardless of whether
# the nightly ETL succeeded. Idempotent — safe to run repeatedly.
#
# Cron (both prod and the staging box):
#   30 2 * * * /opt/splashworks/etl/scripts/audit-retention.sh >> /opt/splashworks/data/audit-retention-cron.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_FILE="$PROJECT_DIR/infrastructure/postgres/maintenance/audit-retention.sql"
LOG_FILE="$PROJECT_DIR/data/audit-retention.log"
CONTAINER="${POSTGRES_CONTAINER:-splashworks-postgres}"
DB_USER="${POSTGRES_USER:-splashworks}"
DB_NAME="${POSTGRES_DB:-splashworks}"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) $1" | tee -a "$LOG_FILE"; }

if [ ! -f "$SQL_FILE" ]; then
    log "ERROR: retention SQL not found at $SQL_FILE"
    exit 1
fi

log "audit-retention starting (container=$CONTAINER db=$DB_NAME)"
if docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SQL_FILE" 2>&1 | tee -a "$LOG_FILE"; then
    log "audit-retention complete"
else
    rc=$?
    log "ERROR: audit-retention failed (exit $rc)"
    exit "$rc"
fi

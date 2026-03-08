#!/usr/bin/env bash
# vps-health-check.sh — Quick telemetry checks against the VPS data warehouse
#
# Usage:
#   ./scripts/vps-health-check.sh           # Run all checks
#   ./scripts/vps-health-check.sh --local   # Run against local Docker instead of VPS
#
# Requires: ssh access to VPS (default) or local Docker Compose

set -euo pipefail

VPS_HOST="root@76.13.29.44"
COMPOSE_FILE="/opt/splashworks/docker-compose.yml"

if [ "${1:-}" = "--local" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"
    run_psql() { docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U splashworks -d splashworks -c "$1"; }
else
    run_psql() { ssh "$VPS_HOST" "docker compose -f $COMPOSE_FILE exec -T postgres psql -U splashworks -d splashworks -c \"$1\""; }
fi

pass=0
fail=0

check() {
    local label="$1"
    local query="$2"
    echo ""
    echo "--- $label ---"
    if output=$(run_psql "$query" 2>&1); then
        echo "$output"
        pass=$((pass + 1))
    else
        echo "FAIL: $output"
        fail=$((fail + 1))
    fi
}

echo "=== Splashworks Data Warehouse Health Check ==="
echo "Target: ${1:-VPS ($VPS_HOST)}"
echo "Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"

check "1. Database connectivity" \
    "SELECT version();"

check "2. Schema summary (all layers)" \
    "SELECT schemaname, count(*) as objects
     FROM (
       SELECT schemaname FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
       UNION ALL
       SELECT schemaname FROM pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
     ) x
     GROUP BY schemaname ORDER BY schemaname;"

check "3. Active customers per company" \
    "SELECT _company_name, count(*) as active_customers
     FROM public_staging.stg_customer
     WHERE is_inactive = 0
     GROUP BY 1 ORDER BY 1;"

check "4. Service stops per company" \
    "SELECT _company_name, count(*) as total_stops
     FROM public_staging.stg_service_stop
     GROUP BY 1 ORDER BY 1;"

check "5. ETL load history (latest)" \
    "SELECT company_name, extract_date, status, count(*) as tables, sum(row_count) as rows
     FROM public.etl_load_log
     GROUP BY company_name, extract_date, status
     ORDER BY extract_date DESC;"

check "6. Warehouse fact sanity (avg minutes per completed stop)" \
    "SELECT _company_name, count(*) as completed_stops, round(avg(minutes_at_stop)::numeric, 1) as avg_minutes
     FROM public_warehouse.fact_labor
     WHERE service_status = 1
     GROUP BY 1 ORDER BY 1;"

check "7. Snapshot row counts" \
    "SELECT 'snap_customer' as snapshot, count(*) FROM warehouse.snap_customer
     UNION ALL
     SELECT 'snap_tech', count(*) FROM warehouse.snap_tech
     ORDER BY 1;"

echo ""
echo "=== Results: $pass passed, $fail failed ==="
if [ "$fail" -gt 0 ]; then
    exit 1
fi

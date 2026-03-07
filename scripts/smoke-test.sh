#!/usr/bin/env bash
# smoke-test.sh — Validate that all infrastructure components are healthy
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
    TOTAL=$((TOTAL + 1))
    local name="$1"
    shift
    if "$@" > /dev/null 2>&1; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "Splashworks Infrastructure Smoke Test"
echo "======================================"
echo ""

echo "Docker:"
check "Docker Compose running" docker compose ps --status running
check "Postgres container healthy" docker compose exec -T postgres pg_isready -U splashworks -d splashworks

echo ""
echo "PostgreSQL:"
check "Schemas exist" bash -c \
    "docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \"SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('raw_skimmer','staging','warehouse','semantic','vectors')\" | grep -q '5'"
check "pgvector extension" bash -c \
    "docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \"SELECT extname FROM pg_extension WHERE extname = 'vector'\" | grep -q 'vector'"
check "ETL log table exists" bash -c \
    "docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \"SELECT COUNT(*) FROM public.etl_load_log\" | grep -qE '^[0-9]+'"

echo ""
echo "ETL:"
if [ -d "data/extracts" ] && ls data/extracts/*.db.gz 1>/dev/null 2>&1; then
    check "Extract files present" ls data/extracts/*.db.gz
else
    echo "  SKIP: No extract files in data/extracts/ (run rclone sync first)"
fi

echo ""
echo "dbt:"
if command -v dbt &> /dev/null; then
    check "dbt debug passes" bash -c "cd dbt && DBT_HOST=localhost DBT_PASSWORD=\$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt debug"
else
    echo "  SKIP: dbt not installed locally"
fi

echo ""
echo "======================================"
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"

if [ $FAIL -gt 0 ]; then
    exit 1
fi

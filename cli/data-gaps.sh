#!/usr/bin/env bash
# data-gaps.sh - Run quick non-destructive data quality checks on nightly extracts.
#
# Usage:
#   ./cli/data-gaps.sh
#   ./cli/data-gaps.sh --out runs/latest/data-gaps.txt

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"
OUT_FILE=""

usage() {
  cat <<'EOF'
Usage:
  ./cli/data-gaps.sh [--out <path>]

Checks:
  - Missing key customer fields
  - Missing service location fields
  - Orphaned relationship records across core tables
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

find_db() {
  local base="$1"
  for ext in db sqlite sqlite3; do
    if [ -f "$DATA_DIR/$base.$ext" ]; then
      echo "$DATA_DIR/$base.$ext"
      return 0
    fi
  done
  find "$DATA_DIR" -maxdepth 1 -type f \( -name "$base*.db" -o -name "$base*.sqlite" -o -name "$base*.sqlite3" \) | head -n 1 || true
}

AQPS_DB="$(find_db AQPS)"
JOMO_DB="$(find_db JOMO)"

if [ -z "$AQPS_DB" ] || [ -z "$JOMO_DB" ]; then
  echo "Both AQPS and JOMO databases are required in $DATA_DIR"
  exit 1
fi

SQL_FILE="$(mktemp)"
cat > "$SQL_FILE" <<'EOF'
ATTACH DATABASE '__JOMO_DB__' AS jomo;

CREATE TEMP VIEW IF NOT EXISTS u_Customer AS
SELECT *, 'AQPS' AS SourceDb FROM main.Customer
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.Customer;

CREATE TEMP VIEW IF NOT EXISTS u_ServiceLocation AS
SELECT *, 'AQPS' AS SourceDb FROM main.ServiceLocation
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.ServiceLocation;

CREATE TEMP VIEW IF NOT EXISTS u_Pool AS
SELECT *, 'AQPS' AS SourceDb FROM main.Pool
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.Pool;

CREATE TEMP VIEW IF NOT EXISTS u_ServiceStop AS
SELECT *, 'AQPS' AS SourceDb FROM main.ServiceStop
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.ServiceStop;

CREATE TEMP VIEW IF NOT EXISTS u_ServiceStopEntry AS
SELECT *, 'AQPS' AS SourceDb FROM main.ServiceStopEntry
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.ServiceStopEntry;

CREATE TEMP VIEW IF NOT EXISTS u_Invoice AS
SELECT *, 'AQPS' AS SourceDb FROM main.Invoice
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.Invoice;

SELECT 'active_customers' AS metric, COUNT(*) AS value
FROM u_Customer
WHERE IsInactive = 0 AND Deleted = 0;

SELECT 'customers_missing_names' AS metric, COUNT(*) AS value
FROM u_Customer
WHERE IsInactive = 0 AND Deleted = 0
  AND (TRIM(COALESCE(FirstName, '')) = '' OR TRIM(COALESCE(LastName, '')) = '');

SELECT 'customers_missing_billing_city' AS metric, COUNT(*) AS value
FROM u_Customer
WHERE IsInactive = 0 AND Deleted = 0
  AND TRIM(COALESCE(BillingCity, '')) = '';

SELECT 'service_locations_missing_address' AS metric, COUNT(*) AS value
FROM u_ServiceLocation
WHERE TRIM(COALESCE(Address, '')) = '';

SELECT 'service_locations_missing_customer_fk' AS metric, COUNT(*) AS value
FROM u_ServiceLocation sl
LEFT JOIN u_Customer c
  ON c.id = sl.CustomerId AND c.SourceDb = sl.SourceDb
WHERE c.id IS NULL;

SELECT 'pools_missing_service_location_fk' AS metric, COUNT(*) AS value
FROM u_Pool p
LEFT JOIN u_ServiceLocation sl
  ON sl.id = p.ServiceLocationId AND sl.SourceDb = p.SourceDb
WHERE sl.id IS NULL;

SELECT 'service_stops_missing_pool_fk' AS metric, COUNT(*) AS value
FROM u_ServiceStop ss
LEFT JOIN u_Pool p
  ON p.id = ss.PoolId AND p.SourceDb = ss.SourceDb
WHERE p.id IS NULL;

SELECT 'service_stop_entries_missing_servicestop_fk' AS metric, COUNT(*) AS value
FROM u_ServiceStopEntry sse
LEFT JOIN u_ServiceStop ss
  ON ss.id = sse.ServiceStopId AND ss.SourceDb = sse.SourceDb
WHERE ss.id IS NULL;

SELECT 'invoices_missing_customer_fk' AS metric, COUNT(*) AS value
FROM u_Invoice i
LEFT JOIN u_Customer c
  ON c.id = i.CustomerId AND c.SourceDb = i.SourceDb
WHERE c.id IS NULL;
EOF

sed -i.bak "s|__JOMO_DB__|$JOMO_DB|g" "$SQL_FILE"
rm -f "$SQL_FILE.bak"

if [ -n "$OUT_FILE" ]; then
  mkdir -p "$(dirname "$OUT_FILE")"
  sqlite3 -box -header "$AQPS_DB" < "$SQL_FILE" > "$OUT_FILE"
  echo "Wrote data gap report to $OUT_FILE"
else
  sqlite3 -box -header "$AQPS_DB" < "$SQL_FILE"
fi

rm -f "$SQL_FILE"

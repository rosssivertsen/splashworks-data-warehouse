#!/usr/bin/env bash
# query.sh - Run ad hoc SQL against AQPS, JOMO, or a union view layer.
#
# Usage examples:
#   ./cli/query.sh --db AQPS --sql "SELECT COUNT(*) AS customers FROM Customer;"
#   ./cli/query.sh --db union --file queries/active-customers.sql
#   ./cli/query.sh --db union --format csv --sql "SELECT * FROM u_Customer LIMIT 20;" --out runs/latest/customers.csv

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"

DB_MODE="union"
FORMAT="table"
SQL_TEXT=""
SQL_FILE=""
OUT_FILE=""

usage() {
  cat <<'EOF'
Usage:
  ./cli/query.sh --db <AQPS|JOMO|union> (--sql "<SQL>" | --file <path.sql>) [--format table|csv|json] [--out <path>]

Options:
  --db       Target database mode. Default: union
  --sql      Inline SQL statement
  --file     SQL file path
  --format   Output format: table, csv, json. Default: table
  --out      Write results to file instead of stdout
  --help     Show this help

Notes:
  - union mode auto-creates temp views named u_<Table> from both DBs.
  - Example in union mode: SELECT COUNT(*) FROM u_Customer;
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --db)
      DB_MODE="${2:-}"
      shift 2
      ;;
    --sql)
      SQL_TEXT="${2:-}"
      shift 2
      ;;
    --file)
      SQL_FILE="${2:-}"
      shift 2
      ;;
    --format)
      FORMAT="${2:-}"
      shift 2
      ;;
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

if [ -n "$SQL_TEXT" ] && [ -n "$SQL_FILE" ]; then
  echo "Use only one of --sql or --file."
  exit 1
fi

if [ -z "$SQL_TEXT" ] && [ -z "$SQL_FILE" ]; then
  echo "Provide SQL via --sql or --file."
  exit 1
fi

if [ -n "$SQL_FILE" ] && [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE"
  exit 1
fi

find_db() {
  local base="$1"
  local found=""

  for ext in db sqlite sqlite3; do
    if [ -f "$DATA_DIR/$base.$ext" ]; then
      found="$DATA_DIR/$base.$ext"
      break
    fi
  done

  if [ -z "$found" ]; then
    found="$(find "$DATA_DIR" -maxdepth 1 -type f \( -name "$base*.db" -o -name "$base*.sqlite" -o -name "$base*.sqlite3" \) | head -n 1 || true)"
  fi

  echo "$found"
}

AQPS_DB="$(find_db AQPS)"
JOMO_DB="$(find_db JOMO)"

if [ "$DB_MODE" = "AQPS" ] && [ -z "$AQPS_DB" ]; then
  echo "AQPS database not found in $DATA_DIR"
  exit 1
fi

if [ "$DB_MODE" = "JOMO" ] && [ -z "$JOMO_DB" ]; then
  echo "JOMO database not found in $DATA_DIR"
  exit 1
fi

if [ "$DB_MODE" = "union" ] && { [ -z "$AQPS_DB" ] || [ -z "$JOMO_DB" ]; }; then
  echo "Union mode requires both AQPS and JOMO databases in $DATA_DIR"
  exit 1
fi

SQLITE_FORMAT_ARGS=()
case "$FORMAT" in
  table) SQLITE_FORMAT_ARGS=(-box -header) ;;
  csv) SQLITE_FORMAT_ARGS=(-csv -header) ;;
  json) SQLITE_FORMAT_ARGS=(-json) ;;
  *)
    echo "Invalid --format: $FORMAT (use table, csv, or json)"
    exit 1
    ;;
esac

if [ -n "$SQL_FILE" ]; then
  USER_SQL="$(cat "$SQL_FILE")"
else
  USER_SQL="$SQL_TEXT"
fi

RUN_SQL=""
WORK_DB=""

if [ "$DB_MODE" = "AQPS" ]; then
  WORK_DB="$AQPS_DB"
  RUN_SQL="$USER_SQL"
elif [ "$DB_MODE" = "JOMO" ]; then
  WORK_DB="$JOMO_DB"
  RUN_SQL="$USER_SQL"
elif [ "$DB_MODE" = "union" ]; then
  WORK_DB="$AQPS_DB"
  TABLES="$(sqlite3 "$AQPS_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")"

  VIEW_SQL=""
  while IFS= read -r table; do
    [ -z "$table" ] && continue
    VIEW_SQL="$VIEW_SQL
CREATE TEMP VIEW IF NOT EXISTS \"u_$table\" AS
SELECT *, 'AQPS' AS SourceDb FROM main.\"$table\"
UNION ALL
SELECT *, 'JOMO' AS SourceDb FROM jomo.\"$table\";"
  done <<< "$TABLES"

  RUN_SQL="
ATTACH DATABASE '$JOMO_DB' AS jomo;
$VIEW_SQL
$USER_SQL
"
else
  echo "Invalid --db mode: $DB_MODE"
  exit 1
fi

if [ -n "$OUT_FILE" ]; then
  mkdir -p "$(dirname "$OUT_FILE")"
  sqlite3 "${SQLITE_FORMAT_ARGS[@]}" "$WORK_DB" "$RUN_SQL" > "$OUT_FILE"
  echo "Wrote results to $OUT_FILE"
else
  sqlite3 "${SQLITE_FORMAT_ARGS[@]}" "$WORK_DB" "$RUN_SQL"
fi

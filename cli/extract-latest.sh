#!/usr/bin/env bash
# extract-latest.sh - Load latest AQPS and JOMO nightly files from a fixed folder.
#
# Defaults are based on the current stable CompanyId prefixes and OneDrive folder.
# You can override with flags if ever needed.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"

DEFAULT_NIGHTLY_DIR="/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract"
DEFAULT_AQPS_PREFIX="e265c9dee47c47c6a73f689b0df467ca"
DEFAULT_JOMO_PREFIX="95d37a64d1794a1caef111e801db5477"

NIGHTLY_DIR="$DEFAULT_NIGHTLY_DIR"
AQPS_PREFIX="$DEFAULT_AQPS_PREFIX"
JOMO_PREFIX="$DEFAULT_JOMO_PREFIX"

usage() {
  cat <<'EOF'
Usage:
  ./cli/extract-latest.sh [--dir <nightly-folder>] [--aqps-prefix <prefix>] [--jomo-prefix <prefix>]

Behavior:
  - Finds latest file starting with AQPS and JOMO prefixes in the nightly folder.
  - Supports .db, .sqlite, .sqlite3, .db.gz, .sqlite.gz, .sqlite3.gz.
  - Writes normalized outputs to:
      data/AQPS.db
      data/JOMO.db
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      NIGHTLY_DIR="${2:-}"
      shift 2
      ;;
    --aqps-prefix)
      AQPS_PREFIX="${2:-}"
      shift 2
      ;;
    --jomo-prefix)
      JOMO_PREFIX="${2:-}"
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

if [ ! -d "$NIGHTLY_DIR" ]; then
  echo "Nightly folder not found: $NIGHTLY_DIR"
  exit 1
fi

mkdir -p "$DATA_DIR"

find_latest_for_prefix() {
  local dir="$1"
  local prefix="$2"
  local latest=""
  latest="$(ls -1t "$dir"/"$prefix"* 2>/dev/null | head -n 1 || true)"
  echo "$latest"
}

materialize_db() {
  local source_file="$1"
  local target_db="$2"

  case "$source_file" in
    *.db|*.sqlite|*.sqlite3)
      cp -f "$source_file" "$target_db"
      ;;
    *.db.gz|*.sqlite.gz|*.sqlite3.gz|*.gz)
      gunzip -c "$source_file" > "$target_db"
      ;;
    *)
      echo "Unsupported nightly file format: $source_file"
      echo "Expected .db/.sqlite/.sqlite3 or gzip versions."
      exit 1
      ;;
  esac
}

AQPS_SOURCE="$(find_latest_for_prefix "$NIGHTLY_DIR" "$AQPS_PREFIX")"
JOMO_SOURCE="$(find_latest_for_prefix "$NIGHTLY_DIR" "$JOMO_PREFIX")"

if [ -z "$AQPS_SOURCE" ]; then
  echo "No AQPS file found for prefix: $AQPS_PREFIX"
  exit 1
fi

if [ -z "$JOMO_SOURCE" ]; then
  echo "No JOMO file found for prefix: $JOMO_PREFIX"
  exit 1
fi

echo "Nightly folder: $NIGHTLY_DIR"
echo "AQPS source:    $AQPS_SOURCE"
echo "JOMO source:    $JOMO_SOURCE"
echo ""

materialize_db "$AQPS_SOURCE" "$DATA_DIR/AQPS.db"
materialize_db "$JOMO_SOURCE" "$DATA_DIR/JOMO.db"

echo "Loaded databases:"
for db in "$DATA_DIR/AQPS.db" "$DATA_DIR/JOMO.db"; do
  size="$(du -h "$db" | cut -f1)"
  tables="$(sqlite3 "$db" ".tables" 2>/dev/null | wc -w | tr -d ' ')"
  company_id="$(sqlite3 "$db" "SELECT CompanyId FROM Customer WHERE CompanyId IS NOT NULL LIMIT 1;" 2>/dev/null || true)"
  echo "  $(basename "$db") - $size, $tables tables, CompanyId=$company_id"
done

echo ""
echo "Ready:"
echo "  npm run query -- --db union --file queries/active-customers.sql"
echo "  npm run gaps"

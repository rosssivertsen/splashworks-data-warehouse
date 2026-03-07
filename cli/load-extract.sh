#!/usr/bin/env bash
# load-extract.sh — Load Skimmer nightly extracts into data/
#
# Usage:
#   ./cli/load-extract.sh          # Load from default OneDrive location
#   ./cli/load-extract.sh status   # Show currently loaded databases
#
# Decompresses .db.gz files into data/ as AQPS.db and JOMO.db (gitignored).
# Existing databases in data/ are overwritten.

set -euo pipefail

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"
EXTRACT_DIR="/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract"

# Company ID → friendly name mapping
AQPS_ID="e265c9dee47c47c6a73f689b0df467ca"
JOMO_ID="95d37a64d1794a1caef111e801db5477"

show_status() {
    echo "Currently loaded databases:"
    if ls "$DATA_DIR"/*.db 1>/dev/null 2>&1; then
        for db in "$DATA_DIR"/*.db; do
            size=$(du -h "$db" | cut -f1)
            tables=$(sqlite3 "$db" ".tables" 2>/dev/null | wc -w | tr -d ' ')
            modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$db")
            echo "  $(basename "$db") — $size, $tables tables, loaded $modified"
        done
    else
        echo "  (none)"
    fi
}

if [ "${1:-}" = "status" ]; then
    show_status
    exit 0
fi

# Check source directory exists
if [ ! -d "$EXTRACT_DIR" ]; then
    echo "Error: Extract directory not found:"
    echo "  $EXTRACT_DIR"
    echo ""
    echo "Make sure OneDrive is synced."
    exit 1
fi

mkdir -p "$DATA_DIR"

echo "Source: $EXTRACT_DIR"
echo ""

# Decompress each .db.gz, renaming by company
for gz in "$EXTRACT_DIR"/*.db.gz; do
    if [ ! -f "$gz" ]; then
        echo "Warning: No .db.gz files found in extract directory"
        exit 1
    fi

    basename=$(basename "$gz" .db.gz)

    case "$basename" in
        "$AQPS_ID") name="AQPS" ;;
        "$JOMO_ID") name="JOMO" ;;
        *)          name="$basename" ;;
    esac

    echo "  $basename.db.gz → $name.db"
    gunzip -c "$gz" > "$DATA_DIR/$name.db"
done

echo ""
show_status

echo ""
echo "Ready. Ask Claude Code to query, or run directly:"
echo "  sqlite3 data/AQPS.db \"SELECT COUNT(*) FROM Customer WHERE IsInactive = 0\""

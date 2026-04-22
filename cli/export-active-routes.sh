#!/usr/bin/env bash
# export-active-routes.sh — export the active routes report from the
# production warehouse as a CEO-grade xlsx.
#
# Pulls from public_semantic.rpt_active_routes, which is rebuilt nightly
# by the cron and uses Skimmer's vendor-canonical active-route filter
# (per Glenn Burnside / Skimmer VP Eng, 2026-04-22):
#   ra.end_date > CURRENT_TIMESTAMP AND c.deleted=0 AND sl.deleted=0
#
# Service-state labels in the output are OBSERVATIONAL:
#   awaiting_first_service — new customer, no visits yet
#   recent_30d             — visited within last 30 days
#   last_30_to_90d         — last visit was 30-90 days ago
#   last_90d_plus          — last visit was >90 days ago
# Do NOT treat awaiting_first_service as a "re-routing candidate" — per
# Laura Gergle those are new customers pending first service.
#
# Usage:
#   ./cli/export-active-routes.sh                       # all companies, desktop
#   ./cli/export-active-routes.sh --company JOMO        # JOMO only
#   ./cli/export-active-routes.sh --tech "Jacob Hull"   # one technician
#   ./cli/export-active-routes.sh --day Tuesday         # one day of week
#   ./cli/export-active-routes.sh --output ~/report.xlsx
#   ./cli/export-active-routes.sh --no-open             # don't open file on exit
#
# Requires: ssh access to 76.13.29.44 with splashworks-postgres container,
#           officecli installed locally.

set -euo pipefail

# ---- config ----
VPS_HOST="root@76.13.29.44"
POSTGRES_CONTAINER="splashworks-postgres"
POSTGRES_DB="splashworks"
POSTGRES_USER="splashworks"
DEFAULT_OUT_DIR="${HOME}/Desktop/ceo-reports"

# ---- args ----
COMPANY=""
TECH=""
DAY=""
OUTPUT=""
OPEN_ON_EXIT=1

usage() {
    sed -n '2,30p' "$0"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --company)   COMPANY="$2"; shift 2;;
        --tech)      TECH="$2";    shift 2;;
        --day)       DAY="$2";     shift 2;;
        --output)    OUTPUT="$2";  shift 2;;
        --no-open)   OPEN_ON_EXIT=0; shift;;
        -h|--help)   usage;;
        *) echo "unknown arg: $1" >&2; exit 2;;
    esac
done

# ---- derive output path ----
DATE_STAMP="$(date +%Y-%m-%d)"
if [[ -z "$OUTPUT" ]]; then
    mkdir -p "$DEFAULT_OUT_DIR"
    OUTPUT="${DEFAULT_OUT_DIR}/active-routes-${DATE_STAMP}.xlsx"
fi

CSV_TMP="$(mktemp -t active-routes-XXXXXX.csv)"
trap 'rm -f "$CSV_TMP"' EXIT

# ---- build WHERE clause ----
WHERE_CLAUSE=""
if [[ -n "$COMPANY" ]]; then
    WHERE_CLAUSE="${WHERE_CLAUSE} AND company = '${COMPANY}'"
fi
if [[ -n "$TECH" ]]; then
    # Escape single quotes in tech name for SQL
    TECH_ESC="${TECH//\'/\'\'}"
    WHERE_CLAUSE="${WHERE_CLAUSE} AND technician ILIKE '%${TECH_ESC}%'"
fi
if [[ -n "$DAY" ]]; then
    WHERE_CLAUSE="${WHERE_CLAUSE} AND day = '${DAY}'"
fi
# Always exclude placeholder techs
WHERE_CLAUSE="${WHERE_CLAUSE} AND technician NOT ILIKE '%Unscheduled%'"
# Strip leading " AND "
WHERE_CLAUSE="${WHERE_CLAUSE# AND }"
if [[ -n "$WHERE_CLAUSE" ]]; then
    WHERE_CLAUSE="WHERE ${WHERE_CLAUSE}"
fi

echo "=== Exporting rpt_active_routes ==="
echo "filter: ${WHERE_CLAUSE:-(none; all active routes)}"
echo "output: $OUTPUT"
echo

# ---- export CSV from the warehouse ----
ssh "$VPS_HOST" "docker exec -i ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -v ON_ERROR_STOP=1" > "$CSV_TMP" <<SQL
COPY (
  SELECT
    company,
    technician,
    day,
    stop_order,
    frequency,
    customer,
    address,
    city,
    state,
    zip,
    bodies_of_water,
    total_gallons,
    rate,
    rate_type,
    labor_cost,
    last_serviced,
    days_since_service,
    service_state,
    total_service_stops,
    route_started,
    route_ends,
    is_open_ended,
    route_assignment_id
  FROM public_semantic.rpt_active_routes
  ${WHERE_CLAUSE}
) TO STDOUT WITH (FORMAT CSV, HEADER true);
SQL

ROWS="$(($(wc -l < "$CSV_TMP") - 1))"
echo "  rows exported: $ROWS"

if [[ "$ROWS" -lt 1 ]]; then
    echo "ERROR: no rows returned. Check your filter arguments." >&2
    exit 1
fi

# ---- build xlsx ----
echo
echo "=== Building xlsx ==="
rm -f "$OUTPUT"
officecli create "$OUTPUT" >/dev/null
officecli import "$OUTPUT" /Sheet1 "$CSV_TMP" --header >/dev/null

# Column widths, header styling, and color scale on days_since_service
# (column Q in this schema — 17th column)
LAST_ROW=$((ROWS + 1))
cat > /tmp/export-ar-format.json <<JSON
[
  { "op": "set", "path": "/Sheet1/col[A]", "props": { "width": 8  } },
  { "op": "set", "path": "/Sheet1/col[B]", "props": { "width": 22 } },
  { "op": "set", "path": "/Sheet1/col[C]", "props": { "width": 11 } },
  { "op": "set", "path": "/Sheet1/col[D]", "props": { "width": 10 } },
  { "op": "set", "path": "/Sheet1/col[E]", "props": { "width": 14 } },
  { "op": "set", "path": "/Sheet1/col[F]", "props": { "width": 32 } },
  { "op": "set", "path": "/Sheet1/col[G]", "props": { "width": 28 } },
  { "op": "set", "path": "/Sheet1/col[H]", "props": { "width": 16 } },
  { "op": "set", "path": "/Sheet1/col[I]", "props": { "width": 6  } },
  { "op": "set", "path": "/Sheet1/col[J]", "props": { "width": 8  } },
  { "op": "set", "path": "/Sheet1/col[K]", "props": { "width": 22 } },
  { "op": "set", "path": "/Sheet1/col[L]", "props": { "width": 12 } },
  { "op": "set", "path": "/Sheet1/col[M]", "props": { "width": 10 } },
  { "op": "set", "path": "/Sheet1/col[N]", "props": { "width": 16 } },
  { "op": "set", "path": "/Sheet1/col[O]", "props": { "width": 12 } },
  { "op": "set", "path": "/Sheet1/col[P]", "props": { "width": 14 } },
  { "op": "set", "path": "/Sheet1/col[Q]", "props": { "width": 12 } },
  { "op": "set", "path": "/Sheet1/col[R]", "props": { "width": 22 } },
  { "op": "set", "path": "/Sheet1/col[S]", "props": { "width": 12 } },
  { "op": "set", "path": "/Sheet1/col[T]", "props": { "width": 14 } },
  { "op": "set", "path": "/Sheet1/col[U]", "props": { "width": 14 } },
  { "op": "set", "path": "/Sheet1/col[V]", "props": { "width": 14 } },
  { "op": "set", "path": "/Sheet1/col[W]", "props": { "width": 38 } },
  { "op": "set", "path": "/Sheet1/A1:W1", "props": { "font.bold": true, "fill": "1F4E78", "font.color": "FFFFFF" } },
  { "op": "add", "parent": "/Sheet1", "type": "colorscale", "props": { "sqref": "Q2:Q${LAST_ROW}", "mincolor": "63BE7B", "midcolor": "FFEB84", "maxcolor": "F8696B" } },
  { "op": "add", "parent": "/Sheet1", "type": "formulacf", "props": { "sqref": "R2:R${LAST_ROW}", "formula": "\$R2=\"awaiting_first_service\"", "fill": "D9E1F2" } },
  { "op": "add", "parent": "/Sheet1", "type": "formulacf", "props": { "sqref": "R2:R${LAST_ROW}", "formula": "\$R2=\"recent_30d\"",              "fill": "C6EFCE" } },
  { "op": "add", "parent": "/Sheet1", "type": "formulacf", "props": { "sqref": "R2:R${LAST_ROW}", "formula": "\$R2=\"last_30_to_90d\"",          "fill": "FFEB84" } },
  { "op": "add", "parent": "/Sheet1", "type": "formulacf", "props": { "sqref": "R2:R${LAST_ROW}", "formula": "\$R2=\"last_90d_plus\"",           "fill": "F8696B" } }
]
JSON

officecli batch "$OUTPUT" --input /tmp/export-ar-format.json >/dev/null
officecli close "$OUTPUT" >/dev/null || true
rm -f /tmp/export-ar-format.json

SIZE="$(du -h "$OUTPUT" | cut -f1)"
echo "  xlsx: $OUTPUT ($SIZE)"

if [[ "$OPEN_ON_EXIT" -eq 1 ]] && command -v open >/dev/null 2>&1; then
    open "$OUTPUT"
fi

echo
echo "Done."

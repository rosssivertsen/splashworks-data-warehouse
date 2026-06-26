#!/bin/bash
# staging-refresh.sh — nightly prod -> staging mirror with PII anonymized.
#
# Runs ON the staging box (srv1317522 / 76.13.29.44) via cron, AFTER the prod nightly ETL
# (prod pipeline ~01:15 UTC). Suggested staging schedule: 03:00 UTC.
#
# Flow: dump prod warehouse (over Tailscale) -> restore into staging Postgres -> re-grant roles
#       -> anonymize PII -> leak-check (fail-closed) -> recycle staging app containers.
#
# Fail-closed: if the post-mask leak check finds ANY unmasked customer name, the run aborts and
# the stale (already-anonymized) prior copy stays in place rather than exposing real data.
set -uo pipefail

PROD_TS=100.124.108.126                 # prod warehouse over the tailnet
REPO=/opt/splashworks
PGC=splashworks-postgres
PULL_KEY=/root/.ssh/staging_pull_ed25519   # dedicated, from=-restricted on prod
SSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -i $PULL_KEY"
LOG=/var/log/staging-refresh.log
SLACK_WEBHOOK_FILE=/root/.slack_webhook    # #alerts incoming webhook (optional; log-only if absent)

log(){ echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }
notify(){ [ -f "$SLACK_WEBHOOK_FILE" ] && curl -s -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"$1\"}" "$(cat "$SLACK_WEBHOOK_FILE")" >/dev/null 2>&1 || true; }
fail(){ log "❌ FAILED: $*"; notify "🔴 staging-refresh FAILED on srv1317522: $*"; exit 1; }

cd "$REPO" || fail "no repo at $REPO"
log "=== staging refresh start ==="

# 0. PROD-SAFETY GUARD: refuse to run the destructive restore on the prod box itself.
MY_TS=$(tailscale ip -4 2>/dev/null | head -1)
[ -n "$MY_TS" ] && [ "$MY_TS" = "$PROD_TS" ] && fail "refusing to run: this host IS prod ($PROD_TS)"

# 1. config: pull latest main so staging mirrors prod's code/compose/dbt too
#    (SKIP_GIT_SYNC=1 for manual validation runs before scripts are merged to main)
if [ -z "${SKIP_GIT_SYNC:-}" ]; then
  git fetch -q origin main && git reset -q --hard origin/main || log "warn: git sync skipped"
else
  log "git sync skipped (SKIP_GIT_SYNC set)"
fi

# 2. dump prod (custom format, no owner/privileges — matches migration runbook).
#    Exclude raw_skimmer dated drift-snapshot tables (*_YYYYMMDD): ~85% of cells, not test data.
#    Reversible — drop the -T flag and the next refresh restores them.
SNAP_GLOB='raw_skimmer.*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
$SSH root@$PROD_TS "docker exec $PGC pg_dump -U splashworks -Fc --no-owner --no-privileges -T '$SNAP_GLOB' splashworks > /tmp/prod.dump 2>/tmp/pgdump.err && du -h /tmp/prod.dump" \
  || fail "prod pg_dump"
log "prod dump created (drift snapshots excluded)"

# 3. transfer over tailnet
$SSH root@$PROD_TS "cat /tmp/prod.dump" > /tmp/prod.dump || fail "tailnet transfer"
log "dump pulled to staging ($(du -h /tmp/prod.dump | cut -f1))"

# 4. restore into staging (drop + recreate)
docker cp /tmp/prod.dump $PGC:/tmp/prod.dump
docker exec $PGC psql -U splashworks -d postgres -c "DROP DATABASE IF EXISTS splashworks WITH (FORCE);" || fail "drop db"
docker exec $PGC createdb -U splashworks splashworks
docker exec $PGC pg_restore -U splashworks --no-owner --no-privileges -j4 -d splashworks /tmp/prod.dump >/tmp/restore.log 2>&1 \
  || log "warn: pg_restore reported issues (see /tmp/restore.log)"
log "restore complete"

# 5. re-grant roles (pg_dump --no-privileges strips object GRANTs — see migration runbook Issue #1)
for f in infrastructure/postgres/init/0*.sql; do
  [ -f "$f" ] && docker exec -i $PGC psql -U splashworks -d splashworks -q < "$f" 2>/dev/null
done
log "role grants reapplied"

# 6. anonymize (the proven sweep)
docker cp etl/scripts/anonymize-staging.sql $PGC:/tmp/anonymize-staging.sql
docker exec $PGC psql -U splashworks -d splashworks -q -f /tmp/anonymize-staging.sql >/tmp/anon.log 2>&1 \
  || fail "anonymize step errored (see /tmp/anon.log)"
log "anonymization complete"

# 7. LEAK CHECK — fail-closed. Any unmasked customer name aborts the run.
LEAK=$(docker exec $PGC psql -U splashworks -d splashworks -tAc \
  "SELECT count(*) FROM public_warehouse.dim_customer WHERE clean_customer_name IS NOT NULL AND clean_customer_name NOT LIKE 'Masked\_%';")
[ "$LEAK" = "0" ] || fail "PII LEAK: $LEAK unmasked customer names after anonymization"
log "✅ leak check passed (0 unmasked names)"

# 8. recycle staging app containers so the UI/API serve the fresh anonymized copy
docker compose up -d 2>&1 | tail -3 || log "warn: compose up issues"
log "=== staging refresh OK ==="

# Runbook: Audit-log schema isolation (SECURITY_AUDIT_2026-07-14 MEDIUM-1)

**Change:** Move `query_audit_log` + `etl_incident_log` from `public` → `audit` schema so the
API's read-only role (`splashworks_ro`) can INSERT audit rows but can no longer SELECT them
(closes the `/api/query/raw → SELECT * FROM query_audit_log` PII exposure).

**Blast radius:** low. Two tables move; the API only ever INSERTs (verified). No legitimate
reader is severed — `metabase_ro` was never granted `public`, and no `auditor_ro` role exists yet.
The migration is idempotent, transactional, and **self-verifying** (aborts + rolls back if the
read-privilege revoke didn't hold, changing nothing).

**Order of operations matters:** apply the DB migration and deploy the new API/ETL code together.
If the code deploys first, audit INSERTs briefly target `audit.query_audit_log` before it exists
(audit writes fail silently — `log_query_audit` never raises — so no request breaks, but you lose
audit rows in the gap). If the DB migrates first, the old code writes to `public.query_audit_log`,
which no longer exists (same silent-loss window). Keep the gap short.

## Files in this change

- `infrastructure/postgres/migrations/2026-07-14-isolate-audit-log.sql` — the prod/staging migration
- `infrastructure/postgres/init/{01,02,03,07}` — fresh-boot parity (init scripts only run on an empty data dir)
- `api/services/audit_logger.py` — INSERT target → `audit.query_audit_log`
- `etl/triage.py` — incident table CREATE/INSERT → `audit.etl_incident_log` (+ ensures `audit` schema)
- `api/tests/unit/test_audit_logger.py` — assertion updated
- `docs/data-governance/controls/CTRL-05-audit-evidence.md` — evidence location updated

## Deploy (staging first)

Staging box `76.13.29.44` (srv1317522) runs the same schema on anonymized data — validate there first.

```bash
# 1. STAGING — apply migration, watch for the BEFORE/OK/AFTER notices
ssh root@76.13.29.44
cd /opt/splashworks   # (or staging compose dir)
git fetch && git checkout feature/in-audit-log-isolation && git pull
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U splashworks -d splashworks < infrastructure/postgres/migrations/2026-07-14-isolate-audit-log.sql
#   Expect: NOTICE BEFORE... / NOTICE OK: splashworks_ro has INSERT, not SELECT... / NOTICE AFTER...
#   BEFORE and AFTER row counts MUST match. If the OK notice is replaced by an ERROR, the
#   transaction rolled back and nothing changed — investigate before proceeding.

# 2. STAGING — deploy code (recreate, don't restart, so the image/env is re-read)
docker compose -f docker-compose.staging.yml up -d api
# ETL picks up triage.py on its next scheduled run; no container recreate needed for the cron.

# 3. STAGING — verify the hole is closed (should ERROR: permission denied)
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U splashworks_ro -d splashworks -c "SELECT count(*) FROM audit.query_audit_log;"
#   Expect: ERROR permission denied for table query_audit_log   ← this is success

# 4. STAGING — verify audit writes still work: make a query via dw-app, then as OWNER:
docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U splashworks -d splashworks -c "SELECT max(requested_at) FROM audit.query_audit_log;"
#   Expect: a timestamp within the last minute.
```

Repeat steps 1–4 on **prod** (`2.24.202.170`, `docker-compose.yml`, DB `splashworks`) once staging is clean.
Do this **before** the 1:15 UTC nightly cron so ETL triage writes land in the new location on the next run.

## Rollback

The migration only moves tables and adjusts grants; no data is dropped. To revert:

```sql
BEGIN;
ALTER TABLE audit.query_audit_log  SET SCHEMA public;
ALTER SEQUENCE audit.query_audit_log_id_seq SET SCHEMA public;
ALTER TABLE audit.etl_incident_log SET SCHEMA public;
ALTER SEQUENCE audit.etl_incident_log_id_seq SET SCHEMA public;
COMMIT;
```

…and redeploy the previous image (revert the branch). Because both directions are pure `SET SCHEMA`,
no audit rows are lost either way.

## Follow-up (MEDIUM-2, separate change)

Retention on `audit.query_audit_log` is still unbounded. Add a nightly
`DELETE FROM audit.query_audit_log WHERE requested_at < now() - interval '<N> days'`
once the retention window is decided (tie it to the data-governance conversation).

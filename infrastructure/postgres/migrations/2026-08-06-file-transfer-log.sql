-- Migration: audit.file_transfer_log — durable record of partner file egress/ingress
--
-- WHY: until now the only record of what a partner took was the systemd journal
-- (7-day horizon before 2026-08-06, 30-day after) plus Slack messages. Neither is
-- evidence-grade or queryable. This channel moves raw customer PII to a third
-- party, so it deserves at least the durability we already give API queries in
-- audit.query_audit_log.
--
-- Populated by infrastructure/sftp/notify-sftp-access.sh, which parses the same
-- internal-sftp journal records it alerts on. Inserts are idempotent (see the
-- unique constraint) so an overlapping or retried window cannot double-count.
--
-- Lives in `audit` (not `public`) for the same reason as query_audit_log: the
-- API's read-only role must never be able to read it. See
-- docs/runbooks/2026-07-14-audit-log-isolation.md.
--
-- Apply as the DB owner:
--   docker exec -i splashworks-postgres psql -U splashworks -d splashworks \
--     < infrastructure/postgres/migrations/2026-08-06-file-transfer-log.sql

\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.file_transfer_log (
    id           BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL,          -- when the transfer happened (from the journal)
    account      TEXT        NOT NULL,          -- e.g. sftp-greenmill-ci
    direction    TEXT        NOT NULL
        CONSTRAINT chk_direction CHECK (direction IN ('download', 'upload', 'delete')),
    path         TEXT        NOT NULL,          -- jail-relative, e.g. /extracts/AQPS.db.gz
    bytes        BIGINT,                        -- NULL for delete
    source_ip    TEXT,                          -- partner's egress IP (rotates for CI runners)
    session_pid  INTEGER,                       -- internal-sftp pid: groups events into a session
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotency: the notifier scans a moving journal window every 5 min. If a
    -- window overlaps or a run retries, the same record must not land twice.
    CONSTRAINT uq_file_transfer_event UNIQUE (occurred_at, session_pid, path, direction)
);

CREATE INDEX IF NOT EXISTS idx_file_transfer_occurred ON audit.file_transfer_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_transfer_account  ON audit.file_transfer_log (account, occurred_at DESC);

-- The read-only API role must never read partner-activity data, and writes here
-- come from the host script as the owner — so it gets nothing at all.
REVOKE ALL ON audit.file_transfer_log FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'splashworks_ro') THEN
        EXECUTE 'REVOKE ALL ON audit.file_transfer_log FROM splashworks_ro';
    END IF;
END $$;

-- Verify the isolation invariant actually holds before committing.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'splashworks_ro')
       AND has_table_privilege('splashworks_ro', 'audit.file_transfer_log', 'SELECT') THEN
        RAISE EXCEPTION 'FAIL: splashworks_ro can read audit.file_transfer_log';
    END IF;
    RAISE NOTICE 'OK: audit.file_transfer_log created; splashworks_ro has no access.';
END $$;

COMMIT;

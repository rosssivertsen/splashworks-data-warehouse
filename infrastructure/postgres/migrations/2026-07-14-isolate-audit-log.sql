-- Migration: isolate audit/incident logs from the read-only query role
-- Security finding MEDIUM-1 (docs/SECURITY_AUDIT_2026-07-14.md)
--
-- Problem: 03-create-readonly-user.sql grants `SELECT ON ALL TABLES IN SCHEMA
-- public` to splashworks_ro (the role the API connects as). query_audit_log and
-- etl_incident_log live in `public`, so any authenticated user can read every
-- other user's email, IP, and natural-language questions (which routinely
-- contain customer PII) via POST /api/query/raw:  SELECT * FROM query_audit_log.
-- The API only ever needs to INSERT audit rows; it must never read them back.
--
-- Fix: move both tables into a dedicated `audit` schema that splashworks_ro has
-- no read access to. The role keeps INSERT on the audit table (via explicit
-- grant, NOT the blanket public grant) and loses all read access. A schema move
-- (vs. a one-off REVOKE) also defeats the ALTER DEFAULT PRIVILEGES rule that
-- auto-grants SELECT on *future* public tables — so a new audit table can't
-- silently re-open the hole.
--
-- Idempotent and transactional. Safe to run more than once. Preserves all rows.
-- Apply on the running prod DB as the postgres owner:
--   docker compose exec -T postgres psql -U postgres -d splashworks \
--     < infrastructure/postgres/migrations/2026-07-14-isolate-audit-log.sql
-- Then recreate the API container so it picks up the code change:
--   docker compose up -d api
-- (Do NOT `docker compose restart` — it won't re-read a changed image.)

\set ON_ERROR_STOP on
BEGIN;

-- Row counts BEFORE, for reconciliation (compare against post-migration output).
-- Reads whichever schema each table currently lives in, so the count is correct
-- on both the first run (tables in public) and any re-run (already in audit).
DO $$
DECLARE q bigint; i bigint; qtbl regclass; itbl regclass;
BEGIN
    qtbl := COALESCE(to_regclass('public.query_audit_log'),  to_regclass('audit.query_audit_log'));
    itbl := COALESCE(to_regclass('public.etl_incident_log'), to_regclass('audit.etl_incident_log'));
    IF qtbl IS NOT NULL THEN EXECUTE format('SELECT count(*) FROM %s', qtbl) INTO q; END IF;
    IF itbl IS NOT NULL THEN EXECUTE format('SELECT count(*) FROM %s', itbl) INTO i; END IF;
    RAISE NOTICE 'BEFORE: query_audit_log=% (%), etl_incident_log=% (%)', q, qtbl, i, itbl;
END $$;

CREATE SCHEMA IF NOT EXISTS audit;

-- Move the tables (only if they still live in public). Owned SERIAL sequences
-- are NOT moved automatically by SET SCHEMA, so move them explicitly too.
DO $$
BEGIN
    IF to_regclass('public.query_audit_log') IS NOT NULL THEN
        ALTER TABLE public.query_audit_log SET SCHEMA audit;
    END IF;
    IF to_regclass('public.query_audit_log_id_seq') IS NOT NULL THEN
        ALTER SEQUENCE public.query_audit_log_id_seq SET SCHEMA audit;
    END IF;
    IF to_regclass('public.etl_incident_log') IS NOT NULL THEN
        ALTER TABLE public.etl_incident_log SET SCHEMA audit;
    END IF;
    IF to_regclass('public.etl_incident_log_id_seq') IS NOT NULL THEN
        ALTER SEQUENCE public.etl_incident_log_id_seq SET SCHEMA audit;
    END IF;
END $$;

-- Re-grant least privilege on the relocated audit table:
--   API role may INSERT (and use the sequence) but must NOT SELECT.
GRANT USAGE ON SCHEMA audit TO splashworks_ro;
GRANT INSERT ON audit.query_audit_log TO splashworks_ro;
GRANT USAGE, SELECT ON SEQUENCE audit.query_audit_log_id_seq TO splashworks_ro;

-- Belt-and-suspenders: strip any read the role may have inherited, on BOTH
-- audit tables. (etl_incident_log is written by the privileged ETL role/owner,
-- never by splashworks_ro, so the API role gets nothing on it.)
REVOKE SELECT ON audit.query_audit_log  FROM splashworks_ro;
REVOKE ALL    ON audit.etl_incident_log FROM splashworks_ro;

-- Verify the fix held: splashworks_ro must have INSERT but not SELECT on the
-- audit table. Abort the transaction if that invariant is violated.
DO $$
BEGIN
    IF has_table_privilege('splashworks_ro', 'audit.query_audit_log', 'SELECT') THEN
        RAISE EXCEPTION 'FAIL: splashworks_ro can still SELECT audit.query_audit_log';
    END IF;
    IF NOT has_table_privilege('splashworks_ro', 'audit.query_audit_log', 'INSERT') THEN
        RAISE EXCEPTION 'FAIL: splashworks_ro lost INSERT on audit.query_audit_log';
    END IF;
    IF has_table_privilege('splashworks_ro', 'audit.etl_incident_log', 'SELECT') THEN
        RAISE EXCEPTION 'FAIL: splashworks_ro can still SELECT audit.etl_incident_log';
    END IF;
    RAISE NOTICE 'OK: splashworks_ro has INSERT, not SELECT, on audit.query_audit_log; no access to audit.etl_incident_log.';
END $$;

-- Row counts AFTER — must match BEFORE (zero data loss).
DO $$
DECLARE q bigint; i bigint;
BEGIN
    SELECT count(*) INTO q FROM audit.query_audit_log;
    SELECT count(*) INTO i FROM audit.etl_incident_log;
    RAISE NOTICE 'AFTER:  audit.query_audit_log=% rows, audit.etl_incident_log=% rows', q, i;
END $$;

COMMIT;

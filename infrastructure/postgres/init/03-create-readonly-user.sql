-- Read-only user for API query execution
-- The API should connect as this user to limit blast radius of SQL injection
-- Password is set by 06-set-passwords.sh from environment variables
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'splashworks_ro') THEN
        CREATE ROLE splashworks_ro WITH LOGIN PASSWORD 'will_be_reset_by_init_script';
    END IF;
END
$$;

-- Grant read-only access to warehouse and semantic schemas
GRANT USAGE ON SCHEMA public TO splashworks_ro;
GRANT USAGE ON SCHEMA public_staging TO splashworks_ro;
GRANT USAGE ON SCHEMA public_warehouse TO splashworks_ro;
GRANT USAGE ON SCHEMA public_semantic TO splashworks_ro;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO splashworks_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public_staging TO splashworks_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public_warehouse TO splashworks_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public_semantic TO splashworks_ro;

-- Auto-grant SELECT on future tables created in these schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO splashworks_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_staging GRANT SELECT ON TABLES TO splashworks_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_warehouse GRANT SELECT ON TABLES TO splashworks_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_semantic GRANT SELECT ON TABLES TO splashworks_ro;

-- Allow writing to the audit log (needed by BackgroundTasks), but NOT reading it.
-- The audit log lives in the `audit` schema, so it is deliberately excluded from
-- the blanket `GRANT SELECT ON ALL TABLES IN SCHEMA public` above. Grant only
-- schema USAGE + table INSERT + sequence usage — never SELECT. This is what
-- keeps user emails/IPs/PII-bearing questions out of /api/query/raw reach.
-- See docs/SECURITY_AUDIT_2026-07-14.md (MEDIUM-1).
GRANT USAGE ON SCHEMA audit TO splashworks_ro;
GRANT INSERT ON audit.query_audit_log TO splashworks_ro;
GRANT USAGE, SELECT ON SEQUENCE audit.query_audit_log_id_seq TO splashworks_ro;
-- Defensive: ensure no SELECT leaks in on the audit table.
-- (etl_incident_log's revoke lives in 07, where that table is created.)
REVOKE SELECT ON audit.query_audit_log FROM splashworks_ro;

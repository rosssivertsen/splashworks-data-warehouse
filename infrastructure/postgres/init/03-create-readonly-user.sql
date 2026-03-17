-- Read-only user for API query execution
-- The API should connect as this user to limit blast radius of SQL injection
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'splashworks_ro') THEN
        CREATE ROLE splashworks_ro WITH LOGIN PASSWORD 'changeme_override_via_env';
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

-- Allow writing to the audit log (needed by BackgroundTasks)
GRANT INSERT ON public.query_audit_log TO splashworks_ro;
GRANT USAGE, SELECT ON SEQUENCE public.query_audit_log_id_seq TO splashworks_ro;

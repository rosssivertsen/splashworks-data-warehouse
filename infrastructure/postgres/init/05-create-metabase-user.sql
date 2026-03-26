-- Metabase user: read-only access to warehouse and semantic schemas
-- Metabase should never write to the database
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_ro') THEN
        CREATE ROLE metabase_ro WITH LOGIN PASSWORD 'changeme_override_via_env';
    END IF;
END
$$;

-- Read-only on warehouse and semantic layers (what Metabase dashboards need)
GRANT USAGE ON SCHEMA public_warehouse TO metabase_ro;
GRANT USAGE ON SCHEMA public_semantic TO metabase_ro;

GRANT SELECT ON ALL TABLES IN SCHEMA public_warehouse TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public_semantic TO metabase_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public_warehouse GRANT SELECT ON TABLES TO metabase_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_semantic GRANT SELECT ON TABLES TO metabase_ro;

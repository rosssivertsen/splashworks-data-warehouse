-- Ripple API user: read/write access to ripple schema only
-- Ripple only needs to manage doc_chunks and future feedback tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ripple_rw') THEN
        CREATE ROLE ripple_rw WITH LOGIN PASSWORD 'changeme_override_via_env';
    END IF;
END
$$;

-- Ripple schema: full CRUD on its own tables
GRANT USAGE ON SCHEMA ripple TO ripple_rw;
GRANT CREATE ON SCHEMA ripple TO ripple_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ripple TO ripple_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA ripple GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ripple_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ripple TO ripple_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA ripple GRANT USAGE, SELECT ON SEQUENCES TO ripple_rw;

-- Ripple needs to create the vector extension (already exists but CREATE IF NOT EXISTS requires it)
GRANT USAGE ON SCHEMA public TO ripple_rw;

-- Create warehouse schemas
CREATE SCHEMA IF NOT EXISTS raw_skimmer;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS warehouse;
CREATE SCHEMA IF NOT EXISTS semantic;
CREATE SCHEMA IF NOT EXISTS vectors;
CREATE SCHEMA IF NOT EXISTS ripple;

-- Audit/incident logs live here, isolated from the read-only query role so the
-- API can INSERT audit rows but no one can SELECT them back via /api/query/raw.
-- See docs/SECURITY_AUDIT_2026-07-14.md (MEDIUM-1).
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create ETL metadata table for load tracking
CREATE TABLE IF NOT EXISTS public.etl_load_log (
    id SERIAL PRIMARY KEY,
    run_id UUID DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    extract_date DATE NOT NULL,
    table_name TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    checksum TEXT,
    load_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    load_completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT
);

CREATE INDEX idx_etl_load_log_extract_date ON public.etl_load_log(extract_date);
CREATE INDEX idx_etl_load_log_run_id ON public.etl_load_log(run_id);

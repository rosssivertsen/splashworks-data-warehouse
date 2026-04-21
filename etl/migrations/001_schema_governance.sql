-- Migration 001 — Schema Governance scaffold
-- Date: 2026-04-20
-- PR:   hotfix/etl-schema-governance-seed
-- Policy: docs/data-governance/policy.md
-- Controls implemented: CTRL-01 (minimum), CTRL-05 (DDL only)
-- Controls deferred to ETL-9: CTRL-02, CTRL-04, CTRL-05 triggers+grants
--
-- Idempotency: all statements use IF NOT EXISTS or equivalent guards.
-- Safe to re-run. Safe to include in a fresh-database bootstrap sequence.
--
-- Rollback plan:
--   ALTER TABLE public.etl_load_log DROP COLUMN IF EXISTS schema_fingerprint;
--   ALTER TABLE public.etl_load_log DROP COLUMN IF EXISTS contract_version;
--   DROP TABLE IF EXISTS public.etl_schema_drift;
--   DROP TABLE IF EXISTS public.etl_schema_log;

BEGIN;

-- -------------------------------------------------------------------
-- 1. Extend etl_load_log with schema-awareness columns.
--    Existing checksum column remains row-count-focused (per its doc
--    comment). Schema state gets its own dedicated columns so each
--    piece of evidence is queryable independently.
-- -------------------------------------------------------------------

ALTER TABLE public.etl_load_log
  ADD COLUMN IF NOT EXISTS schema_fingerprint text;

ALTER TABLE public.etl_load_log
  ADD COLUMN IF NOT EXISTS contract_version text;

COMMENT ON COLUMN public.etl_load_log.schema_fingerprint IS
  'Stable hash of (column_name, column_type, ordinal_position) tuples from the source SQLite PRAGMA table_info. Independent of row data. A change in this value across runs triggers a raw-table rebuild regardless of row count.';

COMMENT ON COLUMN public.etl_load_log.contract_version IS
  'Governance contract version that was in force at load time. NULL for pre-governance tables. Sourced from docs/data-governance/contracts/<source>/<Table>.yml contract_version field.';

-- -------------------------------------------------------------------
-- 2. Evidence table: etl_schema_log (one row per (run, company, table))
--    Append-only. Every run writes here regardless of match/mismatch.
--    CTRL-01 populates this. CTRL-05 locks it down with triggers/grants
--    in ETL-9.
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.etl_schema_log (
  log_id              bigserial PRIMARY KEY,
  run_id              uuid NOT NULL,
  source_name         text NOT NULL,
  company_id          text NOT NULL,
  company_name        text NOT NULL,
  table_name          text NOT NULL,
  source_fingerprint  text NOT NULL,
  contract_version    text,                -- NULL when table is pre-governance
  contract_fingerprint text,               -- NULL when table is pre-governance
  matches_contract    boolean,             -- NULL when table is pre-governance
  column_list         jsonb NOT NULL,      -- [{"name":..,"type":..,"ordinal":..},...]
  pipeline_status     text,                -- 'healthy','drift_detected',... set at end of run
  detected_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etl_schema_log_run_idx
  ON public.etl_schema_log(run_id);

CREATE INDEX IF NOT EXISTS etl_schema_log_lookup_idx
  ON public.etl_schema_log(source_name, company_id, table_name, detected_at DESC);

COMMENT ON TABLE public.etl_schema_log IS
  'Evidence for CTRL-01 (schema validation). Append-only. One row per (run, source, company, table). Retained indefinitely per data-governance policy. Populated by etl/schema_contract.py (ETL-9).';

-- -------------------------------------------------------------------
-- 3. Evidence table: etl_schema_drift (one row per drift event)
--    Seeded empty. CTRL-02 populates this. Only resolution-related
--    columns may be updated post-insert (enforced by trigger in ETL-9).
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.etl_schema_drift (
  drift_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  source_name         text NOT NULL,
  company_id          text NOT NULL,
  table_name          text NOT NULL,
  drift_type          text NOT NULL CHECK (drift_type IN
                        ('additive','subtractive','type_change','ordering','combined')),
  contract_version    text NOT NULL,
  contract_columns    jsonb NOT NULL,
  actual_columns      jsonb NOT NULL,
  diff                jsonb NOT NULL,
  resolution          text NOT NULL DEFAULT 'unresolved'
                        CHECK (resolution IN
                          ('unresolved','approved','ignored',
                           'reverted_at_source','false_positive')),
  resolution_pr_url   text,
  resolution_by       text,
  notes               text
);

CREATE INDEX IF NOT EXISTS etl_schema_drift_open_idx
  ON public.etl_schema_drift(resolution)
  WHERE resolution = 'unresolved';

COMMENT ON TABLE public.etl_schema_drift IS
  'Evidence for CTRL-02 (drift alerting). One row per drift event, opened at detection, closed at resolution. See docs/data-governance/procedures/drift-incident-response.md.';

COMMIT;

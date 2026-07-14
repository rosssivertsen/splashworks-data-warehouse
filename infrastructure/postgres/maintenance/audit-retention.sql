-- Audit-log retention (SECURITY_AUDIT_2026-07-14 MEDIUM-2)
--
-- Two tiers, applied to both tables in the `audit` schema:
--   1. After 90 days  — redact the customer-PII-bearing FREE-TEXT columns
--      (question / generated_sql / executed_sql / error_message on the query log;
--       log_excerpt / llm_enrichment on the incident log), keeping the audit
--      METADATA row (who / when / endpoint / status / duration). The liability is
--      the free text; the value is the metadata — so we shed one and keep the other.
--   2. After 365 days — hard-delete the row entirely.
--
-- Idempotent and transactional. Safe to run nightly. Reports counts via NOTICE.
-- Run as the DB owner against the local container:
--   docker exec -i splashworks-postgres psql -U splashworks -d splashworks < audit-retention.sql

\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    redacted_q  int; redacted_i int;
    deleted_q   int; deleted_i  int;
BEGIN
    -- Tier 1: redact PII free-text older than 90 days.
    UPDATE audit.query_audit_log
       SET question = NULL, generated_sql = NULL, executed_sql = NULL, error_message = NULL
     WHERE requested_at < now() - interval '90 days'
       AND (question IS NOT NULL OR generated_sql IS NOT NULL
            OR executed_sql IS NOT NULL OR error_message IS NOT NULL);
    GET DIAGNOSTICS redacted_q = ROW_COUNT;

    UPDATE audit.etl_incident_log
       SET log_excerpt = NULL, llm_enrichment = NULL
     WHERE occurred_at < now() - interval '90 days'
       AND (log_excerpt IS NOT NULL OR llm_enrichment IS NOT NULL);
    GET DIAGNOSTICS redacted_i = ROW_COUNT;

    -- Tier 2: hard-delete rows older than 365 days.
    DELETE FROM audit.query_audit_log  WHERE requested_at < now() - interval '365 days';
    GET DIAGNOSTICS deleted_q = ROW_COUNT;

    DELETE FROM audit.etl_incident_log WHERE occurred_at < now() - interval '365 days';
    GET DIAGNOSTICS deleted_i = ROW_COUNT;

    RAISE NOTICE 'audit-retention: redacted PII query_audit_log=%, etl_incident_log=%; deleted rows query_audit_log=%, etl_incident_log=%',
        redacted_q, redacted_i, deleted_q, deleted_i;
END $$;

COMMIT;

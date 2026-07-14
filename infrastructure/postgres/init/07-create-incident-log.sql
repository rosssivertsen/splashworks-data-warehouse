-- Pipeline incident log: structured triage records for every nightly-pipeline
-- failure (written by etl/triage.py, which also CREATEs this if missing).
-- Lives in the `audit` schema (not `public`) so the read-only API role cannot
-- read log excerpts via /api/query/raw. See docs/SECURITY_AUDIT_2026-07-14.md.
CREATE TABLE IF NOT EXISTS audit.etl_incident_log (
    id SERIAL PRIMARY KEY,
    incident_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    step TEXT NOT NULL,
    exit_code INTEGER,
    severity TEXT NOT NULL,
    error_class TEXT NOT NULL,
    impact TEXT,
    recommended_actions TEXT,
    log_excerpt TEXT,
    llm_enrichment TEXT,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_etl_incident_log_occurred ON audit.etl_incident_log(occurred_at);

-- The read-only API role must never read incident log excerpts. It writes
-- nothing here (the privileged ETL role does), so strip all access.
REVOKE ALL ON audit.etl_incident_log FROM splashworks_ro;

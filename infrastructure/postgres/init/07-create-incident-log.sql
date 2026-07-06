-- Pipeline incident log: structured triage records for every nightly-pipeline
-- failure (written by etl/triage.py, which also CREATEs this if missing).
CREATE TABLE IF NOT EXISTS public.etl_incident_log (
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

CREATE INDEX IF NOT EXISTS idx_etl_incident_log_occurred ON public.etl_incident_log(occurred_at);

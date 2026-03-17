-- Query audit log — records every /api/query and /api/query/raw request
CREATE TABLE IF NOT EXISTS public.query_audit_log (
    id              SERIAL PRIMARY KEY,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip       TEXT,
    cf_access_email TEXT,
    endpoint        TEXT NOT NULL,
    question        TEXT,
    layer           TEXT,
    rewriter_confidence TEXT,
    generated_sql   TEXT,
    executed_sql    TEXT,
    was_repaired    BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL
        CONSTRAINT chk_status CHECK (status IN (
            'success', 'error', 'unanswerable', 'timeout',
            'validation_error', 'ai_error', 'connection_error'
        )),
    row_count       INTEGER,
    duration_ms     INTEGER,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_audit_log_requested_at
    ON public.query_audit_log(requested_at);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_cf_access_email
    ON public.query_audit_log(cf_access_email);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_status
    ON public.query_audit_log(status);

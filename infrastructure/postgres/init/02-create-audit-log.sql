-- Query audit log — records every /api/query and /api/query/raw request.
-- Lives in the `audit` schema (not `public`) so the read-only API role can
-- INSERT rows but cannot SELECT them back. See docs/SECURITY_AUDIT_2026-07-14.md.
CREATE TABLE IF NOT EXISTS audit.query_audit_log (
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
    ON audit.query_audit_log(requested_at);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_cf_access_email
    ON audit.query_audit_log(cf_access_email);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_status
    ON audit.query_audit_log(status);

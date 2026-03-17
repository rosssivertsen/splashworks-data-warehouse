import logging

import psycopg2

from api.config import DATABASE_URL

logger = logging.getLogger(__name__)

INSERT_SQL = """
    INSERT INTO public.query_audit_log (
        client_ip, cf_access_email, endpoint, question, layer,
        rewriter_confidence, generated_sql, executed_sql, was_repaired,
        status, row_count, duration_ms, error_message
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s, %s
    )
"""


def log_query_audit(
    *,
    client_ip: str | None = None,
    cf_access_email: str | None = None,
    endpoint: str,
    question: str | None = None,
    layer: str | None = None,
    rewriter_confidence: str | None = None,
    generated_sql: str | None = None,
    executed_sql: str | None = None,
    was_repaired: bool = False,
    status: str,
    row_count: int | None = None,
    duration_ms: int | None = None,
    error_message: str | None = None,
) -> None:
    """Write one row to query_audit_log. Never raises — logs errors to stderr."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute(INSERT_SQL, (
                client_ip, cf_access_email, endpoint, question, layer,
                rewriter_confidence, generated_sql, executed_sql, was_repaired,
                status, row_count, duration_ms, error_message,
            ))
            conn.commit()
            cur.close()
        finally:
            conn.close()
    except Exception:
        logger.exception("Audit log failed")

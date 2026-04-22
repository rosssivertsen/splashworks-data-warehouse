"""ETL run metadata logging."""

import uuid
from datetime import date, datetime, timezone

import psycopg2


def start_load(
    conn,
    run_id: str,
    source_name: str,
    company_id: str,
    company_name: str,
    extract_date: date,
    table_name: str,
) -> int:
    """Log the start of a table load. Returns the log entry ID."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.etl_load_log
                (run_id, source_name, company_id, company_name, extract_date,
                 table_name, row_count, status)
            VALUES (%s, %s, %s, %s, %s, %s, 0, 'running')
            RETURNING id
            """,
            (run_id, source_name, company_id, company_name, extract_date, table_name),
        )
        row_id = cur.fetchone()[0]
    conn.commit()
    return row_id


def complete_load(
    conn,
    log_id: int,
    row_count: int,
    checksum: str,
    schema_fingerprint: str | None = None,
    contract_version: str | None = None,
) -> None:
    """Mark a table load as completed.

    Args:
        schema_fingerprint: SHA-256 hex of the source (column_name, type, ordinal)
            tuples. Captures schema state independent of row data. See
            docs/data-governance/controls/CTRL-01-schema-validation.md.
        contract_version: Governance contract version in force at load time.
            None for pre-governance tables (not yet in contracts/<source>/_index.yml).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.etl_load_log
            SET status = 'completed',
                row_count = %s,
                checksum = %s,
                schema_fingerprint = %s,
                contract_version = %s,
                load_completed_at = NOW()
            WHERE id = %s
            """,
            (row_count, checksum, schema_fingerprint, contract_version, log_id),
        )
    conn.commit()


def fail_load(conn, log_id: int, error_message: str) -> None:
    """Mark a table load as failed."""
    conn.rollback()
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.etl_load_log
            SET status = 'failed',
                error_message = %s,
                load_completed_at = NOW()
            WHERE id = %s
            """,
            (error_message, log_id),
        )
    conn.commit()


def generate_run_id() -> str:
    """Generate a unique run ID."""
    return str(uuid.uuid4())

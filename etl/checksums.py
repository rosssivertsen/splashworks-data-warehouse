"""Checksum tracking for incremental loads."""

from datetime import date
from typing import Optional

import psycopg2


def get_previous_checksum(
    conn, source_name: str, company_id: str, table_name: str
) -> Optional[str]:
    """Get the most recent checksum for a source/company/table combo."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT checksum FROM public.etl_load_log
            WHERE source_name = %s AND company_id = %s AND table_name = %s
              AND status = 'completed'
            ORDER BY extract_date DESC
            LIMIT 1
            """,
            (source_name, company_id, table_name),
        )
        row = cur.fetchone()
        return row[0] if row else None

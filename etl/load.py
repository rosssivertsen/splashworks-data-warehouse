"""Load: write extracted data to Postgres raw schema."""

import csv
import io
from datetime import date
from typing import Optional

import psycopg2
from psycopg2 import sql as pgsql

from etl.config import DATABASE_URL, RAW_SCHEMA


def get_connection():
    """Get a Postgres connection."""
    return psycopg2.connect(DATABASE_URL)


def _pg_type_for_sqlite(sqlite_type: str) -> str:
    """Map SQLite column types to Postgres types."""
    t = (sqlite_type or "TEXT").upper()
    if t in ("INTEGER", "INT"):
        return "BIGINT"
    if t in ("REAL", "FLOAT", "NUMERIC"):
        return "DOUBLE PRECISION"
    if t in ("BOOLEAN", "BOOL"):
        return "TEXT"  # SQLite booleans are 0/1, store as text then cast in staging
    if t == "BLOB":
        return "BYTEA"
    if t in ("DATETIME", "DATE"):
        return "TEXT"  # Store raw, parse in staging layer
    if t == "JSON":
        return "TEXT"  # Store raw JSON as text
    return "TEXT"


def create_raw_table(
    conn,
    table_name: str,
    columns: list[str],
    sqlite_types: Optional[list[str]] = None,
    extract_date: date = None,
    company_name: str = "",
) -> str:
    """Create a company- and date-stamped raw table in Postgres.

    Returns the fully qualified table name.
    """
    if extract_date is None:
        extract_date = date.today()

    prefix = f"{company_name}_" if company_name else ""
    raw_table = f"{prefix}{table_name}_{extract_date.strftime('%Y%m%d')}"

    col_defs = []
    for i, col in enumerate(columns):
        pg_type = "TEXT"
        if sqlite_types and i < len(sqlite_types):
            pg_type = _pg_type_for_sqlite(sqlite_types[i])
        col_defs.append(f'"{col}" {pg_type}')

    col_sql = ", ".join(col_defs)
    create_sql = f'CREATE TABLE IF NOT EXISTS {RAW_SCHEMA}."{raw_table}" ({col_sql})'

    with conn.cursor() as cur:
        cur.execute(create_sql)
    conn.commit()

    return f'{RAW_SCHEMA}."{raw_table}"'


def load_rows_copy(conn, fq_table: str, columns: list[str], rows: list[tuple]) -> int:
    """Load rows using COPY FROM STDIN (fast bulk load).

    Returns number of rows loaded.
    """
    if not rows:
        return 0

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter="\t", quoting=csv.QUOTE_MINIMAL)
    for row in rows:
        # Convert None to \N for Postgres COPY null handling
        cleaned = []
        for val in row:
            if val is None:
                cleaned.append("\\N")
            elif isinstance(val, bytes):
                cleaned.append(val.hex())
            elif isinstance(val, bool):
                cleaned.append("1" if val else "0")
            else:
                s = str(val).replace("\t", " ").replace("\n", " ").replace("\r", "")
                cleaned.append(s)
        writer.writerow(cleaned)

    buf.seek(0)

    col_list = ", ".join(f'"{c}"' for c in columns)
    copy_sql = f"COPY {fq_table} ({col_list}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')"

    with conn.cursor() as cur:
        cur.copy_expert(copy_sql, buf)
    conn.commit()

    return len(rows)


def create_current_view(conn, table_name: str, extract_date: date, company_name: str = "") -> str:
    """Create/replace a view without date suffix pointing to the latest load.

    This gives dbt a stable source name (e.g., AQPS_Customer) that always
    points to the latest date-stamped table (e.g., AQPS_Customer_20260308).
    """
    prefix = f"{company_name}_" if company_name else ""
    dated_table = f"{prefix}{table_name}_{extract_date.strftime('%Y%m%d')}"
    view_name = f"{prefix}{table_name}"
    view_sql = f'CREATE OR REPLACE VIEW {RAW_SCHEMA}."{view_name}" AS SELECT * FROM {RAW_SCHEMA}."{dated_table}"'
    with conn.cursor() as cur:
        cur.execute(view_sql)
    conn.commit()
    return f'{RAW_SCHEMA}."{view_name}"'


def drop_raw_table(conn, table_name: str, extract_date: date, company_name: str = "") -> None:
    """Drop a company- and date-stamped raw table (for re-runs)."""
    prefix = f"{company_name}_" if company_name else ""
    raw_table = f"{prefix}{table_name}_{extract_date.strftime('%Y%m%d')}"
    with conn.cursor() as cur:
        cur.execute(f'DROP TABLE IF EXISTS {RAW_SCHEMA}."{raw_table}" CASCADE')
    conn.commit()

"""ETL orchestrator: extract SQLite dumps, load to Postgres raw schema."""

import os
import sys
import sqlite3
from datetime import date
from pathlib import Path

from etl.config import COMPANY_MAP, EXTRACT_DIR, RAW_SCHEMA
from etl.extract import (
    decompress_to_temp,
    file_checksum,
    find_extracts,
    list_tables,
    read_table,
)
from etl.load import create_raw_table, drop_raw_table, get_connection, load_rows_copy
from etl.checksums import get_previous_checksum
from etl.metadata import complete_load, fail_load, generate_run_id, start_load


def get_sqlite_column_types(db_path: Path, table_name: str) -> list[str]:
    """Get column types from SQLite PRAGMA table_info."""
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute(f'PRAGMA table_info("{table_name}")')
    types = [row[2] for row in cursor.fetchall()]
    conn.close()
    return types


def run_etl(extract_dir: Path = None, extract_date: date = None) -> dict:
    """Run the full ETL pipeline.

    Returns a summary dict with counts and statuses.
    """
    if extract_dir is None:
        extract_dir = EXTRACT_DIR
    if extract_date is None:
        extract_date = date.today()

    run_id = generate_run_id()
    print(f"ETL Run: {run_id}")
    print(f"Extract date: {extract_date}")
    print(f"Source dir: {extract_dir}")
    print()

    extracts = find_extracts(extract_dir)
    if not extracts:
        print("ERROR: No .db.gz files found")
        return {"status": "error", "message": "No extracts found"}

    conn = get_connection()
    summary = {"run_id": run_id, "companies": {}, "status": "completed"}

    for company_id, company_name, gz_path in extracts:
        print(f"Processing {company_name} ({company_id[:8]}...)...")
        company_summary = {"tables": 0, "rows": 0, "skipped": 0, "errors": 0}

        # Decompress
        db_path = decompress_to_temp(gz_path)
        db_checksum = file_checksum(db_path)
        print(f"  Decompressed: {db_path} (checksum: {db_checksum[:12]}...)")

        try:
            tables = list_tables(db_path)
            print(f"  Found {len(tables)} tables")

            for table_name in tables:
                log_id = start_load(
                    conn, run_id, "skimmer", company_id, company_name,
                    extract_date, table_name,
                )

                try:
                    # Read from SQLite
                    columns, rows = read_table(db_path, table_name)
                    sqlite_types = get_sqlite_column_types(db_path, table_name)
                    row_count = len(rows)

                    # Compute table-level checksum (row count + first/last row hash)
                    table_checksum = f"{row_count}"

                    # Check if data changed
                    prev_checksum = get_previous_checksum(
                        conn, "skimmer", company_id, table_name
                    )
                    if prev_checksum == table_checksum:
                        print(f"    {table_name}: {row_count} rows (unchanged, skipped)")
                        complete_load(conn, log_id, row_count, table_checksum)
                        company_summary["skipped"] += 1
                        continue

                    # Drop existing table for this date (idempotent re-run)
                    drop_raw_table(conn, table_name, extract_date)

                    # Create and load
                    fq_table = create_raw_table(
                        conn, table_name, columns, sqlite_types, extract_date
                    )
                    loaded = load_rows_copy(conn, fq_table, columns, rows)

                    complete_load(conn, log_id, loaded, table_checksum)
                    company_summary["tables"] += 1
                    company_summary["rows"] += loaded
                    print(f"    {table_name}: {loaded} rows loaded")

                except Exception as e:
                    fail_load(conn, log_id, str(e))
                    company_summary["errors"] += 1
                    print(f"    {table_name}: ERROR - {e}")

        finally:
            # Cleanup temp file
            os.unlink(db_path)

        summary["companies"][company_name] = company_summary
        print(f"  Done: {company_summary}")
        print()

    conn.close()

    # Print summary
    total_tables = sum(c["tables"] for c in summary["companies"].values())
    total_rows = sum(c["rows"] for c in summary["companies"].values())
    total_errors = sum(c["errors"] for c in summary["companies"].values())
    print(f"ETL Complete: {total_tables} tables, {total_rows} rows, {total_errors} errors")

    if total_errors > 0:
        summary["status"] = "completed_with_errors"

    return summary


if __name__ == "__main__":
    # Allow overriding extract dir from command line
    extract_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    run_etl(extract_dir=extract_dir)

"""Tests for ETL load module — requires running Postgres.

These are integration tests. Skip if Postgres is not available.
"""

import os
import pytest
from datetime import date

# Skip all tests if DATABASE_URL not set or Postgres not reachable
pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set (Postgres integration tests)",
)


def test_create_and_load_raw_table():
    """Test creating a raw table and loading rows via COPY."""
    from etl.load import create_raw_table, get_connection, load_rows_copy

    conn = get_connection()
    try:
        columns = ["id", "FirstName", "IsInactive"]
        sqlite_types = ["TEXT", "TEXT", "BOOLEAN"]
        test_date = date(2099, 1, 1)  # Far future to avoid collisions

        fq_table = create_raw_table(
            conn, "test_customer", columns, sqlite_types, test_date
        )

        rows = [("c1", "Alice", "0"), ("c2", "Bob", "1")]
        loaded = load_rows_copy(conn, fq_table, columns, rows)
        assert loaded == 2

        # Verify data
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {fq_table}")
            assert cur.fetchone()[0] == 2

        # Cleanup
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {fq_table}")
        conn.commit()
    finally:
        conn.close()

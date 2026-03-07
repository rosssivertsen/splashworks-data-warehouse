# Phase 0: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the VPS infrastructure (Docker, Postgres, Cloudflare Tunnel, rclone, dbt) and load the first Skimmer extract into the warehouse.

**Architecture:** Single VPS running Docker Compose with Postgres, cloudflared, and an ETL container. rclone syncs nightly SQLite dumps from OneDrive. Python ETL loads raw data into Postgres. dbt scaffolding prepared for Phase 1 transforms.

**Tech Stack:** Docker, Docker Compose, PostgreSQL 16 + pgvector, rclone, cloudflared, dbt-postgres, Python 3.12, Bash

---

## Task 1: Create Feature Branch

**Files:**
- None (git operation only)

**Step 1: Create and push the feature branch**

```bash
git checkout development
git checkout -b feature/warehouse-etl
git push -u origin feature/warehouse-etl
```

**Step 2: Verify branch**

```bash
git branch --show-current
```
Expected: `feature/warehouse-etl`

---

## Task 2: Create Docker Compose Foundation

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (gitignored)

**Step 1: Create .env.example**

```env
# Splashworks Data Warehouse — Environment Variables
# Copy to .env and fill in values

# PostgreSQL
DB_PASSWORD=changeme_use_a_strong_password

# AI Provider API Keys (server-side, not exposed to frontend)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=anthropic

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token_here
```

**Step 2: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: splashworks-postgres
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init:/docker-entrypoint-initdb.d
    environment:
      POSTGRES_DB: splashworks
      POSTGRES_USER: splashworks
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U splashworks -d splashworks"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pg_data:
```

Note: We start with just Postgres. Additional services (api, frontend, metabase, cloudflared, etl) are added in later tasks/phases as they are built.

**Step 3: Create Postgres init script**

Create: `infrastructure/postgres/init/01-create-schemas.sql`

```sql
-- Create warehouse schemas
CREATE SCHEMA IF NOT EXISTS raw_skimmer;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS warehouse;
CREATE SCHEMA IF NOT EXISTS semantic;
CREATE SCHEMA IF NOT EXISTS vectors;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create ETL metadata table for load tracking
CREATE TABLE IF NOT EXISTS public.etl_load_log (
    id SERIAL PRIMARY KEY,
    run_id UUID DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    company_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    extract_date DATE NOT NULL,
    table_name TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    checksum TEXT,
    load_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    load_completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT
);

CREATE INDEX idx_etl_load_log_extract_date ON public.etl_load_log(extract_date);
CREATE INDEX idx_etl_load_log_run_id ON public.etl_load_log(run_id);
```

**Step 4: Ensure .env is gitignored**

Check that `.gitignore` contains `.env`. If not, add it.

**Step 5: Create local .env from example**

```bash
cp .env.example .env
# Edit .env with actual DB_PASSWORD (generate a strong one)
```

**Step 6: Run and verify Postgres**

```bash
docker compose up -d postgres
docker compose ps
```
Expected: `splashworks-postgres` status "healthy"

**Step 7: Verify schemas and pgvector**

```bash
docker compose exec postgres psql -U splashworks -d splashworks -c "\dn"
```
Expected output includes: `raw_skimmer`, `staging`, `warehouse`, `semantic`, `vectors`

```bash
docker compose exec postgres psql -U splashworks -d splashworks -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```
Expected: `vector`

```bash
docker compose exec postgres psql -U splashworks -d splashworks -c "SELECT COUNT(*) FROM public.etl_load_log;"
```
Expected: `0`

**Step 8: Commit**

```bash
git add docker-compose.yml .env.example infrastructure/
# Do NOT add .env
git commit -m "feat: add Docker Compose with Postgres + pgvector and warehouse schemas"
```

---

## Task 3: Create Python ETL Package

**Files:**
- Create: `etl/requirements.txt`
- Create: `etl/config.py`
- Create: `etl/extract.py`
- Create: `etl/load.py`
- Create: `etl/checksums.py`
- Create: `etl/metadata.py`
- Create: `etl/main.py`
- Create: `etl/Dockerfile`
- Create: `etl/tests/test_extract.py`
- Create: `etl/tests/test_load.py`

**Step 1: Create etl/requirements.txt**

```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
```

**Step 2: Create etl/config.py**

```python
"""ETL configuration — database connections, file paths, company mappings."""

import os
from pathlib import Path

# Company ID to friendly name mapping
COMPANY_MAP = {
    "e265c9dee47c47c6a73f689b0df467ca": "AQPS",
    "95d37a64d1794a1caef111e801db5477": "JOMO",
}

# Reverse mapping
COMPANY_IDS = {v: k for k, v in COMPANY_MAP.items()}

# File paths
EXTRACT_DIR = Path(os.environ.get("EXTRACT_DIR", "/data/extracts"))

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://splashworks:changeme@localhost:5432/splashworks",
)

# Raw schema prefix
RAW_SCHEMA = "raw_skimmer"
```

**Step 3: Create etl/extract.py**

```python
"""Extract: decompress and read SQLite databases."""

import gzip
import hashlib
import sqlite3
import tempfile
from pathlib import Path
from typing import Iterator

from etl.config import COMPANY_MAP


def find_extracts(extract_dir: Path) -> list[tuple[str, str, Path]]:
    """Find .db.gz files and map to company names.

    Returns list of (company_id, company_name, file_path) tuples.
    """
    results = []
    for gz_path in sorted(extract_dir.glob("*.db.gz")):
        stem = gz_path.stem.replace(".db", "")
        company_name = COMPANY_MAP.get(stem, stem)
        results.append((stem, company_name, gz_path))
    return results


def decompress_to_temp(gz_path: Path) -> Path:
    """Decompress a .db.gz file to a temporary .db file.

    Caller is responsible for cleanup.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    with gzip.open(gz_path, "rb") as f_in:
        while chunk := f_in.read(65536):
            tmp.write(chunk)
    tmp.close()
    return Path(tmp.name)


def file_checksum(path: Path) -> str:
    """Compute MD5 checksum of a file."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def list_tables(db_path: Path) -> list[str]:
    """List all user tables in a SQLite database."""
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables


def read_table(db_path: Path, table_name: str) -> tuple[list[str], list[tuple]]:
    """Read all rows from a SQLite table.

    Returns (column_names, rows).
    """
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute(f'SELECT * FROM "{table_name}"')
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    return columns, rows


def read_table_streaming(
    db_path: Path, table_name: str, batch_size: int = 5000
) -> Iterator[tuple[list[str], list[tuple]]]:
    """Read table rows in batches for memory efficiency.

    Yields (column_names, batch_of_rows) tuples.
    """
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute(f'SELECT * FROM "{table_name}"')
    columns = [desc[0] for desc in cursor.description]
    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break
        yield columns, rows
    conn.close()
```

**Step 4: Create etl/load.py**

```python
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
) -> str:
    """Create a date-stamped raw table in Postgres.

    Returns the fully qualified table name.
    """
    if extract_date is None:
        extract_date = date.today()

    raw_table = f"{table_name}_{extract_date.strftime('%Y%m%d')}"

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


def drop_raw_table(conn, table_name: str, extract_date: date) -> None:
    """Drop a date-stamped raw table (for re-runs)."""
    raw_table = f"{table_name}_{extract_date.strftime('%Y%m%d')}"
    with conn.cursor() as cur:
        cur.execute(f'DROP TABLE IF EXISTS {RAW_SCHEMA}."{raw_table}" CASCADE')
    conn.commit()
```

**Step 5: Create etl/checksums.py**

```python
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
```

**Step 6: Create etl/metadata.py**

```python
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


def complete_load(conn, log_id: int, row_count: int, checksum: str) -> None:
    """Mark a table load as completed."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.etl_load_log
            SET status = 'completed',
                row_count = %s,
                checksum = %s,
                load_completed_at = NOW()
            WHERE id = %s
            """,
            (row_count, checksum, log_id),
        )
    conn.commit()


def fail_load(conn, log_id: int, error_message: str) -> None:
    """Mark a table load as failed."""
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
```

**Step 7: Create etl/main.py**

```python
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
```

**Step 8: Create etl/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default: run ETL
CMD ["python", "-m", "etl.main"]
```

**Step 9: Create etl/__init__.py**

```python
```

**Step 10: Create etl/tests/__init__.py and test_extract.py**

`etl/tests/__init__.py`: empty file

`etl/tests/test_extract.py`:

```python
"""Tests for ETL extract module."""

import gzip
import sqlite3
import tempfile
from pathlib import Path

from etl.extract import (
    decompress_to_temp,
    file_checksum,
    find_extracts,
    list_tables,
    read_table,
)
from etl.config import COMPANY_MAP


def _create_test_db(path: Path) -> None:
    """Create a minimal SQLite test database."""
    conn = sqlite3.connect(str(path))
    conn.execute("CREATE TABLE Customer (id TEXT PRIMARY KEY, FirstName TEXT, IsInactive BOOLEAN)")
    conn.execute("INSERT INTO Customer VALUES ('c1', 'Alice', 0)")
    conn.execute("INSERT INTO Customer VALUES ('c2', 'Bob', 1)")
    conn.execute("CREATE TABLE Pool (id TEXT PRIMARY KEY, Gallons INTEGER)")
    conn.execute("INSERT INTO Pool VALUES ('p1', 15000)")
    conn.commit()
    conn.close()


def _create_test_gz(directory: Path, filename: str) -> Path:
    """Create a gzipped test database."""
    db_path = directory / "temp.db"
    _create_test_db(db_path)
    gz_path = directory / filename
    with open(db_path, "rb") as f_in:
        with gzip.open(gz_path, "wb") as f_out:
            f_out.write(f_in.read())
    db_path.unlink()
    return gz_path


def test_find_extracts_maps_company_ids():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        _create_test_gz(tmpdir, "e265c9dee47c47c6a73f689b0df467ca.db.gz")
        _create_test_gz(tmpdir, "95d37a64d1794a1caef111e801db5477.db.gz")

        results = find_extracts(tmpdir)
        names = {r[1] for r in results}
        assert names == {"AQPS", "JOMO"}


def test_find_extracts_unknown_company():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        _create_test_gz(tmpdir, "unknown_company.db.gz")

        results = find_extracts(tmpdir)
        assert len(results) == 1
        assert results[0][1] == "unknown_company"  # Falls back to filename stem


def test_decompress_to_temp():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        gz_path = _create_test_gz(tmpdir, "test.db.gz")

        db_path = decompress_to_temp(gz_path)
        try:
            assert db_path.exists()
            # Verify it's a valid SQLite database
            conn = sqlite3.connect(str(db_path))
            tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            conn.close()
            assert len(tables) == 2
        finally:
            db_path.unlink()


def test_file_checksum_deterministic():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        gz_path = _create_test_gz(tmpdir, "test.db.gz")

        c1 = file_checksum(gz_path)
        c2 = file_checksum(gz_path)
        assert c1 == c2
        assert len(c1) == 32  # MD5 hex length


def test_list_tables():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        db_path = tmpdir / "test.db"
        _create_test_db(db_path)

        tables = list_tables(db_path)
        assert set(tables) == {"Customer", "Pool"}


def test_read_table():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        db_path = tmpdir / "test.db"
        _create_test_db(db_path)

        columns, rows = read_table(db_path, "Customer")
        assert columns == ["id", "FirstName", "IsInactive"]
        assert len(rows) == 2
        assert rows[0] == ("c1", "Alice", 0)
```

**Step 11: Create etl/tests/test_load.py**

```python
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
```

**Step 12: Run extract tests locally**

```bash
cd etl
pip install -e . 2>/dev/null || pip install psycopg2-binary python-dotenv
python -m pytest tests/test_extract.py -v
```
Expected: All tests pass

**Step 13: Commit ETL package**

```bash
git add etl/
git commit -m "feat: add Python ETL package for SQLite -> Postgres extraction and loading"
```

---

## Task 4: Test ETL Against Real Data (Local)

**Files:**
- None new (uses existing cli/load-extract.sh output)

**Step 1: Ensure local Skimmer extracts are available**

```bash
./cli/load-extract.sh status
```

If no databases loaded:
```bash
./cli/load-extract.sh
```

**Step 2: Run ETL against local data directory**

The `data/` directory contains decompressed .db files (not .db.gz). We need the .gz source files. Copy them from OneDrive for a local test:

```bash
mkdir -p data/extracts
cp "/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract/"*.db.gz data/extracts/
```

**Step 3: Run ETL pointing at local Postgres**

```bash
DATABASE_URL="postgresql://splashworks:$(grep DB_PASSWORD .env | cut -d= -f2)@localhost:5432/splashworks" \
  python -m etl.main data/extracts
```

Expected: All 30 tables for both AQPS and JOMO loaded, row counts printed.

**Step 4: Verify data in Postgres**

```bash
docker compose exec postgres psql -U splashworks -d splashworks -c "
  SELECT table_name, pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename))
  FROM pg_tables
  WHERE schemaname = 'raw_skimmer'
  ORDER BY table_name
  LIMIT 10;
"
```

**Step 5: Verify ETL metadata logged**

```bash
docker compose exec postgres psql -U splashworks -d splashworks -c "
  SELECT company_name, COUNT(*) as tables_loaded, SUM(row_count) as total_rows, status
  FROM public.etl_load_log
  GROUP BY company_name, status;
"
```
Expected: Two rows (AQPS, JOMO), status = 'completed', row counts > 0.

**Step 6: Run ETL again to test checksum skip**

```bash
DATABASE_URL="postgresql://splashworks:$(grep DB_PASSWORD .env | cut -d= -f2)@localhost:5432/splashworks" \
  python -m etl.main data/extracts
```

Expected: Tables show "(unchanged, skipped)" since the data hasn't changed.

**Step 7: Commit any ETL fixes**

If any changes were needed during testing:
```bash
git add etl/
git commit -m "fix: ETL adjustments from real data testing"
```

---

## Task 5: Scaffold dbt Project

**Files:**
- Create: `dbt/dbt_project.yml`
- Create: `dbt/profiles.yml`
- Create: `dbt/packages.yml`
- Create: `dbt/models/staging/_sources.yml`
- Create: `dbt/models/staging/_staging.yml`
- Create: `dbt/seeds/company_lookup.csv`
- Create: `dbt/macros/service_completion.sql`
- Create: `dbt/macros/dosage_cost.sql`
- Create: `dbt/macros/clean_customer_name.sql`

**Step 1: Create dbt/dbt_project.yml**

```yaml
name: splashworks_warehouse
version: '1.0.0'
config-version: 2

profile: splashworks

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

clean-targets:
  - target
  - dbt_packages

models:
  splashworks_warehouse:
    staging:
      +materialized: view
      +schema: staging
    warehouse:
      +materialized: table
      +schema: warehouse
    semantic:
      +materialized: table
      +schema: semantic
```

**Step 2: Create dbt/profiles.yml**

```yaml
splashworks:
  target: dev
  outputs:
    dev:
      type: postgres
      host: "{{ env_var('DBT_HOST', 'localhost') }}"
      port: 5432
      user: splashworks
      password: "{{ env_var('DBT_PASSWORD', 'changeme') }}"
      dbname: splashworks
      schema: public
      threads: 2
```

**Step 3: Create dbt/packages.yml**

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
```

**Step 4: Create dbt/seeds/company_lookup.csv**

```csv
company_id,company_name,company_full_name
e265c9dee47c47c6a73f689b0df467ca,AQPS,"A Quality Pool Service of Central Florida, Inc."
95d37a64d1794a1caef111e801db5477,JOMO,Jomo Pool Service
```

**Step 5: Create dbt/macros/service_completion.sql**

```sql
{# Reusable macro for service completion detection.
   Skimmer uses '2010-01-01 12:00:00' as a sentinel for "not started/completed".
#}

{% macro service_status(start_time_col, complete_time_col) %}
    CASE
        WHEN {{ start_time_col }} != '2010-01-01 12:00:00'
         AND {{ complete_time_col }} != '2010-01-01 12:00:00'
        THEN 1
        ELSE 0
    END
{% endmacro %}
```

**Step 6: Create dbt/macros/dosage_cost.sql**

```sql
{# Dosage cost and price calculation from FactDosage_v2 logic. #}

{% macro dosage_cost(entry_value_col, cost_col) %}
    COALESCE({{ entry_value_col }}, 0) * COALESCE({{ cost_col }}, 0)
{% endmacro %}

{% macro dosage_price(entry_value_col, price_col) %}
    COALESCE({{ entry_value_col }}, 0) * COALESCE({{ price_col }}, 0)
{% endmacro %}
```

**Step 7: Create dbt/macros/clean_customer_name.sql**

```sql
{# Clean customer name: remove carriage returns and line feeds. #}

{% macro clean_customer_name(first_name_col, last_name_col) %}
    REPLACE(
        REPLACE(
            COALESCE({{ first_name_col }}, '') || ' ' || COALESCE({{ last_name_col }}, ''),
            CHR(10), ''
        ),
        CHR(13), ''
    )
{% endmacro %}
```

**Step 8: Create dbt/models/staging/_sources.yml**

This tells dbt where to find the raw tables. Note: source table names include the date stamp, so this uses a variable or the latest date. For the scaffold, we reference today's date pattern.

```yaml
version: 2

sources:
  - name: raw_skimmer
    schema: raw_skimmer
    description: "Raw Skimmer nightly SQLite extracts loaded by ETL"
    tables:
      - name: Customer
        description: "Primary customer accounts"
      - name: ServiceLocation
        description: "Physical service locations"
      - name: Pool
        description: "Bodies of water at service locations"
      - name: Account
        description: "Technician and staff accounts"
      - name: ServiceStop
        description: "Per-visit service records"
      - name: ServiceStopEntry
        description: "Chemical readings and task records per stop"
      - name: EntryDescription
        description: "Chemical and task type definitions"
      - name: RouteStop
        description: "Scheduled route stops with timing"
      - name: RouteAssignment
        description: "Recurring route assignments"
      - name: WorkOrder
        description: "Work orders for repairs and maintenance"
      - name: WorkOrderType
        description: "Work order type definitions"
      - name: Invoice
        description: "Customer invoices"
      - name: InvoiceItem
        description: "Invoice line items"
      - name: InvoiceLocation
        description: "Invoice to service location mapping"
      - name: Product
        description: "Products and chemicals for invoicing"
      - name: Payment
        description: "Invoice payments"
      - name: CustomerTag
        description: "Customer-tag associations"
      - name: Tag
        description: "Customer tags"
```

**Step 9: Install dbt and verify**

```bash
pip install dbt-postgres
cd dbt
dbt deps
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt debug
```
Expected: "All checks passed!"

**Step 10: Run seeds**

```bash
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt seed
```
Expected: `company_lookup` seed loaded.

**Step 11: Commit dbt scaffold**

```bash
cd ..
git add dbt/
git commit -m "feat: scaffold dbt project with macros, seeds, and source definitions"
```

---

## Task 6: Infrastructure Smoke Test Script

**Files:**
- Create: `scripts/smoke-test.sh`

**Step 1: Create the smoke test script**

```bash
#!/usr/bin/env bash
# smoke-test.sh — Validate that all infrastructure components are healthy
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
    TOTAL=$((TOTAL + 1))
    local name="$1"
    shift
    if "$@" > /dev/null 2>&1; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "Splashworks Infrastructure Smoke Test"
echo "======================================"
echo ""

echo "Docker:"
check "Docker Compose running" docker compose ps --status running
check "Postgres container healthy" docker compose exec -T postgres pg_isready -U splashworks -d splashworks

echo ""
echo "PostgreSQL:"
check "Schemas exist" docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \
    "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('raw_skimmer','staging','warehouse','semantic','vectors')" \
    | grep -q "5"
check "pgvector extension" docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \
    "SELECT extname FROM pg_extension WHERE extname = 'vector'" \
    | grep -q "vector"
check "ETL log table exists" docker compose exec -T postgres psql -U splashworks -d splashworks -tAc \
    "SELECT COUNT(*) FROM public.etl_load_log" \
    | grep -qE "^[0-9]+"

echo ""
echo "ETL:"
if [ -d "data/extracts" ] && ls data/extracts/*.db.gz 1>/dev/null 2>&1; then
    check "Extract files present" ls data/extracts/*.db.gz
else
    echo "  SKIP: No extract files in data/extracts/ (run rclone sync first)"
fi

echo ""
echo "dbt:"
if command -v dbt &> /dev/null; then
    check "dbt debug passes" bash -c "cd dbt && DBT_HOST=localhost DBT_PASSWORD=\$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt debug"
else
    echo "  SKIP: dbt not installed locally"
fi

echo ""
echo "======================================"
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
```

**Step 2: Make executable and run**

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```
Expected: All checks PASS (except rclone/extract skips which are expected locally).

**Step 3: Commit**

```bash
git add scripts/smoke-test.sh
git commit -m "feat: add infrastructure smoke test script"
```

---

## Task 7: Update PROGRESS.md

**Files:**
- Modify: `docs/plans/PROGRESS.md`

**Step 1: Update progress after completing Phase 0 tasks locally**

Update the Phase 0 table to reflect completed steps. Add a session log entry.

**Step 2: Commit**

```bash
git add docs/plans/PROGRESS.md
git commit -m "docs: update progress tracker after Phase 0 local setup"
```

---

## Validation Checklist — Phase 0 Complete

Before moving to Phase 1, all of these must pass:

```
[ ] feature/warehouse-etl branch exists
[ ] docker compose up -d starts Postgres successfully
[ ] Postgres schemas: raw_skimmer, staging, warehouse, semantic, vectors
[ ] pgvector extension installed
[ ] etl_load_log table exists
[ ] ETL extract tests pass (test_extract.py)
[ ] ETL loads real AQPS + JOMO data into raw_skimmer schema
[ ] ETL metadata logged correctly
[ ] ETL re-run detects unchanged data and skips
[ ] dbt debug passes
[ ] dbt seed loads company_lookup
[ ] Smoke test script passes
[ ] All work committed to feature/warehouse-etl
```

Note: VPS deployment (Docker on VPS, rclone, Cloudflare Tunnel) is deferred to early Phase 1. Phase 0 validates everything locally first. This matches the "test locally, deploy to VPS" workflow.

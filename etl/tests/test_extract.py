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

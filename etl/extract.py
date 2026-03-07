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

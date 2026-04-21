"""Schema governance primitives.

Scope of this file (hotfix `etl-schema-governance-seed`):
    - compute_source_fingerprint: stable hash of (column_name, column_type, ordinal)
      tuples from a SQLite table. Used by etl/main.py to detect schema drift
      via the checksum mechanism and to populate etl_load_log.schema_fingerprint.

Deferred to ETL-9 (full governance rollout):
    - load_contract(source, table) -> Contract
    - validate(source_fp, contract_fp) -> DriftReport
    - emit_drift_event(conn, drift_report) -> drift_id
    - write_schema_log(conn, run_id, ..., fingerprint, contract_version) -> None

This file is intentionally minimal for the hotfix. The full API is documented in
docs/data-governance/controls/CTRL-01-schema-validation.md and will land in
ETL-9.
"""

import hashlib
import sqlite3
from pathlib import Path


def compute_source_fingerprint(db_path: Path, table_name: str) -> tuple[str, list[dict]]:
    """Compute a stable fingerprint for a SQLite table's schema.

    The fingerprint is derived from (column_name, column_type, ordinal_position)
    tuples. Two SQLite tables with identical column sets but different orderings
    produce different fingerprints — ordering is part of the schema contract.

    Returns (fingerprint_hex, column_list) where:
        fingerprint_hex: 64-char SHA-256 hex digest suitable for string
                         comparison in the ETL checksum.
        column_list:     list of dicts [{name, type, ordinal}, ...] suitable for
                         serializing to JSONB in etl_schema_log.column_list.

    This is a pure function — no DB writes, no network. Safe to call from tests.
    """
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(f'PRAGMA table_info("{table_name}")')
        rows = cursor.fetchall()
    finally:
        conn.close()

    # PRAGMA table_info columns: (cid, name, type, notnull, dflt_value, pk)
    column_list = [
        {"name": r[1], "type": (r[2] or "").upper(), "ordinal": r[0]}
        for r in rows
    ]

    canonical = "|".join(
        f"{c['ordinal']}:{c['name']}:{c['type']}" for c in column_list
    )
    fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return fingerprint, column_list


def compose_checksum(row_count: int, schema_fingerprint: str) -> str:
    """Compose the change-detection checksum used in etl_load_log.

    Format: '<row_count>:<first-12-of-schema-fingerprint>'

    Any change in either the row count or the schema fingerprint produces a
    different checksum, which makes `get_previous_checksum() == current` return
    False, which triggers a rebuild. This closes the silent-skip gap where a
    schema change with an unchanged row count went undetected.
    """
    return f"{row_count}:{schema_fingerprint[:12]}"

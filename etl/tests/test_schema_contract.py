"""Tests for etl.schema_contract — schema fingerprint + checksum composition.

Covers the hotfix scope (etl-schema-governance-seed):
    - compute_source_fingerprint returns a stable hash for identical schemas
    - fingerprint changes on column addition, removal, retype, reorder
    - compose_checksum incorporates both row count AND schema fingerprint

Full CTRL-01 (YAML contract validation, drift classification) lives in ETL-9.
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from etl.schema_contract import compose_checksum, compute_source_fingerprint


@pytest.fixture
def sample_db_v1(tmp_path: Path) -> Path:
    """SQLite DB with a 3-col WorkOrderType table."""
    db = tmp_path / "v1.db"
    conn = sqlite3.connect(str(db))
    conn.execute(
        """
        CREATE TABLE "WorkOrderType" (
            "id"          TEXT PRIMARY KEY,
            "Description" TEXT,
            "Deleted"     BOOLEAN
        )
        """
    )
    conn.commit()
    conn.close()
    return db


@pytest.fixture
def sample_db_v2(tmp_path: Path) -> Path:
    """v1 schema plus one additional column — additive drift target."""
    db = tmp_path / "v2.db"
    conn = sqlite3.connect(str(db))
    conn.execute(
        """
        CREATE TABLE "WorkOrderType" (
            "id"                             TEXT PRIMARY KEY,
            "Description"                    TEXT,
            "Deleted"                        BOOLEAN,
            "SetCustomerActiveWhenScheduled" BOOLEAN
        )
        """
    )
    conn.commit()
    conn.close()
    return db


@pytest.fixture
def sample_db_v1_reordered(tmp_path: Path) -> Path:
    """Same columns as v1 but different declaration order."""
    db = tmp_path / "v1_reordered.db"
    conn = sqlite3.connect(str(db))
    conn.execute(
        """
        CREATE TABLE "WorkOrderType" (
            "Deleted"     BOOLEAN,
            "id"          TEXT PRIMARY KEY,
            "Description" TEXT
        )
        """
    )
    conn.commit()
    conn.close()
    return db


@pytest.fixture
def sample_db_v1_retyped(tmp_path: Path) -> Path:
    """v1 column set with Description changed from TEXT to INTEGER — type drift."""
    db = tmp_path / "v1_retyped.db"
    conn = sqlite3.connect(str(db))
    conn.execute(
        """
        CREATE TABLE "WorkOrderType" (
            "id"          TEXT PRIMARY KEY,
            "Description" INTEGER,
            "Deleted"     BOOLEAN
        )
        """
    )
    conn.commit()
    conn.close()
    return db


class TestComputeSourceFingerprint:
    def test_returns_64_char_hex(self, sample_db_v1: Path):
        fp, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        assert len(fp) == 64
        assert all(c in "0123456789abcdef" for c in fp)

    def test_stable_across_calls(self, sample_db_v1: Path):
        fp1, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        fp2, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        assert fp1 == fp2

    def test_identical_schemas_match(self, tmp_path: Path, sample_db_v1: Path):
        # Build a second DB with the same schema
        db2 = tmp_path / "v1_copy.db"
        conn = sqlite3.connect(str(db2))
        conn.execute(
            """
            CREATE TABLE "WorkOrderType" (
                "id"          TEXT PRIMARY KEY,
                "Description" TEXT,
                "Deleted"     BOOLEAN
            )
            """
        )
        conn.commit()
        conn.close()
        fp_a, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        fp_b, _ = compute_source_fingerprint(db2, "WorkOrderType")
        assert fp_a == fp_b

    def test_additive_drift_changes_fingerprint(
        self, sample_db_v1: Path, sample_db_v2: Path
    ):
        fp_v1, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        fp_v2, _ = compute_source_fingerprint(sample_db_v2, "WorkOrderType")
        assert fp_v1 != fp_v2, "Adding a column must change the fingerprint"

    def test_reordering_changes_fingerprint(
        self, sample_db_v1: Path, sample_db_v1_reordered: Path
    ):
        fp_a, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        fp_b, _ = compute_source_fingerprint(sample_db_v1_reordered, "WorkOrderType")
        assert fp_a != fp_b, "Column reordering must change the fingerprint"

    def test_retyping_changes_fingerprint(
        self, sample_db_v1: Path, sample_db_v1_retyped: Path
    ):
        fp_a, _ = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        fp_b, _ = compute_source_fingerprint(sample_db_v1_retyped, "WorkOrderType")
        assert fp_a != fp_b, "Type change must change the fingerprint"

    def test_column_list_shape(self, sample_db_v1: Path):
        _, cols = compute_source_fingerprint(sample_db_v1, "WorkOrderType")
        assert len(cols) == 3
        # Schema contract invariants
        for c in cols:
            assert set(c.keys()) == {"name", "type", "ordinal"}
        # Ordinal starts at 0 and is contiguous
        assert [c["ordinal"] for c in cols] == [0, 1, 2]
        # Types are uppercased
        names = [c["name"] for c in cols]
        assert names == ["id", "Description", "Deleted"]
        # Type normalization (SQLite BOOLEAN stays uppercase)
        assert cols[2]["type"] == "BOOLEAN"


class TestComposeChecksum:
    def test_format(self):
        ck = compose_checksum(84, "a1b2c3d4e5f6" + "0" * 52)
        assert ck == "84:a1b2c3d4e5f6"

    def test_different_row_count_differs(self):
        fp = "0" * 64
        assert compose_checksum(84, fp) != compose_checksum(85, fp)

    def test_different_fingerprint_differs(self):
        fp1 = "a" * 64
        fp2 = "b" * 64
        assert compose_checksum(84, fp1) != compose_checksum(84, fp2)

    def test_same_row_count_different_schema_differs(self):
        # The scenario the hotfix fixes: row count unchanged, schema changed.
        # Old behavior: `f"{row_count}"` produced identical checksums → skip.
        # New behavior: schema fingerprint is part of the checksum → differ.
        fp_before = "f" * 12 + "0" * 52
        fp_after  = "e" * 12 + "0" * 52
        ck_before = compose_checksum(84, fp_before)
        ck_after  = compose_checksum(84, fp_after)
        assert ck_before != ck_after

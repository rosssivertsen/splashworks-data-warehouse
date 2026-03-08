from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def _mock_cursor_with_rows(rows):
    """Create a mock connection whose cursor returns the given rows."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn


@patch("api.routers.schema.psycopg2.connect")
def test_schema_returns_tables(mock_connect):
    """GET /api/schema returns structured table/column metadata."""
    mock_connect.return_value = _mock_cursor_with_rows([
        ("public_warehouse", "dim_customer", "customer_id", "text", "NO", 1),
        ("public_warehouse", "dim_customer", "first_name", "text", "YES", 2),
        ("public_semantic", "service_completion", "company_id", "text", "NO", 1),
    ])

    resp = client.get("/api/schema")
    assert resp.status_code == 200

    data = resp.json()
    assert data["layer"] == "warehouse"
    assert len(data["tables"]) == 2

    # Check first table
    t0 = data["tables"][0]
    assert t0["schema_name"] == "public_warehouse"
    assert t0["table_name"] == "dim_customer"
    assert len(t0["columns"]) == 2
    assert t0["columns"][0]["column_name"] == "customer_id"
    assert t0["columns"][0]["data_type"] == "text"
    assert t0["columns"][0]["is_nullable"] is False
    assert t0["columns"][0]["ordinal_position"] == 1


@patch("api.routers.schema.psycopg2.connect")
def test_schema_with_staging_layer(mock_connect):
    """GET /api/schema?layer=staging queries staging schemas."""
    mock_connect.return_value = _mock_cursor_with_rows([
        ("public_staging", "stg_customer", "customer_id", "text", "NO", 1),
    ])

    resp = client.get("/api/schema?layer=staging")
    assert resp.status_code == 200

    data = resp.json()
    assert data["layer"] == "staging"
    assert len(data["tables"]) == 1
    assert data["tables"][0]["schema_name"] == "public_staging"


def test_schema_invalid_layer():
    """GET /api/schema?layer=invalid returns 422."""
    resp = client.get("/api/schema?layer=invalid")
    assert resp.status_code == 422

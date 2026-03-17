from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _mock_audit(monkeypatch):
    monkeypatch.setattr("api.routers.query.log_query_audit", lambda **kwargs: None)

MOCK_COLUMNS = ["id", "name"]
MOCK_ROWS = [[1, "Alice"], [2, "Bob"]]


@patch("api.routers.query.execute_query", return_value=(MOCK_COLUMNS, MOCK_ROWS))
def test_raw_query_valid_select(mock_exec):
    resp = client.post("/api/query/raw", json={"sql": "SELECT * FROM warehouse.dim_customer"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sql"] == "SELECT * FROM warehouse.dim_customer"
    assert body["columns"] == MOCK_COLUMNS
    assert body["results"] == MOCK_ROWS
    assert body["row_count"] == 2
    assert body["explanation"] == "User-provided SQL query"
    mock_exec.assert_called_once_with("SELECT * FROM warehouse.dim_customer")


def test_raw_query_rejects_drop():
    resp = client.post("/api/query/raw", json={"sql": "DROP TABLE warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_insert():
    resp = client.post("/api/query/raw", json={"sql": "INSERT INTO warehouse.dim_customer VALUES (1)"})
    assert resp.status_code == 400


def test_raw_query_rejects_delete():
    resp = client.post("/api/query/raw", json={"sql": "DELETE FROM warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_update():
    resp = client.post("/api/query/raw", json={"sql": "UPDATE warehouse.dim_customer SET name = 'x'"})
    assert resp.status_code == 400


def test_raw_query_rejects_multi_statement():
    resp = client.post("/api/query/raw", json={"sql": "SELECT 1; DROP TABLE warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_empty():
    resp = client.post("/api/query/raw", json={"sql": ""})
    assert resp.status_code == 422


@patch("api.routers.query.execute_query", return_value=(MOCK_COLUMNS, MOCK_ROWS))
def test_raw_query_accepts_cte(mock_exec):
    sql = "WITH cte AS (SELECT id, name FROM warehouse.dim_customer) SELECT * FROM cte"
    resp = client.post("/api/query/raw", json={"sql": sql})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sql"] == sql
    mock_exec.assert_called_once_with(sql)

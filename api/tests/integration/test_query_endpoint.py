import os

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_query_happy_path(client):
    """Full pipeline: question → SQL → results."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")

    resp = await client.post("/api/query", json={
        "question": "How many active customers does each company have?",
        "layer": "warehouse",
    })
    assert resp.status_code == 200
    body = resp.json()

    assert "sql" in body
    assert "SELECT" in body["sql"].upper()
    assert len(body["columns"]) > 0
    assert body["row_count"] > 0
    assert len(body["results"]) == body["row_count"]


@pytest.mark.asyncio
async def test_query_staging_layer(client):
    """Same question against staging layer for diagnostic comparison."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")

    resp = await client.post("/api/query", json={
        "question": "How many active customers does each company have?",
        "layer": "staging",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["row_count"] > 0


@pytest.mark.asyncio
async def test_query_empty_question(client):
    """Empty question should return 422 (validation error)."""
    resp = await client.post("/api/query", json={
        "question": "",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_query_invalid_layer(client):
    """Invalid layer should return 422."""
    resp = await client.post("/api/query", json={
        "question": "How many customers?",
        "layer": "invalid",
    })
    assert resp.status_code == 422

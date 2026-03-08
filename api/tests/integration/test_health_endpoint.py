import pytest
from httpx import AsyncClient, ASGITransport

from api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("healthy", "unhealthy")
    assert "postgres" in body
    assert "schemas" in body


@pytest.mark.asyncio
async def test_health_shows_etl_data(client):
    resp = await client.get("/api/health")
    body = resp.json()
    if body["status"] == "healthy":
        assert body["last_etl_date"] is not None
        assert body["last_etl_rows"] > 0
        assert "raw_skimmer" in body["schemas"]

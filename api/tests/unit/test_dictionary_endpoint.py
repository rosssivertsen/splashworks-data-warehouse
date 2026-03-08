from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

SAMPLE_SEMANTIC_LAYER = {
    "business_terms": {
        "chlorine_usage": {
            "description": "Total amount of chlorine chemicals added to pools",
            "synonyms": ["chlorine dosage", "chlorine added"],
        },
    },
    "relationships": {
        "customer_to_chemical_usage": {
            "description": "Complete path from customer to chemical dosages",
        },
        "active_customers": {
            "description": "Customers currently receiving service",
        },
    },
    "verified_queries": [
        {
            "question": "What is the average pool size?",
            "sql_query": "SELECT AVG(Gallons) FROM Pool;",
        },
    ],
}


@patch("api.routers.schema.load_semantic_layer", return_value=SAMPLE_SEMANTIC_LAYER)
def test_dictionary_returns_business_terms(mock_sl):
    """GET /api/schema/dictionary returns parsed business terms."""
    resp = client.get("/api/schema/dictionary")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data["business_terms"]) == 1
    bt = data["business_terms"][0]
    assert bt["term"] == "chlorine_usage"
    assert "chlorine" in bt["description"].lower()
    assert "chlorine dosage" in bt["synonyms"]


@patch("api.routers.schema.load_semantic_layer", return_value={})
def test_dictionary_handles_missing_yaml(mock_sl):
    """GET /api/schema/dictionary with empty dict returns empty lists."""
    resp = client.get("/api/schema/dictionary")
    assert resp.status_code == 200

    data = resp.json()
    assert data["business_terms"] == []
    assert data["relationships"] == []
    assert data["verified_queries"] == []


@patch("api.routers.schema.load_semantic_layer", return_value=SAMPLE_SEMANTIC_LAYER)
def test_dictionary_includes_verified_queries(mock_sl):
    """GET /api/schema/dictionary includes verified queries with SQL."""
    resp = client.get("/api/schema/dictionary")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data["verified_queries"]) == 1
    vq = data["verified_queries"][0]
    assert vq["question"] == "What is the average pool size?"
    assert "SELECT" in vq["sql"]

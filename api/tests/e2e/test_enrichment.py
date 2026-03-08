"""
E2E Enrichment Tests: Validate New Warehouse Models Through Full Stack

WHY THIS TEST EXISTS:
    The semantic enrichment batch added 4 new models:
    - dim_pool (gallons, pool type)
    - fact_service_stop (visit duration, completion)
    - fact_payment (payment tracking)
    - semantic_profit (customer profitability)

    These tests prove each model is queryable through the API and
    that the AI can now answer questions that previously failed.

SKIP BEHAVIOR:
    All tests skip gracefully if the live API is not reachable.
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")


def requires_live_api() -> bool:
    """Return True if the API is reachable and healthy."""
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        return resp.status_code == 200
    except requests.ConnectionError:
        return False
    except Exception:
        return False


@pytest.mark.skipif(not requires_live_api(), reason="Live API not available")
class TestEnrichmentModels:
    """E2E tests validating semantic enrichment models through the API."""

    def test_dim_pool_has_data(self):
        """Verify dim_pool contains pool data for both companies."""
        sql = """
            SELECT _company_name, COUNT(*) AS pool_count
            FROM public_warehouse.dim_pool
            GROUP BY _company_name
            ORDER BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "dim_pool is empty"

    def test_dim_pool_gallons_query(self):
        """Query pools with gallons > 10000 — this previously failed."""
        sql = """
            SELECT c.clean_customer_name, p._company_name, p.pool_name, p.gallons
            FROM public_warehouse.dim_pool p
            JOIN public_warehouse.dim_customer c
                ON p.customer_id = c.customer_id AND p._company_name = c._company_name
            WHERE p.gallons > 10000 AND c.is_inactive = 0
            ORDER BY p.gallons DESC
            LIMIT 10
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] > 0, "No pools > 10000 gallons found"

    def test_fact_service_stop_has_data(self):
        """Verify fact_service_stop contains service visit data."""
        sql = """
            SELECT _company_name,
                   COUNT(*) AS total,
                   SUM(service_status) AS completed,
                   AVG(minutes_at_stop) AS avg_minutes
            FROM public_warehouse.fact_service_stop
            GROUP BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "fact_service_stop is empty"

    def test_fact_payment_has_data(self):
        """Verify fact_payment contains payment data with expected methods."""
        sql = """
            SELECT _company_name, payment_method, COUNT(*) AS cnt
            FROM public_warehouse.fact_payment
            GROUP BY _company_name, payment_method
            ORDER BY cnt DESC
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "fact_payment is empty"

        # Card should be the most common payment method
        method_col = body["columns"].index("payment_method")
        first_method = body["results"][0][method_col]
        assert first_method == "Card", (
            f"Expected Card as most common payment method, got {first_method}"
        )

    def test_semantic_profit_has_data(self):
        """Verify semantic_profit contains profitability data."""
        sql = """
            SELECT _company_name, COUNT(*) AS rows, AVG(profit) AS avg_profit
            FROM public_semantic.semantic_profit
            GROUP BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "semantic_profit is empty"

    def test_semantic_profit_formula(self):
        """Verify profit = service_rate - total_cost in semantic_profit."""
        sql = """
            SELECT customer_name, service_rate, total_cost, profit,
                   ABS(profit - (service_rate - total_cost)) AS formula_diff
            FROM public_semantic.semantic_profit
            WHERE service_rate > 0
            LIMIT 10
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] > 0

        # formula_diff should be 0 (or very close due to floating point)
        diff_col = body["columns"].index("formula_diff")
        for row in body["results"]:
            assert row[diff_col] < 0.01, (
                f"Profit formula mismatch: diff={row[diff_col]}"
            )

    def test_nl_pools_query(self):
        """Ask the AI about pools > 10000 gallons — this originally failed.

        WHY: This is the capstone — the exact question that prompted
        the semantic enrichment batch. If this works, the enrichment succeeded.
        """
        resp = requests.post(
            f"{BASE_URL}/api/query",
            json={
                "question": "Show me customers with pools larger than 10000 gallons",
                "layer": "warehouse",
            },
            timeout=30,
        )
        assert resp.status_code == 200

        body = resp.json()
        assert "sql" in body
        assert "SELECT" in body["sql"].upper()

        # The AI should reference dim_pool or the warehouse schema
        sql_upper = body["sql"].upper()
        uses_correct_schema = (
            "PUBLIC_WAREHOUSE" in sql_upper or "DIM_POOL" in sql_upper
        )
        assert uses_correct_schema, (
            f"Expected SQL to reference warehouse schema or dim_pool. SQL: {body['sql']}"
        )

        assert body["row_count"] > 0, (
            f"Expected results for pools > 10000 gallons. SQL: {body['sql']}"
        )

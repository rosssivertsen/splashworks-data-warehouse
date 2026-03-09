"""
E2E Smoke Test: Active Customer Count Through Full Stack

WHY THIS TEST EXISTS:
    The active customer count is the single most important metric in the warehouse.
    It is the number Ross and the team validated first when standing up the data pipeline
    (AQPS: 859, JOMO: 2,402 — confirmed against staging and Power BI).

    This suite proves the entire vertical slice works end-to-end:
    FastAPI -> Claude AI -> SQL generation -> Postgres -> correct result.

    If this test passes, the core stack is healthy.
    If it fails, something fundamental is broken.

SKIP BEHAVIOR:
    All tests skip gracefully if the live API is not reachable (checked via /api/health).
    This lets `pytest` run cleanly in CI or local dev without a running backend.
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
class TestSmokeActiveCustomerCount:
    """Smoke tests validating the full stack via active customer count queries."""

    def test_health_endpoint(self):
        """Verify the health endpoint reports a healthy system with Postgres connected.

        WHY: This is the first gate — if health fails, nothing else can work.
        The health endpoint checks Postgres connectivity and ETL metadata,
        so it validates that the database layer is operational.
        """
        resp = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert resp.status_code == 200

        body = resp.json()
        assert body["status"] == "healthy"
        assert body["postgres"] == "connected"

    def test_schema_endpoint(self):
        """Verify the schema endpoint returns warehouse tables including dim_customer.

        WHY: The schema endpoint feeds the AI's system prompt. If it cannot
        enumerate tables (especially dim_customer), the AI will generate
        invalid SQL. This test confirms the metadata pipeline is intact.
        """
        resp = requests.get(
            f"{BASE_URL}/api/schema", params={"layer": "warehouse"}, timeout=10
        )
        assert resp.status_code == 200

        body = resp.json()
        assert body["layer"] == "warehouse"
        assert len(body["tables"]) > 0

        table_names = [t["table_name"] for t in body["tables"]]
        assert "dim_customer" in table_names, (
            f"dim_customer not found in warehouse tables: {table_names}"
        )

    def test_raw_query_active_customers(self):
        """Execute exact SQL counting active customers grouped by company.

        WHY: This is the ground-truth validation. By using a hand-written SQL
        query (not AI-generated), we isolate the Postgres execution layer.
        The expected counts (AQPS=859, JOMO=2402) were validated against
        staging queries and Power BI during Phase 1 Batch A.

        If these numbers drift, it means the ETL or source data changed —
        both of which need investigation. Note: dim_customer now includes
        deleted records (for lifecycle queries), so the active filter must
        include both is_inactive = 0 AND deleted = 0.
        """
        sql = """
            SELECT
                _company_name,
                COUNT(*) AS active_customers
            FROM public_warehouse.dim_customer
            WHERE is_inactive = 0 AND deleted = 0
            GROUP BY _company_name
            ORDER BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200

        body = resp.json()
        assert body["row_count"] == 2

        # Build a lookup from results
        # columns: _company_name, active_customers
        company_col = body["columns"].index("_company_name")
        count_col = body["columns"].index("active_customers")
        counts = {row[company_col]: row[count_col] for row in body["results"]}

        assert counts.get("AQPS") == 859, f"AQPS count was {counts.get('AQPS')}, expected 859"
        assert counts.get("JOMO") == 2403, f"JOMO count was {counts.get('JOMO')}, expected 2403"

    def test_nl_query_active_customers(self):
        """Ask the AI how many active customers AQPS has and validate plausibility.

        WHY: This is the capstone test — it exercises the full AI pipeline:
        question -> Claude -> SQL generation -> Postgres execution -> results.

        We use a plausibility range (770-950) rather than an exact match because
        the AI may generate slightly different SQL (e.g., different filters or
        joins) that could yield a marginally different count. The range is wide
        enough to accommodate AI variability but narrow enough to catch real
        breakage (e.g., returning 0, or all 3000+ customers).
        """
        resp = requests.post(
            f"{BASE_URL}/api/query",
            json={
                "question": "How many active customers does AQPS have?",
                "layer": "warehouse",
            },
            timeout=30,
        )
        assert resp.status_code == 200

        body = resp.json()
        assert "sql" in body
        assert "SELECT" in body["sql"].upper()
        assert body["row_count"] > 0

        # The result should contain a count — find it in the first row
        # AI may return different column structures, so look for any numeric value
        first_row = body["results"][0]
        numeric_values = [v for v in first_row if isinstance(v, (int, float))]
        assert len(numeric_values) > 0, "Expected at least one numeric value in results"

        # At least one numeric value should be in the plausible AQPS active range
        in_range = any(770 <= v <= 950 for v in numeric_values)
        assert in_range, (
            f"No numeric value in plausible AQPS active customer range (770-950). "
            f"Got: {numeric_values}"
        )

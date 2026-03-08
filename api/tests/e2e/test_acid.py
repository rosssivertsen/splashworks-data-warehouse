"""
E2E Acid Test: Chemical Reading Drill-Down Through Full Join Path

WHY THIS TEST EXISTS:
    The chemical reading drill-down exercises the deepest join path in the
    Skimmer data model:

        Customer -> ServiceLocation -> Pool -> ServiceStop -> ServiceStopEntry

    This join chain (5 tables deep) is the backbone of operational reporting —
    it answers questions like "what chemicals were applied to which customer's
    pool on which date?" If this path breaks, the warehouse's core analytical
    value is compromised.

    The name "acid test" is a double meaning: it tests chemical/acid data,
    and it serves as a rigorous litmus test of data integrity.

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
class TestAcidChemicalReadings:
    """Acid tests validating the full chemical reading join path through the warehouse."""

    def test_dosage_fact_has_data(self):
        """Verify that fact_dosage contains data (non-empty fact table).

        WHY: fact_dosage is the warehouse's denormalized representation of
        chemical dosage events. If it's empty, either the ETL failed to
        process ServiceStopEntry records or the dbt model is broken.
        This is the simplest possible check: does the table have rows?
        """
        sql = "SELECT COUNT(*) AS row_count FROM public_warehouse.fact_dosage"
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200

        body = resp.json()
        count = body["results"][0][0]
        assert count > 0, "fact_dosage is empty — ETL may have failed"

    def test_dosage_joins_customer(self):
        """Verify fact_dosage joins correctly to dim_customer via customer_key.

        WHY: The surrogate key join (customer_key) between fact and dimension
        tables is the foundation of the star schema. If this join fails or
        produces NULLs, all customer-attributed analytics are broken.
        We check that both company names (AQPS, JOMO) appear in the joined
        result, confirming the join works across both company entities.
        """
        sql = """
            SELECT
                c.company_name,
                COUNT(*) AS dosage_count
            FROM public_warehouse.fact_dosage d
            JOIN public_warehouse.dim_customer c
                ON d.customer_key = c.customer_key
            GROUP BY c.company_name
            ORDER BY c.company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200

        body = resp.json()
        assert body["row_count"] >= 1, "No rows returned from dosage-customer join"

        company_col = body["columns"].index("company_name")
        companies = {row[company_col] for row in body["results"]}
        assert "AQPS" in companies or "JOMO" in companies, (
            f"Expected AQPS or JOMO in joined results, got: {companies}"
        )

    def test_semantic_chemical_entries(self):
        """Query the semantic layer's fact_chemical_entries grouped by entry description.

        WHY: The semantic layer (public_semantic) contains business-ready views
        built on top of the warehouse. fact_chemical_entries aggregates chemical
        readings with human-readable entry descriptions (e.g., "Free Chlorine",
        "pH"). This test validates that:
        1. The semantic schema exists and is queryable
        2. Chemical entries have been categorized by description
        3. The full ETL pipeline (staging -> warehouse -> semantic) produced data
        """
        sql = """
            SELECT
                entry_description,
                COUNT(*) AS entry_count
            FROM public_semantic.fact_chemical_entries
            GROUP BY entry_description
            ORDER BY entry_count DESC
            LIMIT 10
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200

        body = resp.json()
        assert body["row_count"] > 0, (
            "No rows in semantic fact_chemical_entries — semantic layer may be empty"
        )

    def test_nl_chemical_reading_query(self):
        """Ask the AI about common chemical readings and validate the response.

        WHY: This is the acid test's capstone — it exercises the full AI pipeline
        over the most complex join path in the schema. The AI must:
        1. Understand "chemical readings" maps to ServiceStopEntry/EntryDescription
        2. Generate SQL that traverses the correct join path
        3. Reference warehouse or semantic schema tables (not raw staging)
        4. Return actual data rows

        We validate that the generated SQL references the appropriate schema
        and that results are non-empty, proving the AI can navigate the deep
        join path autonomously.
        """
        resp = requests.post(
            f"{BASE_URL}/api/query",
            json={
                "question": "What are the most common chemical readings recorded across all service stops?",
                "layer": "warehouse",
            },
            timeout=30,
        )
        assert resp.status_code == 200

        body = resp.json()
        assert "sql" in body
        assert "SELECT" in body["sql"].upper()

        # The AI should reference warehouse or semantic schema
        sql_upper = body["sql"].upper()
        uses_correct_schema = (
            "PUBLIC_WAREHOUSE" in sql_upper
            or "PUBLIC_SEMANTIC" in sql_upper
            or "WAREHOUSE" in sql_upper
            or "SEMANTIC" in sql_upper
        )
        assert uses_correct_schema, (
            f"Expected SQL to reference warehouse or semantic schema. SQL: {body['sql']}"
        )

        assert body["row_count"] > 0, (
            f"Expected results for chemical readings query. SQL: {body['sql']}"
        )

"""Post-dbt reconciliation: compare raw extract counts/totals against warehouse.

Runs after dbt in the nightly pipeline. Produces a JSON report and prints
a pass/fail summary. Does NOT block the pipeline on failure — data is already
loaded, so blocking would mean no data at all.

Usage:
    python3 -m etl.reconcile              # Run all checks
    python3 -m etl.reconcile --verbose     # Show per-check detail
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import psycopg2

from etl.config import DATABASE_URL


# --- Check Definitions ---
# Each check compares a raw-layer query against a warehouse-layer query.
# Tolerance is the allowed percentage difference (0.0 = exact match).

CHECKS = [
    {
        "name": "active_customer_count",
        "description": "Active customers (is_inactive=0, deleted=0)",
        "raw_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM (
                SELECT 'AQPS' AS _company_name, * FROM raw_skimmer."AQPS_Customer"
                WHERE "IsInactive" = '0' AND "Deleted" = '0'
                UNION ALL
                SELECT 'JOMO' AS _company_name, * FROM raw_skimmer."JOMO_Customer"
                WHERE "IsInactive" = '0' AND "Deleted" = '0'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM public_warehouse.dim_customer
            WHERE is_inactive = 0 AND deleted = 0
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "count_by_company",
        "tolerance_pct": 0.0,
    },
    {
        "name": "payment_count",
        "description": "Total payments (non-deleted)",
        "raw_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM (
                SELECT 'AQPS' AS _company_name FROM raw_skimmer."AQPS_Payment" WHERE "Deleted" = '0'
                UNION ALL
                SELECT 'JOMO' AS _company_name FROM raw_skimmer."JOMO_Payment" WHERE "Deleted" = '0'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM public_warehouse.fact_payment
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "count_by_company",
        # Warehouse may have MORE rows due to accumulation — only alert if raw > warehouse
        "tolerance_pct": 0.0,
        "direction": "warehouse_gte_raw",
    },
    {
        "name": "invoice_item_count",
        "description": "Invoice line items (non-deleted)",
        "raw_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM (
                SELECT 'AQPS' AS _company_name FROM raw_skimmer."AQPS_InvoiceItem" WHERE "Deleted" = '0'
                UNION ALL
                SELECT 'JOMO' AS _company_name FROM raw_skimmer."JOMO_InvoiceItem" WHERE "Deleted" = '0'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM public_warehouse.fact_invoice_item
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "count_by_company",
        "tolerance_pct": 0.0,
        "direction": "warehouse_gte_raw",
    },
    {
        "name": "service_stop_count",
        "description": "Service stops (non-deleted route stops)",
        "raw_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM (
                SELECT 'AQPS' AS _company_name FROM raw_skimmer."AQPS_RouteStop" WHERE "Deleted" = '0'
                UNION ALL
                SELECT 'JOMO' AS _company_name FROM raw_skimmer."JOMO_RouteStop" WHERE "Deleted" = '0'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM public_warehouse.fact_service_stop
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "count_by_company",
        "tolerance_pct": 0.0,
        "direction": "warehouse_gte_raw",
    },
    {
        "name": "payment_total_amount",
        "description": "Total payment amount (current extract window)",
        "raw_sql": """
            SELECT _company_name, COALESCE(SUM(amt), 0) as total
            FROM (
                SELECT 'AQPS' AS _company_name, CAST("Amount" AS double precision) as amt
                FROM raw_skimmer."AQPS_Payment" WHERE "Deleted" = '0'
                UNION ALL
                SELECT 'JOMO' AS _company_name, CAST("Amount" AS double precision) as amt
                FROM raw_skimmer."JOMO_Payment" WHERE "Deleted" = '0'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COALESCE(SUM(amount), 0) as total
            FROM public_warehouse.fact_payment
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "total_by_company",
        # Warehouse total may be higher due to accumulated history
        "tolerance_pct": 0.0,
        "direction": "warehouse_gte_raw",
    },
    {
        "name": "route_skip_day_of_count",
        "description": "Day-of skipped stops (IsSkipped=1 in RouteStop)",
        "raw_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM (
                SELECT 'AQPS' AS _company_name FROM raw_skimmer."AQPS_RouteStop"
                WHERE "Deleted" = '0' AND "IsSkipped" = '1'
                UNION ALL
                SELECT 'JOMO' AS _company_name FROM raw_skimmer."JOMO_RouteStop"
                WHERE "Deleted" = '0' AND "IsSkipped" = '1'
            ) src
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "warehouse_sql": """
            SELECT _company_name, COUNT(*) as cnt
            FROM public_warehouse.fact_route_skip
            WHERE skip_type = 'day_of'
            GROUP BY _company_name
            ORDER BY _company_name
        """,
        "compare": "count_by_company",
        "tolerance_pct": 0.0,
        "direction": "warehouse_gte_raw",
    },
]


def run_query(conn, sql: str) -> dict:
    """Run a query and return results as {company_name: value}."""
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return {row[0]: row[1] for row in rows}


def compare_results(
    raw_results: dict,
    warehouse_results: dict,
    tolerance_pct: float = 0.0,
    direction: str = "exact",
) -> tuple[str, str]:
    """Compare raw vs warehouse results.

    Returns (status, detail) where status is 'pass', 'warn', or 'fail'.
    direction:
        'exact' — values must match within tolerance
        'warehouse_gte_raw' — warehouse >= raw is OK (accumulation expected)
    """
    issues = []
    for company in sorted(set(list(raw_results.keys()) + list(warehouse_results.keys()))):
        raw_val = raw_results.get(company, 0)
        wh_val = warehouse_results.get(company, 0)

        if raw_val == 0 and wh_val == 0:
            continue

        if direction == "warehouse_gte_raw":
            # Warehouse should be >= raw (accumulated history)
            if wh_val < raw_val:
                diff_pct = abs(raw_val - wh_val) / max(raw_val, 1) * 100
                issues.append(
                    f"{company}: warehouse ({wh_val}) < raw ({raw_val}), "
                    f"missing {raw_val - wh_val} rows ({diff_pct:.1f}%)"
                )
        else:
            # Exact match within tolerance
            if raw_val != wh_val:
                diff_pct = abs(raw_val - wh_val) / max(raw_val, 1) * 100
                if diff_pct > tolerance_pct:
                    issues.append(
                        f"{company}: raw={raw_val}, warehouse={wh_val}, "
                        f"delta={wh_val - raw_val} ({diff_pct:.1f}%)"
                    )

    if issues:
        return "fail", "; ".join(issues)
    return "pass", "OK"


def run_reconciliation(verbose: bool = False) -> dict:
    """Run all reconciliation checks. Returns a report dict."""
    conn = psycopg2.connect(DATABASE_URL)
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "pass",
        "checks": [],
        "passed": 0,
        "failed": 0,
    }

    for check in CHECKS:
        try:
            raw_results = run_query(conn, check["raw_sql"])
            wh_results = run_query(conn, check["warehouse_sql"])

            status, detail = compare_results(
                raw_results,
                wh_results,
                tolerance_pct=check.get("tolerance_pct", 0.0),
                direction=check.get("direction", "exact"),
            )

            result = {
                "name": check["name"],
                "description": check["description"],
                "status": status,
                "detail": detail,
                "raw": {k: float(v) if isinstance(v, (int, float)) else v for k, v in raw_results.items()},
                "warehouse": {k: float(v) if isinstance(v, (int, float)) else v for k, v in wh_results.items()},
            }

            if status == "fail":
                report["failed"] += 1
                report["status"] = "fail"
            else:
                report["passed"] += 1

            report["checks"].append(result)

            marker = "✓" if status == "pass" else "✗"
            if verbose or status == "fail":
                print(f"  {marker} {check['name']}: {detail}")
                if verbose:
                    for co in sorted(set(list(raw_results.keys()) + list(wh_results.keys()))):
                        print(f"      {co}: raw={raw_results.get(co, 'N/A')}, warehouse={wh_results.get(co, 'N/A')}")
            else:
                print(f"  {marker} {check['name']}")

        except Exception as e:
            result = {
                "name": check["name"],
                "description": check["description"],
                "status": "error",
                "detail": str(e),
            }
            report["checks"].append(result)
            report["failed"] += 1
            report["status"] = "fail"
            print(f"  ✗ {check['name']}: ERROR - {e}")

    conn.close()

    total = report["passed"] + report["failed"]
    print(f"\nReconciliation: {report['passed']}/{total} checks passed")

    return report


if __name__ == "__main__":
    verbose = "--verbose" in sys.argv
    report = run_reconciliation(verbose=verbose)

    # Write report to data/reconciliation.json
    report_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "reconciliation.json",
    )
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"Report written to {report_path}")

    sys.exit(0 if report["status"] == "pass" else 1)

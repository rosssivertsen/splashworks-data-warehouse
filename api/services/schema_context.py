from datetime import date, timedelta
from pathlib import Path

import yaml

SEMANTIC_LAYER_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "skimmer-semantic-layer.yaml"

LAYER_SCHEMAS = {
    "warehouse": ["public_warehouse", "public_semantic", "public_staging"],
    "staging": ["public_staging"],
}


def load_semantic_layer() -> dict:
    """Load the semantic layer YAML file."""
    if not SEMANTIC_LAYER_PATH.exists():
        return {}
    with open(SEMANTIC_LAYER_PATH) as f:
        return yaml.safe_load(f) or {}


def get_schema_metadata(conn, layer: str = "warehouse") -> dict[str, dict[str, list[str]]]:
    """Query Postgres information_schema for table/column metadata.

    Returns: {schema_name: {table_name: [col1, col2, ...]}}
    """
    schemas = LAYER_SCHEMAS.get(layer, LAYER_SCHEMAS["warehouse"])
    placeholders = ",".join(["%s"] * len(schemas))

    cur = conn.cursor()
    cur.execute(f"""
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema IN ({placeholders})
        ORDER BY table_schema, table_name, ordinal_position
    """, schemas)

    result: dict[str, dict[str, list[str]]] = {}
    for schema, table, column in cur.fetchall():
        result.setdefault(schema, {}).setdefault(table, []).append(column)
    cur.close()
    return result


def build_system_prompt(schema: dict[str, dict[str, list[str]]], layer: str = "warehouse") -> str:
    """Build the system prompt for Claude with schema + semantic context."""
    lines = [
        "You are a SQL query generator for a pool service data warehouse (PostgreSQL).",
        "Generate ONLY a SELECT query. Do not include any explanation before or after the SQL.",
        "Wrap the SQL in ```sql and ``` markers.",
        "",
        f"You are querying the {'warehouse and semantic' if layer == 'warehouse' else 'staging'} layer.",
        "",
        "## Available Tables and Columns",
        "",
    ]

    for schema_name, tables in schema.items():
        for table_name, columns in tables.items():
            fq = f'{schema_name}.{table_name}'
            cols = ", ".join(columns)
            lines.append(f"- **{fq}**: {cols}")

    # Add semantic layer context (only for warehouse layer)
    sl = load_semantic_layer() if layer == "warehouse" else {}
    if sl:
        lines.append("")
        lines.append("## Business Context")
        lines.append("")

        if "business_terms" in sl:
            for term, info in sl["business_terms"].items():
                desc = info.get("description", "")
                lines.append(f"- **{term}**: {desc}")

        if "relationships" in sl:
            lines.append("")
            lines.append("## Key Relationships")
            lines.append("")
            for rel_name, info in sl["relationships"].items():
                desc = info.get("description", "")
                lines.append(f"- **{rel_name}**: {desc}")
                join = info.get("join", "")
                if join:
                    lines.append(f"  JOIN: `{join}`")

        if "tables" in sl:
            lines.append("")
            lines.append("## Table Descriptions")
            lines.append("")
            for tbl_name, info in sl["tables"].items():
                tbl_schema = info.get("schema", "public_warehouse")
                desc = info.get("description", "")
                grain = info.get("grain", "")
                lines.append(f"- **{tbl_schema}.{tbl_name}**: {desc}")
                if grain:
                    lines.append(f"  Grain: {grain}")

        if "metrics" in sl:
            lines.append("")
            lines.append("## Calculated Metrics")
            lines.append("")
            for metric_name, info in sl["metrics"].items():
                desc = info.get("description", "")
                formula = info.get("formula", "")
                lines.append(f"- **{metric_name}**: {desc}")
                if formula:
                    lines.append(f"  Formula: `{formula}`")

        if "verified_queries" in sl:
            lines.append("")
            lines.append("## Example Verified Queries")
            lines.append("")
            for vq in sl["verified_queries"]:
                q = vq.get("question", "")
                sql = vq.get("sql", "")
                lines.append(f"- Q: {q}")
                if sql:
                    lines.append(f"  ```sql\n  {sql.strip()}\n  ```")

        if "data_gaps" in sl:
            lines.append("")
            lines.append("## Data NOT Available in Warehouse")
            lines.append("")
            for gap in sl["data_gaps"]:
                name = gap.get("name", "")
                desc = gap.get("description", "")
                lines.append(f"- **{name}**: {desc}")

    if "data_freshness" in sl:
        df = sl["data_freshness"]
        lines.append("")
        lines.append("## Data Freshness")
        lines.append(f"- {df.get('description', '')}")
        lines.append(f"- {df.get('note', '')}")
        lines.append(f"- Window: {df.get('approximate_window', 'unknown')}")

    lines.append("")
    lines.append("## Important Rules")
    lines.append("- PREFER public_warehouse and public_semantic tables. Use public_staging tables when the warehouse does not have the needed data")
    lines.append("- NEVER reference tables that are not listed in 'Available Tables and Columns' above. If a table does not appear in that list, it does not exist")
    lines.append("- For service location/address data, use public_staging.stg_service_location (columns: address, city, state, zip, rate, rate_type, labor_cost)")
    lines.append("- Join staging tables to warehouse dims via customer_id + _company_name")
    lines.append("- Service completion sentinel: '2010-01-01 12:00:00' means NOT completed")
    lines.append("- Active customer filter: is_inactive = 0")
    lines.append("- _company_name column distinguishes companies: 'AQPS' or 'JOMO'")
    example_table = "public_warehouse.dim_customer" if layer == "warehouse" else "public_staging.stg_customer"
    lines.append(f"- Always qualify table names with schema (e.g., {example_table})")
    lines.append("- Use double quotes for column names only if they contain special characters")
    lines.append("- When joining facts to dimensions, match on BOTH the ID column AND _company_name")
    lines.append("- Data covers a trailing ~6 month window. When a user says 'December' or 'last month' without a year, use the most recent occurrence in the data — NOT a historical year")
    lines.append("- Date columns (service_date, payment_date, invoice_date, payment_date, etc.) are stored as TEXT, not timestamp. Use string comparisons with ISO date literals (e.g., payment_date >= '2026-03-01'). Do NOT use DATE_TRUNC(), CURRENT_DATE, INTERVAL, or any date/time functions — they will fail on text columns")
    lines.append("- IMPORTANT: dim_date.date_key is DATE type, but fact table date columns are TEXT. When joining to dim_date, always cast: e.g., fss.service_date::date = d.date_key. Alternatively, avoid dim_date entirely and use a CASE expression on the text date directly")

    # Dynamic date references — computed at query time
    lines.append("")
    lines.append("## Date Reference (computed server-side, use these exact values)")
    lines.append("")
    today = date.today()
    this_month_start = today.replace(day=1)
    next_month_start = (this_month_start + timedelta(days=32)).replace(day=1)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    two_months_ago_start = (last_month_start - timedelta(days=1)).replace(day=1)
    this_year_start = today.replace(month=1, day=1)
    next_year_start = today.replace(year=today.year + 1, month=1, day=1)
    last_year_start = today.replace(year=today.year - 1, month=1, day=1)

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    today_name = day_names[today.weekday()]

    # Week boundaries (Monday = start of week)
    this_week_start = today - timedelta(days=today.weekday())
    last_week_start = this_week_start - timedelta(days=7)
    next_week_start = this_week_start + timedelta(days=7)

    lines.append(f"- **today**: '{today.isoformat()}' ({today_name})")
    lines.append(f"- **yesterday**: '{(today - timedelta(days=1)).isoformat()}' ({day_names[(today.weekday() - 1) % 7]})")
    lines.append(f"- **this week** (Mon-Sun): >= '{this_week_start.isoformat()}' AND < '{next_week_start.isoformat()}'")
    lines.append(f"- **last week**: >= '{last_week_start.isoformat()}' AND < '{this_week_start.isoformat()}'")
    lines.append(f"- **this month**: >= '{this_month_start.isoformat()}' AND < '{next_month_start.isoformat()}'")
    lines.append(f"- **last month**: >= '{last_month_start.isoformat()}' AND < '{this_month_start.isoformat()}'")
    lines.append(f"- **two months ago**: >= '{two_months_ago_start.isoformat()}' AND < '{last_month_start.isoformat()}'")
    lines.append(f"- **next month**: >= '{next_month_start.isoformat()}' AND < '{(next_month_start + timedelta(days=32)).replace(day=1).isoformat()}'")
    q = (today.month - 1) // 3
    q_start = today.replace(month=q * 3 + 1, day=1)
    q_end = (q_start + timedelta(days=95)).replace(day=1)  # first of next quarter
    q_end = q_end.replace(month=((q + 1) * 3 + 1) if q < 3 else 1,
                          year=today.year if q < 3 else today.year + 1)
    lines.append(f"- **this quarter** (Q{q + 1}): >= '{q_start.isoformat()}' AND < '{q_end.isoformat()}'")
    lines.append(f"- **this year**: >= '{this_year_start.isoformat()}' AND < '{next_year_start.isoformat()}'")
    lines.append(f"- **last year**: >= '{last_year_start.isoformat()}' AND < '{this_year_start.isoformat()}'")
    lines.append(f"- **last 7 days**: >= '{(today - timedelta(days=7)).isoformat()}'")
    lines.append(f"- **last 30 days**: >= '{(today - timedelta(days=30)).isoformat()}'")
    lines.append(f"- **last 90 days**: >= '{(today - timedelta(days=90)).isoformat()}'")
    lines.append("")
    lines.append("### Day-of-Week Reference")
    lines.append("- dim_date.day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday")
    lines.append("- When asked 'what day was [date]', use a CASE expression to return the name:")
    lines.append("  `CASE day_of_week WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' END AS day_name`")
    lines.append("- For any other relative date, compute the ISO date string using these patterns")

    # Route assignment guidance
    lines.append("")
    lines.append("### Route Assignments")
    lines.append("- For 'active routes', 'route list', 'tech schedule', or 'service schedule' questions, use public_staging.stg_route_assignment")
    lines.append("- Join: stg_route_assignment.account_id = stg_account.account_id (technician), stg_route_assignment.service_location_id = stg_service_location.service_location_id (address)")
    lines.append("- Active filter: end_date >= CURRENT_DATE::text (Skimmer uses '2080-01-01' as 'no end' sentinel)")
    lines.append("- day_of_week is already a text string ('Monday', 'Tuesday', etc.) — do NOT use dim_date for route day")
    lines.append("- frequency values: 'Weekly', 'Every 2 Weeks'")
    lines.append("- GROUP BY route_assignment_id to avoid duplicates when joining to dim_pool (multiple bodies of water per service location)")
    lines.append("- Filter out placeholder techs: WHERE full_name NOT LIKE '%Unscheduled%'")

    # Customer lifecycle guidance
    lines.append("")
    lines.append("### Customer Lifecycle (Cancellation, Churn, New Customers)")
    lines.append("- 'Cancelled', 'lost', 'churned', or 'deactivated' customers: use public_staging.stg_customer WHERE (is_inactive = 1 OR deleted = 1)")
    lines.append("- Use updated_at as the cancellation/deactivation date (TEXT column — use string comparisons)")
    lines.append("- 'New customers' or 'signed up': use stg_customer WHERE created_at >= '<date>' AND is_inactive = 0 AND deleted = 0")
    lines.append("- stg_customer includes ALL customers (active, inactive, deleted) — filter accordingly")
    lines.append("- Note: nightly extract covers ~6 months trailing. Older cancellations may be missing from the data.")

    return "\n".join(lines)

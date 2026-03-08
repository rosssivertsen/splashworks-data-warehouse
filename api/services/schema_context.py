from pathlib import Path

import yaml

SEMANTIC_LAYER_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "skimmer-semantic-layer.yaml"

LAYER_SCHEMAS = {
    "warehouse": ["public_warehouse", "public_semantic"],
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
    lines.append("- Service completion sentinel: '2010-01-01 12:00:00' means NOT completed")
    lines.append("- Active customer filter: is_inactive = 0")
    lines.append("- _company_name column distinguishes companies: 'AQPS' or 'JOMO'")
    example_table = "public_warehouse.dim_customer" if layer == "warehouse" else "public_staging.stg_customer"
    lines.append(f"- Always qualify table names with schema (e.g., {example_table})")
    lines.append("- Use double quotes for column names only if they contain special characters")
    lines.append("- When joining facts to dimensions, match on BOTH the ID column AND _company_name")
    lines.append("- Data covers a trailing ~6 month window. When a user says 'December' or 'last month' without a year, use the most recent occurrence in the data — NOT a historical year")
    lines.append("- Date columns (service_date, payment_date, etc.) are stored as TEXT, not timestamp. Use string comparisons with ISO date literals (e.g., payment_date >= '2026-03-01'). Do NOT use DATE_TRUNC(), CURRENT_DATE, INTERVAL, or any date/time functions — they will fail on text columns")

    return "\n".join(lines)

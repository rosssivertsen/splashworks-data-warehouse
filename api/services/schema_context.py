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

        if "verified_queries" in sl:
            lines.append("")
            lines.append("## Example Verified Queries")
            lines.append("")
            for vq in sl["verified_queries"]:
                q = vq.get("question", "")
                lines.append(f"- Q: {q}")

    lines.append("")
    lines.append("## Important Rules")
    lines.append("- Service completion sentinel: '2010-01-01 12:00:00' means NOT completed")
    lines.append("- Active customer filter: is_inactive = 0")
    lines.append("- _company_name column distinguishes companies: 'AQPS' or 'JOMO'")
    example_table = "public_warehouse.dim_customer" if layer == "warehouse" else "public_staging.stg_customer"
    lines.append(f"- Always qualify table names with schema (e.g., {example_table})")
    lines.append("- Use double quotes for column names only if they contain special characters")

    return "\n".join(lines)

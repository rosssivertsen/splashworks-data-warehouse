from api.services.schema_context import build_system_prompt, load_semantic_layer


def test_load_semantic_layer():
    """Semantic layer YAML loads without error."""
    sl = load_semantic_layer()
    assert "business_terms" in sl
    assert "relationships" in sl


def test_build_prompt_warehouse_layer():
    """Prompt for warehouse layer mentions warehouse tables."""
    schema = {
        "public_warehouse": {
            "dim_customer": ["company_id", "customer_id", "clean_customer_name"],
            "fact_labor": ["company_id", "service_stop_id", "minutes_at_stop"],
        },
        "public_semantic": {
            "service_completion": ["company_id", "service_date", "service_status"],
        },
    }
    prompt = build_system_prompt(schema, layer="warehouse")
    assert "dim_customer" in prompt
    assert "fact_labor" in prompt
    assert "service_completion" in prompt
    assert "SELECT" in prompt


def test_build_prompt_staging_layer():
    """Prompt for staging layer mentions staging tables, not warehouse."""
    schema = {
        "public_staging": {
            "stg_customer": ["_company_name", "customer_id", "first_name"],
        },
    }
    prompt = build_system_prompt(schema, layer="staging")
    assert "stg_customer" in prompt
    assert "dim_customer" not in prompt


def test_build_prompt_includes_semantic_context():
    """Prompt includes business terms from semantic layer."""
    schema = {
        "public_warehouse": {
            "dim_customer": ["customer_id"],
        },
    }
    prompt = build_system_prompt(schema, layer="warehouse")
    assert "chlorine" in prompt.lower() or "business" in prompt.lower()


# --- New tests for expanded YAML sections ---

_WAREHOUSE_SCHEMA = {
    "public_warehouse": {
        "dim_customer": ["customer_id", "_company_name"],
    },
}


def test_table_descriptions_in_prompt():
    """Prompt includes table descriptions from YAML tables section."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "## Table Descriptions" in prompt
    assert "public_warehouse.dim_customer" in prompt
    assert "public_semantic.semantic_profit" in prompt
    assert "Grain:" in prompt


def test_metrics_in_prompt():
    """Prompt includes calculated metrics from YAML metrics section."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "## Calculated Metrics" in prompt
    assert "**profit**" in prompt
    assert "Formula:" in prompt
    assert "service_rate" in prompt


def test_data_gaps_in_prompt():
    """Prompt includes data gaps from YAML data_gaps section."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "## Data NOT Available in Warehouse" in prompt
    assert "Equipment/Parts" in prompt
    assert "LSI Calculation" in prompt


def test_verified_queries_include_sql():
    """Verified queries include SQL blocks, not just questions."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "## Example Verified Queries" in prompt
    assert "```sql" in prompt
    assert "SELECT _company_name, COUNT(*)" in prompt


def test_join_clauses_in_relationships():
    """Relationships include JOIN clauses from YAML."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "## Key Relationships" in prompt
    assert "JOIN:" in prompt
    assert "dim_customer.customer_id = dim_service_location.customer_id" in prompt


def test_company_name_join_rule():
    """Prompt includes rule about matching on _company_name when joining."""
    prompt = build_system_prompt(_WAREHOUSE_SCHEMA, layer="warehouse")
    assert "match on BOTH the ID column AND _company_name" in prompt

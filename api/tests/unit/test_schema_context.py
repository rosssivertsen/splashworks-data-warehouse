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

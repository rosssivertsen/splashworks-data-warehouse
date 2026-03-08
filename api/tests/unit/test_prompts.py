"""Unit tests for the /api/prompts endpoint."""


def test_prompts_returns_questions():
    """Verify /api/prompts returns a list of question strings from YAML."""
    from api.services.schema_context import load_semantic_layer

    sl = load_semantic_layer()
    prompts = [vq["question"] for vq in sl.get("verified_queries", [])]
    assert len(prompts) >= 1, "No verified queries in YAML"
    assert all(isinstance(p, str) for p in prompts)
    assert any("active customers" in p.lower() for p in prompts)

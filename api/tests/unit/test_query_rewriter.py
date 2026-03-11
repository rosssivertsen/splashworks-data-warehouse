"""Unit tests for query_rewriter service."""

import json
import pytest
from unittest.mock import patch, MagicMock

from api.services.query_rewriter import (
    parse_rewriter_response,
    build_rewriter_prompt,
    RewriterResult,
)


class TestParseRewriterResponse:
    """Test parsing of Haiku JSON responses."""

    def test_parse_high_confidence(self):
        raw = json.dumps({
            "confidence": "high",
            "matched_metrics": ["jobs_completed_per_day"],
            "rewritten_question": "Count completed service stops per tech per day",
            "technical_instructions": "Use fact_service_stop WHERE service_status=1, GROUP BY tech_id, service_date",
            "unanswerable_reason": None,
            "partial_answer_hint": None,
        })
        result = parse_rewriter_response(raw)
        assert isinstance(result, RewriterResult)
        assert result.confidence == "high"
        assert result.matched_metrics == ["jobs_completed_per_day"]
        assert "completed service stops" in result.rewritten_question
        assert result.unanswerable_reason is None

    def test_parse_unanswerable(self):
        raw = json.dumps({
            "confidence": "unanswerable",
            "matched_metrics": ["technician_utilization"],
            "rewritten_question": None,
            "technical_instructions": None,
            "unanswerable_reason": "No clock-in/clock-out data in Skimmer.",
            "partial_answer_hint": "I can show average minutes per stop by technician.",
        })
        result = parse_rewriter_response(raw)
        assert result.confidence == "unanswerable"
        assert "clock-in" in result.unanswerable_reason
        assert result.partial_answer_hint is not None

    def test_parse_low_confidence_passthrough(self):
        raw = json.dumps({
            "confidence": "low",
            "matched_metrics": [],
            "rewritten_question": "Show me something about pools",
            "technical_instructions": None,
            "unanswerable_reason": None,
            "partial_answer_hint": None,
        })
        result = parse_rewriter_response(raw)
        assert result.confidence == "low"
        assert result.matched_metrics == []

    def test_parse_json_in_markdown_code_block(self):
        raw = '```json\n{"confidence": "high", "matched_metrics": ["customer_churn"], "rewritten_question": "Count churned customers", "technical_instructions": null, "unanswerable_reason": null, "partial_answer_hint": null}\n```'
        result = parse_rewriter_response(raw)
        assert result.confidence == "high"
        assert result.matched_metrics == ["customer_churn"]

    def test_parse_json_in_bare_code_block(self):
        raw = '```\n{"confidence": "medium", "matched_metrics": [], "rewritten_question": null, "technical_instructions": null, "unanswerable_reason": null, "partial_answer_hint": null}\n```'
        result = parse_rewriter_response(raw)
        assert result.confidence == "medium"

    def test_parse_invalid_json_returns_passthrough(self):
        result = parse_rewriter_response("not valid json at all")
        assert result.confidence == "low"
        assert result.rewritten_question is None
        assert result.technical_instructions is None

    def test_parse_missing_fields_returns_passthrough(self):
        raw = json.dumps({"confidence": "high"})
        result = parse_rewriter_response(raw)
        assert result.confidence == "high"
        assert result.matched_metrics == []
        assert result.rewritten_question is None


class TestBuildRewriterPrompt:
    """Test rewriter prompt construction from YAML metrics."""

    def test_prompt_contains_metric_catalog(self):
        metrics = {
            "jobs_completed_per_day": {
                "description": "Average completed stops per tech per day",
                "calculation": "COUNT(*) WHERE service_status=1",
                "synonyms": ["stops per day", "jobs per day"],
                "confidence": "high",
            }
        }
        prompt = build_rewriter_prompt(metrics, tables_summary="dim_tech, fact_service_stop")
        assert "jobs_completed_per_day" in prompt
        assert "stops per day" in prompt
        assert "dim_tech, fact_service_stop" in prompt

    def test_prompt_contains_unanswerable_metrics(self):
        metrics = {
            "technician_utilization": {
                "description": "Utilization rate",
                "calculation": None,
                "synonyms": ["utilization"],
                "confidence": "unanswerable",
                "data_gap": "No clock data",
                "partial_answer": "Show minutes per stop instead",
            }
        }
        prompt = build_rewriter_prompt(metrics, tables_summary="")
        assert "unanswerable" in prompt.lower()
        assert "No clock data" in prompt

    def test_prompt_includes_output_format(self):
        prompt = build_rewriter_prompt({}, tables_summary="")
        assert '"confidence"' in prompt
        assert '"rewritten_question"' in prompt

"""Semantic query rewriter — Stage 1 of the two-stage AI pipeline.

Uses Claude Haiku to preprocess user questions:
- Maps industry terms to warehouse calculations
- Classifies confidence (high/medium/low/unanswerable)
- Short-circuits unanswerable questions with explanations
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

import anthropic
import yaml

from api.config import ANTHROPIC_API_KEY
from api.services.schema_context import build_tables_summary

logger = logging.getLogger(__name__)

SEMANTIC_LAYER_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "skimmer-semantic-layer.yaml"

HAIKU_MODEL = "claude-haiku-4-5-20251001"


@dataclass
class RewriterResult:
    confidence: str  # high, medium, low, unanswerable
    matched_metrics: list[str] = field(default_factory=list)
    rewritten_question: str | None = None
    technical_instructions: str | None = None
    unanswerable_reason: str | None = None
    partial_answer_hint: str | None = None


def _extract_json(raw: str) -> str:
    """Extract JSON from a response that may include markdown code blocks."""
    # Try to find JSON in ```json ... ``` or ``` ... ``` blocks
    match = re.search(r'```(?:json)?\s*\n?(.*?)```', raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw.strip()


def parse_rewriter_response(raw: str) -> RewriterResult:
    """Parse Haiku's JSON response into a RewriterResult.

    Handles responses wrapped in markdown code blocks.
    Falls back to a low-confidence passthrough if JSON is invalid.
    """
    try:
        data = json.loads(_extract_json(raw))
    except (json.JSONDecodeError, TypeError):
        logger.warning("Rewriter returned invalid JSON, falling back to passthrough: %s", raw[:200])
        return RewriterResult(confidence="low")

    return RewriterResult(
        confidence=data.get("confidence", "low"),
        matched_metrics=data.get("matched_metrics", []),
        rewritten_question=data.get("rewritten_question"),
        technical_instructions=data.get("technical_instructions"),
        unanswerable_reason=data.get("unanswerable_reason"),
        partial_answer_hint=data.get("partial_answer_hint"),
    )


def load_industry_metrics() -> dict:
    """Load industry_metrics from the semantic layer YAML."""
    if not SEMANTIC_LAYER_PATH.exists():
        return {}
    with open(SEMANTIC_LAYER_PATH) as f:
        sl = yaml.safe_load(f) or {}
    return sl.get("industry_metrics", {})


def build_rewriter_prompt(metrics: dict, tables_summary: str) -> str:
    """Build the system prompt for the Haiku rewriter."""
    answerable = []
    unanswerable = []

    for name, info in metrics.items():
        conf = info.get("confidence", "low")
        synonyms = ", ".join(info.get("synonyms", []))
        desc = info.get("description", "")
        calc = info.get("calculation", "")

        if conf == "unanswerable":
            gap = info.get("data_gap", "")
            blocked = info.get("blocked_on", "")
            partial = info.get("partial_answer", "")
            unanswerable.append(
                f"- **{name}** ({synonyms}): {desc}\n"
                f"  Data gap: {gap}\n"
                f"  Blocked on: {blocked}\n"
                f"  Partial answer: {partial or 'None'}"
            )
        else:
            answerable.append(
                f"- **{name}** [{conf}] ({synonyms}): {desc}\n"
                f"  Calculation: {calc}"
            )

    return f"""You are a query preprocessor for a pool service data warehouse (PostgreSQL).

Given a user's natural language question:
1. Identify which industry metrics or business concepts the question references
2. Map each to the warehouse calculation, or flag as unanswerable
3. Return ONLY a JSON object — no other text

## Answerable Metrics
{chr(10).join(answerable) if answerable else "None defined."}

## Unanswerable Metrics (data not yet available)
{chr(10).join(unanswerable) if unanswerable else "None defined."}

## Warehouse Tables (abbreviated)
{tables_summary}

## Rules
- If the question matches an answerable metric, set confidence to its catalog confidence level
- If the question matches an unanswerable metric, set confidence to "unanswerable" and provide the reason and partial answer hint from the catalog
- If the question partially matches or you're unsure, set confidence to "medium" or "low"
- For simple, direct data questions (e.g., "how many customers"), set confidence to "high" with no rewrite needed
- Preserve date references exactly as the user stated them — do not resolve dates
- For multi-metric questions, combine instructions from all matched metrics

## Output Format (JSON only)
{{
  "confidence": "high|medium|low|unanswerable",
  "matched_metrics": ["metric_name"],
  "rewritten_question": "Technically enriched version of the question, or null if no rewrite needed",
  "technical_instructions": "Specific SQL guidance: tables, joins, filters, GROUP BY, or null",
  "unanswerable_reason": "Why this can't be answered, or null",
  "partial_answer_hint": "What CAN be answered instead, or null"
}}"""


def rewrite_question(question: str, schema: dict[str, dict[str, list[str]]]) -> RewriterResult:
    """Call Claude Haiku to preprocess a user question.

    Returns a RewriterResult with confidence, enriched question, and instructions.
    """
    metrics = load_industry_metrics()
    if not metrics:
        # No metric catalog — skip rewriting, pass through as low confidence
        return RewriterResult(confidence="low")

    tables_summary = build_tables_summary(schema)
    system_prompt = build_rewriter_prompt(metrics, tables_summary)

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": question}],
        )
        raw = message.content[0].text
        result = parse_rewriter_response(raw)
        logger.info(
            "Rewriter: confidence=%s metrics=%s",
            result.confidence,
            result.matched_metrics,
        )
        return result
    except Exception:
        logger.exception("Rewriter failed, falling back to passthrough")
        return RewriterResult(confidence="low")

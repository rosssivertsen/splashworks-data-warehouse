# AQ-4: Semantic Rewriter — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-stage AI query pipeline with a Haiku rewriter for metric mapping, confidence signals, unanswerable detection, and improved error messages.

**Architecture:** A new `query_rewriter.py` service calls Claude Haiku to preprocess user questions before the existing Sonnet SQL generator. The rewriter maps industry terms to warehouse calculations using a YAML metric catalog, classifies confidence, and short-circuits unanswerable questions. The frontend displays confidence badges and friendly error messages.

**Tech Stack:** Python/FastAPI (backend), Claude Haiku API (rewriter), React/TypeScript (frontend), YAML (metric catalog)

**Spec:** `docs/plans/2026-03-10-aq4-semantic-rewriter-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `api/services/query_rewriter.py` | Haiku rewriter: question + metric catalog → enriched question + confidence JSON |
| `api/tests/unit/test_query_rewriter.py` | Unit tests for rewriter prompt building, response parsing, confidence routing |
| `src/components/ConfidenceBadge.tsx` | Green/yellow/blue confidence indicator component |
| `src/components/UnansweredPanel.tsx` | Blue info panel for unanswerable questions with partial-answer hints |
| `src/components/__tests__/ConfidenceBadge.test.tsx` | Tests for badge rendering |
| `src/components/__tests__/UnansweredPanel.test.tsx` | Tests for panel rendering |

### Modified Files

| File | Change |
|------|--------|
| `docs/skimmer-semantic-layer.yaml` | Add `industry_metrics` section (~20 metrics + unanswerable entries) |
| `api/models/responses.py` | Add `confidence`, `unanswerable_reason`, `partial_answer_hint` to `QueryResponse` |
| `api/routers/query.py` | Insert rewriter step, confidence routing, improved error messages |
| `api/services/schema_context.py` | Add `build_rewriter_context()` for abbreviated schema + metrics |
| `api/services/ai_service.py` | Accept optional `technical_instructions` parameter |
| `src/types/api.ts` | Add confidence fields to `QueryResponse` |
| `src/views/QueryView.tsx` | Show confidence badges, unanswerable panel, improved errors |

---

## Chunk 1: Backend — Metric Catalog + Rewriter Service

### Task 1: Add industry metrics to semantic layer YAML

**Files:**
- Modify: `docs/skimmer-semantic-layer.yaml`

- [ ] **Step 1: Add `industry_metrics` section to YAML**

Append after the `data_gaps` section (before `lsi_calculation`):

```yaml
industry_metrics:
  route_production_per_tech:
    description: "Recurring service revenue per technician per period (excludes work orders)"
    calculation: "SUM(dim_service_location.rate) grouped by technician via stg_route_assignment"
    tables: [dim_service_location, stg_route_assignment, stg_account]
    synonyms: ["route production", "tech revenue", "revenue per tech", "production per route", "route revenue"]
    confidence: high

  jobs_completed_per_day:
    description: "Average number of completed stops per technician per workday"
    calculation: "COUNT(*) FROM fact_service_stop WHERE service_status=1, GROUP BY tech_id, service_date"
    tables: [fact_service_stop, dim_tech]
    synonyms: ["stops per day", "jobs per day", "daily completions", "completions per tech"]
    confidence: high

  revenue_per_technician:
    description: "Total service revenue divided by number of technicians over a period"
    calculation: "SUM(dim_service_location.rate) / COUNT(DISTINCT tech_id) via route assignments"
    tables: [dim_service_location, stg_route_assignment, stg_account]
    synonyms: ["revenue per tech", "avg tech revenue", "technician revenue"]
    confidence: high

  mean_time_per_stop:
    description: "Average duration of a completed service visit in minutes"
    calculation: "AVG(fact_service_stop.minutes_at_stop) WHERE service_status = 1"
    tables: [fact_service_stop]
    synonyms: ["average stop time", "time per visit", "minutes per stop", "service duration"]
    confidence: high

  jobs_per_route_per_period:
    description: "Total completed stops on a route in a time period, grouped by tech"
    calculation: "COUNT(*) FROM fact_service_stop WHERE service_status=1, GROUP BY tech_id and period"
    tables: [fact_service_stop, dim_tech]
    synonyms: ["stops per route", "route volume", "jobs per route"]
    confidence: high

  service_completion_rate:
    description: "Percentage of scheduled stops that were completed"
    calculation: "SUM(service_status) / COUNT(*) * 100 FROM fact_service_stop"
    tables: [fact_service_stop]
    synonyms: ["completion rate", "stop completion", "visit completion rate"]
    confidence: high

  skipped_stop_rate:
    description: "Percentage and count of stops not completed, with skip reasons"
    calculation: "COUNT(*) WHERE service_status=0, with skip_reason from fact_service_stop"
    tables: [fact_service_stop]
    synonyms: ["skip rate", "skipped stops", "missed stops", "incomplete stops"]
    confidence: high

  average_ticket_value:
    description: "Average revenue per invoice"
    calculation: "AVG(fact_invoice.subtotal)"
    tables: [fact_invoice]
    synonyms: ["average ticket", "avg invoice", "revenue per visit", "average treatment value", "avg ticket"]
    confidence: high

  collection_rate:
    description: "Percentage of invoiced revenue actually collected"
    calculation: "SUM(fact_payment.amount) / SUM(fact_invoice.subtotal) * 100"
    tables: [fact_payment, fact_invoice]
    synonyms: ["collection rate", "payment rate", "collections percentage", "percent collected"]
    confidence: high

  days_sales_outstanding:
    description: "Average days from invoice to payment received"
    calculation: "AVG(fact_payment.payment_date::date - fact_invoice.invoice_date::date) — requires matching payments to invoices by customer"
    tables: [fact_payment, fact_invoice]
    synonyms: ["DSO", "days to collect", "days outstanding", "days to pay"]
    confidence: medium

  work_order_completion_rate:
    description: "Percentage of assigned work orders completed"
    calculation: "SUM(CASE WHEN service_status=1 THEN 1 ELSE 0 END) / COUNT(*) * 100 FROM fact_work_order"
    tables: [fact_work_order]
    synonyms: ["work order completion", "WO completion rate"]
    confidence: high

  customer_churn:
    description: "Customers who stopped service in a period"
    calculation: "COUNT(*) FROM dim_customer WHERE (is_inactive=1 OR deleted=1) AND updated_at within period"
    tables: [dim_customer]
    synonyms: ["churn", "cancellations", "lost customers", "attrition", "cancelled customers", "customer losses"]
    confidence: high

  # --- Unanswerable metrics (blocked on future data sources) ---

  technician_utilization:
    description: "Percent of paid hours spent on billable work (on-site service) vs drive/admin time"
    calculation: null
    tables: []
    synonyms: ["utilization rate", "tech utilization", "billable hours", "utilization"]
    confidence: unanswerable
    data_gap: "No clock-in/clock-out data in Skimmer. Only minutes_at_stop (time on-site) is available."
    blocked_on: "Time & attendance integration (Homebase, Deputy, etc.)"
    partial_answer: "I can show average minutes per stop by technician, which gives a partial picture of on-site time."

  first_time_fix_rate:
    description: "Percent of jobs resolved without a callback or return visit"
    calculation: null
    tables: []
    synonyms: ["first visit fix", "callback rate", "repeat visit rate", "first-time resolution"]
    confidence: unanswerable
    data_gap: "Skimmer does not track callbacks or return visits."
    blocked_on: "CRM or dispatch system with callback tracking"
    partial_answer: "I can show skipped stops and work orders, which may indicate follow-up needs."

  drive_time_per_job:
    description: "Average travel time between service stops"
    calculation: null
    tables: []
    synonyms: ["drive time", "travel time", "time between stops", "windshield time"]
    confidence: unanswerable
    data_gap: "No GPS or travel data in Skimmer."
    blocked_on: "Telematics integration (GPS Trackit, Azuga, etc.)"
    partial_answer: "I can show service addresses per route to help estimate geographic density."

  on_time_arrival_rate:
    description: "Percent of appointments started within defined time windows"
    calculation: null
    tables: []
    synonyms: ["on-time rate", "punctuality", "arrival rate", "on time"]
    confidence: unanswerable
    data_gap: "No appointment time windows or actual arrival times in Skimmer."
    blocked_on: "Telematics or scheduling system with time windows"
    partial_answer: null

  route_density:
    description: "Stops per mile or per neighborhood — tighter density means better margins"
    calculation: null
    tables: []
    synonyms: ["stop density", "geographic density", "route tightness"]
    confidence: unanswerable
    data_gap: "Addresses exist but are not geocoded."
    blocked_on: "Geocoding service + telematics integration"
    partial_answer: "I can list service addresses grouped by city/zip to show geographic concentration."

  customer_satisfaction:
    description: "CSAT or NPS scores from post-visit surveys"
    calculation: null
    tables: []
    synonyms: ["CSAT", "NPS", "customer satisfaction", "satisfaction score", "customer rating"]
    confidence: unanswerable
    data_gap: "No survey or rating data in Skimmer."
    blocked_on: "Survey tool or CRM integration"
    partial_answer: null

  booking_rate:
    description: "Booked jobs divided by inbound calls or leads (CSR performance)"
    calculation: null
    tables: []
    synonyms: ["booking rate", "conversion rate", "call to booking", "lead conversion"]
    confidence: unanswerable
    data_gap: "No call center or lead tracking data."
    blocked_on: "Phone system (Xima, RingCentral) + CRM integration"
    partial_answer: "I can show new customer signups by month as a proxy for booking activity."

  customer_acquisition_cost:
    description: "Marketing spend divided by new customers acquired"
    calculation: null
    tables: []
    synonyms: ["CAC", "acquisition cost", "cost per customer", "cost to acquire"]
    confidence: unanswerable
    data_gap: "No marketing spend data."
    blocked_on: "QBO + CRM integration"
    partial_answer: "I can show new customer count by month. You'd need to divide by marketing spend manually."
```

- [ ] **Step 2: Validate YAML parses correctly**

Run: `python -c "import yaml; yaml.safe_load(open('docs/skimmer-semantic-layer.yaml')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add docs/skimmer-semantic-layer.yaml
git commit -m "feat(AQ-4): add industry_metrics section to semantic layer YAML"
```

---

### Task 2: Rewriter service — unit tests

**Files:**
- Create: `api/tests/unit/test_query_rewriter.py`

- [ ] **Step 1: Write failing tests for rewriter response parsing and prompt building**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/rosssivertsen/dev/clientwork/splashworks/splashworks-data-warehouse && python -m pytest api/tests/unit/test_query_rewriter.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.services.query_rewriter'`

- [ ] **Step 3: Commit failing tests**

```bash
git add api/tests/unit/test_query_rewriter.py
git commit -m "test(AQ-4): add unit tests for query rewriter parsing and prompt building"
```

---

### Task 3: Implement rewriter service

**Files:**
- Create: `api/services/query_rewriter.py`

- [ ] **Step 1: Implement `RewriterResult`, `parse_rewriter_response`, `build_rewriter_prompt`, `rewrite_question`**

```python
"""Semantic query rewriter — Stage 1 of the two-stage AI pipeline.

Uses Claude Haiku to preprocess user questions:
- Maps industry terms to warehouse calculations
- Classifies confidence (high/medium/low/unanswerable)
- Short-circuits unanswerable questions with explanations
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import anthropic
import yaml

from api.config import ANTHROPIC_API_KEY

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


def parse_rewriter_response(raw: str) -> RewriterResult:
    """Parse Haiku's JSON response into a RewriterResult.

    Falls back to a low-confidence passthrough if JSON is invalid.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Rewriter returned invalid JSON, falling back to passthrough")
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


def build_tables_summary(schema: dict[str, dict[str, list[str]]]) -> str:
    """Build abbreviated table summary (table: key columns) for the rewriter."""
    lines = []
    for schema_name, tables in schema.items():
        for table_name, columns in tables.items():
            # Show first 8 columns to keep it concise
            cols = ", ".join(columns[:8])
            if len(columns) > 8:
                cols += f", ... ({len(columns)} total)"
            lines.append(f"- {schema_name}.{table_name}: {cols}")
    return "\n".join(lines)


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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `python -m pytest api/tests/unit/test_query_rewriter.py -v`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add api/services/query_rewriter.py
git commit -m "feat(AQ-4): implement query rewriter service with Haiku preprocessing"
```

---

### Task 4: Update response model + ai_service + schema_context

**Files:**
- Modify: `api/models/responses.py`
- Modify: `api/services/ai_service.py`
- Modify: `api/services/schema_context.py`

- [ ] **Step 1: Add confidence fields to QueryResponse**

In `api/models/responses.py`, update `QueryResponse`:

```python
class QueryResponse(BaseModel):
    sql: str
    columns: list[str]
    results: list[list]
    row_count: int
    explanation: str
    confidence: str | None = None
    unanswerable_reason: str | None = None
    partial_answer_hint: str | None = None
```

- [ ] **Step 2: Update `generate_sql` to accept technical instructions**

In `api/services/ai_service.py`, modify `generate_sql`:

```python
def generate_sql(question: str, system_prompt: str, technical_instructions: str | None = None) -> tuple[str | None, str]:
    """Call Claude to generate SQL from a natural language question.

    Returns (sql, full_response_text).
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # If the rewriter provided instructions, prepend them to the question
    user_content = question
    if technical_instructions:
        user_content = f"{question}\n\n## Technical Instructions (from query preprocessor)\n{technical_instructions}"

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_content},
        ],
    )

    response_text = message.content[0].text
    sql = extract_sql_from_response(response_text)
    return sql, response_text
```

- [ ] **Step 3: Add `build_rewriter_context` helper to schema_context**

In `api/services/schema_context.py`, add after the existing imports:

```python
def build_tables_summary(schema: dict[str, dict[str, list[str]]]) -> str:
    """Build abbreviated table list for the rewriter (table: key columns)."""
    lines = []
    for schema_name, tables in schema.items():
        for table_name, columns in tables.items():
            cols = ", ".join(columns[:8])
            if len(columns) > 8:
                cols += f", ... ({len(columns)} total)"
            lines.append(f"- {schema_name}.{table_name}: {cols}")
    return "\n".join(lines)
```

Note: This duplicates `build_tables_summary` from `query_rewriter.py`. After both are working, refactor `query_rewriter.py` to import from `schema_context.py` and remove its own copy. (The rewriter module should import the schema helper, not own it.)

- [ ] **Step 4: Run existing tests to verify nothing broke**

Run: `python -m pytest api/tests/unit/ -v`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/models/responses.py api/services/ai_service.py api/services/schema_context.py
git commit -m "feat(AQ-4): add confidence fields to response, technical instructions to SQL generator"
```

---

### Task 5: Wire rewriter into query router + improved error messages

**Files:**
- Modify: `api/routers/query.py`

- [ ] **Step 1: Update the query endpoint to use the rewriter**

Replace the full `query()` function in `api/routers/query.py`:

```python
@router.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    # 1. Build schema context
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        schema = get_schema_metadata(conn, layer=req.layer)
    finally:
        conn.close()

    # 2. Rewrite question via Haiku
    from api.services.query_rewriter import rewrite_question

    rewriter_result = rewrite_question(req.question, schema)

    # Short-circuit unanswerable questions
    if rewriter_result.confidence == "unanswerable":
        reason = rewriter_result.unanswerable_reason or "This question requires data that isn't available in the warehouse yet."
        hint = rewriter_result.partial_answer_hint
        raise HTTPException(
            status_code=422,
            detail={
                "message": reason,
                "partial_answer_hint": hint,
                "confidence": "unanswerable",
            },
        )

    # 3. Build system prompt and generate SQL
    system_prompt = build_system_prompt(schema, layer=req.layer)

    # Use enriched question if rewriter provided one, otherwise original
    question_for_sonnet = rewriter_result.rewritten_question or req.question

    try:
        sql, explanation = generate_sql(
            question_for_sonnet,
            system_prompt,
            technical_instructions=rewriter_result.technical_instructions,
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The AI service is temporarily unavailable. Please try again in a moment.",
        )

    if sql is None:
        raise HTTPException(
            status_code=400,
            detail="I wasn't sure how to translate that into a query. Try being more specific about what data you want.",
        )

    # 4. Validate SQL
    error = validate_sql(sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # 5. Execute with guardrails + auto-repair on failure
    try:
        columns, rows = execute_query(sql)
    except psycopg2.extensions.QueryCanceledError:
        raise HTTPException(
            status_code=408,
            detail="This question requires a complex query that took too long. Try narrowing it — e.g., add a company name or date range.",
        )
    except Exception as exc:
        logger.warning("Query execution failed: %s | SQL: %s", exc, sql)

        # Attempt auto-repair and retry once
        repaired_sql = attempt_repair(sql, str(exc))
        if repaired_sql:
            repair_error = validate_sql(repaired_sql)
            if repair_error:
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
            try:
                columns, rows = execute_query(repaired_sql)
                sql = repaired_sql
                logger.info("SQL repair succeeded")
            except Exception as retry_exc:
                logger.error("SQL repair retry failed: %s | SQL: %s", retry_exc, repaired_sql)
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
            )

    # 6. Return results with confidence
    return QueryResponse(
        sql=sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation=explanation,
        confidence=rewriter_result.confidence,
        unanswerable_reason=rewriter_result.unanswerable_reason,
        partial_answer_hint=rewriter_result.partial_answer_hint,
    )
```

- [ ] **Step 2: Run existing tests**

Run: `python -m pytest api/tests/unit/ -v`
Expected: All tests PASS (existing tests don't call the actual API endpoint with a real Anthropic key)

- [ ] **Step 3: Commit**

```bash
git add api/routers/query.py
git commit -m "feat(AQ-4): wire rewriter into query pipeline with improved error messages"
```

---

### Task 6: Deduplicate `build_tables_summary`

**Files:**
- Modify: `api/services/query_rewriter.py`
- Modify: `api/services/schema_context.py`

- [ ] **Step 1: Remove `build_tables_summary` from `query_rewriter.py` and import from `schema_context.py`**

In `query_rewriter.py`, remove the `build_tables_summary` function and update the import:

```python
from api.services.schema_context import build_tables_summary
```

Remove the `build_tables_summary` function definition from `query_rewriter.py`.

- [ ] **Step 2: Update `rewrite_question` to use the imported version**

The function call `build_tables_summary(schema)` stays the same — just the import source changes.

- [ ] **Step 3: Run tests**

Run: `python -m pytest api/tests/unit/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add api/services/query_rewriter.py api/services/schema_context.py
git commit -m "refactor(AQ-4): deduplicate build_tables_summary into schema_context"
```

---

## Chunk 2: Frontend — Confidence Badges + Error UX

### Task 7: Update TypeScript types

**Files:**
- Modify: `src/types/api.ts`

- [ ] **Step 1: Add confidence fields to QueryResponse interface**

```typescript
export interface QueryResponse {
  sql: string;
  columns: string[];
  results: (string | number | boolean | null)[][];
  row_count: number;
  explanation: string;
  confidence?: "high" | "medium" | "low" | "unanswerable" | null;
  unanswerable_reason?: string | null;
  partial_answer_hint?: string | null;
}
```

- [ ] **Step 2: Add UnansweredError interface for structured 422 responses**

```typescript
export interface UnansweredError {
  message: string;
  partial_answer_hint: string | null;
  confidence: "unanswerable";
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/api.ts
git commit -m "feat(AQ-4): add confidence fields to frontend QueryResponse type"
```

---

### Task 8: ConfidenceBadge component

**Files:**
- Create: `src/components/__tests__/ConfidenceBadge.test.tsx`
- Create: `src/components/ConfidenceBadge.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders green Verified badge for high confidence", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders yellow Best effort badge for medium confidence", () => {
    render(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText("Best effort")).toBeInTheDocument();
  });

  it("renders yellow Best effort badge for low confidence", () => {
    render(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText("Best effort")).toBeInTheDocument();
  });

  it("renders nothing for null confidence", () => {
    const { container } = render(<ConfidenceBadge confidence={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for unanswerable (handled separately)", () => {
    const { container } = render(<ConfidenceBadge confidence="unanswerable" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/components/__tests__/ConfidenceBadge.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```tsx
interface ConfidenceBadgeProps {
  confidence: string | null | undefined;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (!confidence || confidence === "unanswerable") return null;

  if (confidence === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Verified
      </span>
    );
  }

  // medium or low
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Best effort
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --run src/components/__tests__/ConfidenceBadge.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfidenceBadge.tsx src/components/__tests__/ConfidenceBadge.test.tsx
git commit -m "feat(AQ-4): add ConfidenceBadge component with tests"
```

---

### Task 9: UnansweredPanel component

**Files:**
- Create: `src/components/__tests__/UnansweredPanel.test.tsx`
- Create: `src/components/UnansweredPanel.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { UnansweredPanel } from "../UnansweredPanel";

describe("UnansweredPanel", () => {
  it("renders the unanswerable reason", () => {
    render(
      <UnansweredPanel
        reason="No clock-in/clock-out data in Skimmer."
        hint={null}
      />
    );
    expect(screen.getByText(/clock-in\/clock-out/)).toBeInTheDocument();
  });

  it("renders the partial answer hint when provided", () => {
    render(
      <UnansweredPanel
        reason="No GPS data."
        hint="I can show service addresses grouped by city/zip."
      />
    );
    expect(screen.getByText(/What I can tell you/)).toBeInTheDocument();
    expect(screen.getByText(/service addresses/)).toBeInTheDocument();
  });

  it("does not render hint section when hint is null", () => {
    render(<UnansweredPanel reason="No survey data." hint={null} />);
    expect(screen.queryByText(/What I can tell you/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/components/__tests__/UnansweredPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```tsx
interface UnansweredPanelProps {
  reason: string;
  hint: string | null;
}

export function UnansweredPanel({ reason, hint }: UnansweredPanelProps) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-2">
      <p className="text-sm text-blue-800">{reason}</p>
      {hint && (
        <p className="text-sm text-blue-700">
          <span className="font-medium">What I can tell you:</span> {hint}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --run src/components/__tests__/UnansweredPanel.test.tsx`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/UnansweredPanel.tsx src/components/__tests__/UnansweredPanel.test.tsx
git commit -m "feat(AQ-4): add UnansweredPanel component with tests"
```

---

### Task 10: Wire confidence UI into QueryView

**Files:**
- Modify: `src/views/QueryView.tsx`
- Modify: `src/services/ApiClient.ts`

- [ ] **Step 1: Update ApiClient to parse structured 422 errors**

In `src/services/ApiClient.ts`, update the error handling in the `request` method:

```typescript
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const error = await response.json();
        if (error.detail) {
          // Handle structured error (422 unanswerable)
          if (typeof error.detail === "object" && error.detail.message) {
            const err = new Error(error.detail.message) as Error & {
              confidence?: string;
              partialAnswerHint?: string | null;
            };
            err.confidence = error.detail.confidence;
            err.partialAnswerHint = error.detail.partial_answer_hint;
            throw err;
          }
          message = error.detail;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== `HTTP ${response.status}`) throw e;
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }
```

- [ ] **Step 2: Update QueryView to show confidence badges and unanswered panel**

Replace the full `QueryView` component in `src/views/QueryView.tsx`:

```tsx
import { useState } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import { SqlEditor } from "../components/SqlEditor";
import { ExportButton } from "../components/ExportButton";
import { StarterPrompts } from "../components/StarterPrompts";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { UnansweredPanel } from "../components/UnansweredPanel";
import type { QueryResponse } from "../types/api";

interface QueryViewProps {
  onAddToDashboard?: (title: string, sql: string, results: { columns: string[]; rows: (string | number | boolean | null)[][] }) => void;
}

interface UnansweredInfo {
  reason: string;
  hint: string | null;
}

export function QueryView({ onAddToDashboard }: QueryViewProps) {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [unanswered, setUnanswered] = useState<UnansweredInfo | null>(null);

  const handleQueryResult = (resp: QueryResponse) => {
    setSql(resp.sql);
    setExplanation(resp.explanation);
    setResult(resp);
    setUnanswered(null);
  };

  const handleQueryError = (err: unknown) => {
    const e = err as Error & { confidence?: string; partialAnswerHint?: string | null };
    if (e.confidence === "unanswerable") {
      setUnanswered({ reason: e.message, hint: e.partialAnswerHint ?? null });
      setError(null);
    } else {
      setError(e instanceof Error ? e.message : String(e));
      setUnanswered(null);
    }
    setResult(null);
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setHasQueried(true);
    setLoading(true);
    setError(null);
    setUnanswered(null);
    try {
      const resp = await apiClient.query(question);
      handleQueryResult(resp);
    } catch (err) {
      handleQueryError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSql = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.queryRaw(sql);
      setResult(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setQuestion(prompt);
    setTimeout(() => {
      setHasQueried(true);
      setLoading(true);
      setError(null);
      setUnanswered(null);
      apiClient.query(prompt).then((resp) => {
        handleQueryResult(resp);
        setLoading(false);
      }).catch((err) => {
        handleQueryError(err);
        setLoading(false);
      });
    }, 0);
  };

  return (
    <div className="space-y-4">
      {!hasQueried && <StarterPrompts onSelect={handlePromptSelect} />}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleAsk();
          }}
          placeholder="Ask a question about your data..."
          className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {unanswered && (
        <UnansweredPanel reason={unanswered.reason} hint={unanswered.hint} />
      )}

      {explanation && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
          {explanation}
        </div>
      )}

      {sql && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-neutral-700">Generated SQL</h3>
              <ConfidenceBadge confidence={result?.confidence ?? null} />
            </div>
            <button
              onClick={handleRunSql}
              disabled={loading || !sql.trim()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run SQL
            </button>
          </div>
          <SqlEditor value={sql} onChange={setSql} onRun={handleRunSql} />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">
              Results ({result.row_count} rows)
            </h3>
            <div className="flex gap-2">
              {onAddToDashboard && (
                <button
                  onClick={() => onAddToDashboard(question || "Query Result", sql, { columns: result.columns, rows: result.results })}
                  className="px-3 py-1.5 text-sm border border-primary-300 text-primary-700 rounded-md hover:bg-primary-50"
                >
                  + Dashboard
                </button>
              )}
              <ExportButton columns={result.columns} rows={result.results} filename="query-results" />
            </div>
          </div>
          <ResultsTable columns={result.columns} rows={result.results} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run frontend tests**

Run: `npm run test -- --run`
Expected: All existing tests PASS (+ new ConfidenceBadge and UnansweredPanel tests)

- [ ] **Step 4: Run build to check for type errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/views/QueryView.tsx src/services/ApiClient.ts
git commit -m "feat(AQ-4): wire confidence badges and unanswered panel into QueryView"
```

---

## Chunk 3: Deploy + Verify

### Task 11: Push and deploy to VPS

**Files:** None (deployment only)

- [ ] **Step 1: Push all changes**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to VPS**

```bash
ssh root@76.13.29.44 "cd /opt/splashworks && git pull && docker compose build api frontend && docker compose up -d api frontend"
```

- [ ] **Step 3: Verify API health**

```bash
ssh root@76.13.29.44 "curl -s http://localhost:8080/api/health | python3 -m json.tool"
```
Expected: `"status": "healthy"`

- [ ] **Step 4: Test rewriter end-to-end on VPS**

Test answerable query:
```bash
ssh root@76.13.29.44 "curl -s -X POST http://localhost:8080/api/query -H 'Content-Type: application/json' -d '{\"question\": \"What is the route production per tech for JOMO?\"}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f\"confidence={d.get(\"confidence\")}, rows={d.get(\"row_count\")}\")'"
```
Expected: `confidence=high, rows=<some number>`

Test unanswerable query:
```bash
ssh root@76.13.29.44 "curl -s -X POST http://localhost:8080/api/query -H 'Content-Type: application/json' -d '{\"question\": \"What is the technician utilization rate?\"}' | python3 -m json.tool"
```
Expected: HTTP 422 with `"confidence": "unanswerable"` and mention of clock-in/clock-out data

- [ ] **Step 5: Test in browser via Playwright or manually**

Navigate to `app.splshwrks.com` and try:
1. "How many active customers?" → should show green "Verified" badge
2. "What is route production per tech?" → should show green "Verified" badge
3. "What is the technician utilization rate?" → should show blue unanswered panel
4. "Show me something random" → should show yellow "Best effort" badge

- [ ] **Step 6: Commit deployment verification**

No code changes needed. Update memory if all passes.

---

## Summary

| Task | Description | Files |
|------|------------|-------|
| 1 | Industry metrics YAML | `docs/skimmer-semantic-layer.yaml` |
| 2 | Rewriter unit tests | `api/tests/unit/test_query_rewriter.py` |
| 3 | Rewriter service implementation | `api/services/query_rewriter.py` |
| 4 | Response model + ai_service + schema_context updates | 3 files |
| 5 | Wire rewriter into query router + error messages | `api/routers/query.py` |
| 6 | Deduplicate `build_tables_summary` | 2 files |
| 7 | TypeScript type updates | `src/types/api.ts` |
| 8 | ConfidenceBadge component + tests | 2 files |
| 9 | UnansweredPanel component + tests | 2 files |
| 10 | Wire into QueryView + ApiClient | 2 files |
| 11 | Deploy + verify | VPS deployment |

**Total new tests:** ~16 (8 rewriter unit + 5 badge + 3 panel)
**Total commits:** ~11
**Estimated time:** 1-2 hours for implementation, 30 min for deployment/verification

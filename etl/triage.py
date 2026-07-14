"""Pipeline failure triage: classify → log → notify with impact + recommended fix.

Called by nightly-pipeline.sh whenever a step fails (and for warning scans /
recovery tracking). Never just "alerts" — every incident carries:
  - error class (matched against a signature KB built from real incident history)
  - impact (deterministic per step: staleness vs wrongness vs outage)
  - recommended actions (specific commands / runbook pointers)

Outputs, in order of durability:
  1. Postgres audit.etl_incident_log         (queryable audit trail)
  2. data/incidents/<incident_id>.json       (survives DB outage)
  3. Slack #alerts via webhook               (SLACK_WEBHOOK_URL env, else
                                              /root/.slack_webhook file)
  4. For unknown error classes: best-effort Claude Haiku enrichment
     (ANTHROPIC_API_KEY env or .env; hard timeout; never blocks the pipeline)

Triage itself must NEVER break the pipeline — every side effect is guarded.

Usage:
    python3 -m etl.triage --step {sync,etl,dbt,reconcile,health} \
        --exit-code N --log-file data/pipeline.log
    python3 -m etl.triage --scan-warnings --log-file data/pipeline.log
    python3 -m etl.triage --record-success
"""

import argparse
import json
import os
import re
import socket
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
INCIDENT_DIR = PROJECT_DIR / "data" / "incidents"
STATE_FILE = PROJECT_DIR / "data" / ".pipeline_state.json"
WEBHOOK_FILE = "/root/.slack_webhook"
LOG_EXCERPT_LINES = 40

# --- Failure signature knowledge base ---------------------------------------
# Matched in order against the log excerpt. Built from real incidents
# (runbook 2026-05-vps-migration Issues #1-#4, CLERMONT onboarding 2026-07).
SIGNATURES = [
    {
        "pattern": r"ModuleNotFoundError: No module named",
        "error_class": "missing_python_dependency",
        "severity": "high",
        "fix": [
            "Check the venv exists and pipeline activated it (log should show 'Using venv'): ls /opt/splashworks/.venv/bin/activate",
            "Reinstall deps: source /opt/splashworks/.venv/bin/activate && pip install -r etl/requirements.txt",
            "Runbook: docs/runbooks/2026-05-vps-migration.md Issue #4 (host deps are NOT containerized)",
        ],
    },
    {
        "pattern": r"dbt: command not found|exit 127",
        "error_class": "dbt_not_on_path",
        "severity": "high",
        "fix": [
            "Venv missing or not activated. Verify: source /opt/splashworks/.venv/bin/activate && which dbt",
            "If missing: pip install 'dbt-postgres==1.9.1' (pin! bare install resolves a BETA dbt-core)",
            "Runbook: docs/runbooks/2026-05-vps-migration.md Issue #4",
        ],
    },
    {
        "pattern": r"package\(s\) specified in packages\.yml|Run \"dbt deps\"",
        "error_class": "dbt_deps_missing",
        "severity": "high",
        "fix": [
            "cd /opt/splashworks/dbt && source ../.venv/bin/activate && dbt deps --profiles-dir .",
            "Then re-run: ./etl/scripts/nightly-pipeline.sh --skip-sync",
        ],
    },
    {
        "pattern": r"Compilation Error|Parsing Error|not found in the project",
        "error_class": "dbt_model_error",
        "severity": "high",
        "fix": [
            "A model/macro/source is broken — almost always a recent merge. Check: git log --oneline -5 -- dbt/",
            "Reproduce: cd dbt && dbt run --profiles-dir . --select <failing_model>",
            "If a bad merge: revert the commit on main and redeploy",
        ],
    },
    {
        "pattern": r"could not connect|Connection refused|connection to server|is the server running",
        "error_class": "postgres_unreachable",
        "severity": "critical",
        "fix": [
            "docker compose ps postgres  (expect 'healthy')",
            "docker compose logs --tail=50 postgres",
            "If down: docker compose up -d postgres (data is on the pg_data volume)",
        ],
    },
    {
        "pattern": r"AADSTS|invalid_grant|token.*(expired|revoked)|401 Unauthorized|couldn't fetch token",
        "error_class": "onedrive_auth_expired",
        "severity": "medium",
        "fix": [
            "rclone OneDrive token expired — reconnect: rclone config reconnect onedrive: (interactive, needs Ross)",
            "Pipeline continues on yesterday's extracts meanwhile (sync failure is non-fatal by design)",
        ],
    },
    {
        "pattern": r"No space left on device|disk full",
        "error_class": "disk_full",
        "severity": "critical",
        "fix": [
            "df -h  — identify the full mount",
            "Quick wins: docker system prune -f; rm /tmp/*.dump; check data/extracts for stray decompressed .db files",
        ],
    },
    {
        "pattern": r"WARNING: unmapped extract skipped: (\S+)",
        "error_class": "unmapped_extract",
        "severity": "medium",
        "fix": [
            "A new Skimmer company extract arrived that is not onboarded — it is being SKIPPED nightly until mapped",
            "Onboard it: add the file stem to etl/config.py COMPANY_MAP, then follow CLAUDE.md 'Data Sources' (union_companies macro, _sources.yml, schema_context.py)",
            "Reference onboarding: PR #21 (CLERMONT, 2026-07-04)",
        ],
    },
    {
        "pattern": r"ERROR - .* is not a view|identifier .* will be truncated",
        "error_class": "identifier_truncation",
        "severity": "high",
        "fix": [
            "A table prefix is exceeding Postgres's 63-char identifier limit (usually an unmapped UUID-stem company)",
            "Map the company in etl/config.py COMPANY_MAP, then drop the misprefixed raw tables + purge its etl_load_log rows (see PR #21 cleanup)",
        ],
    },
]

# --- Deterministic impact per step (independent of error class) -------------
STEP_IMPACT = {
    "sync": (
        "Extract sync failed — pipeline continues on the PREVIOUS night's extracts. "
        "Warehouse stays internally consistent but is one day stale. No user-facing breakage."
    ),
    "etl": (
        "Raw layer NOT refreshed and pipeline aborted before dbt — the entire warehouse "
        "(app, BI, Ripple answers) is serving data from the last successful run. "
        "Data is STALE, not wrong. Each additional failed night widens the gap."
    ),
    "dbt": (
        "Raw layer IS fresh but warehouse/semantic models were NOT rebuilt — dashboards and "
        "AI queries serve the previous build while raw holds newer data (layer mismatch). "
        "Reconciliation did not run, so this state is UNVERIFIED."
    ),
    "reconcile": (
        "Data loaded and transformed, but reconciliation found raw↔warehouse discrepancies — "
        "numbers in the warehouse may be WRONG (worse than stale). Treat affected metrics as "
        "untrusted until the failing checks are explained."
    ),
    "health": (
        "Post-pipeline API health check failed — app.splshwrks.com may be down or degraded "
        "for users right now. Data pipeline itself completed."
    ),
}

SEVERITY_EMOJI = {"critical": "🔴", "high": "🔴", "medium": "🟠", "low": "🟡", "info": "🟢"}

SECRET_PATTERNS = [
    (re.compile(r"(?i)(password|passwd|secret|token|api_?key)\s*[=:]\s*\S+"), r"\1=***"),
    (re.compile(r"(postgresql|postgres)://([^:/\s]+):[^@\s]+@"), r"\1://\2:***@"),
    (re.compile(r"sk-ant-[A-Za-z0-9_\-]+"), "sk-ant-***"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{20,}"), "<jwt>***"),
]


def scrub(text: str) -> str:
    for pat, repl in SECRET_PATTERNS:
        text = pat.sub(repl, text)
    return text


def read_log_tail(log_file: str, lines: int = LOG_EXCERPT_LINES) -> str:
    try:
        content = Path(log_file).read_text(errors="replace").splitlines()
        return scrub("\n".join(content[-lines:]))
    except Exception:
        return "(log unavailable)"


def classify(excerpt: str) -> dict:
    for sig in SIGNATURES:
        if re.search(sig["pattern"], excerpt):
            return sig
    return {
        "pattern": None,
        "error_class": "unknown",
        "severity": "high",
        "fix": [
            "No known signature matched — see the log excerpt and LLM analysis (if present) below",
            "Full log: /opt/splashworks/data/pipeline.log (+ data/pipeline-cron.log for cron runs)",
            "Re-run interactively: ./etl/scripts/nightly-pipeline.sh --skip-sync",
        ],
    }


def reconcile_detail() -> str:
    """Pull failing-check specifics out of reconciliation.json."""
    try:
        report = json.loads((PROJECT_DIR / "data" / "reconciliation.json").read_text())
        failing = [c for c in report.get("checks", []) if c.get("status") in ("fail", "error")]
        if not failing:
            return ""
        lines = ["Failing checks:"]
        for c in failing:
            lines.append(f"  • {c.get('name')}: {str(c.get('detail'))[:300]}")
        return "\n".join(lines)
    except Exception:
        return ""


def llm_enrichment(step: str, excerpt: str) -> str:
    """Best-effort Claude Haiku analysis for unknown error classes."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        try:
            for line in (PROJECT_DIR / ".env").read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    break
        except Exception:
            pass
    if not key:
        return ""
    try:
        body = json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 400,
            "messages": [{
                "role": "user",
                "content": (
                    f"A nightly data-pipeline step '{step}' failed on a Linux VPS "
                    f"(Python ETL SQLite→Postgres, dbt, Docker Compose). Log tail:\n\n{excerpt[-3000:]}\n\n"
                    "In <=120 words: (1) probable root cause, (2) 2-3 specific fix actions. Plain text."
                ),
            }],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
        return data["content"][0]["text"].strip()
    except Exception:
        return ""


def ensure_incident_table(conn) -> None:
    with conn.cursor() as cur:
        # Isolated from the read-only API role — see docs/SECURITY_AUDIT_2026-07-14.md.
        cur.execute("CREATE SCHEMA IF NOT EXISTS audit")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit.etl_incident_log (
                id SERIAL PRIMARY KEY,
                incident_id TEXT NOT NULL,
                occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                step TEXT NOT NULL,
                exit_code INTEGER,
                severity TEXT NOT NULL,
                error_class TEXT NOT NULL,
                impact TEXT,
                recommended_actions TEXT,
                log_excerpt TEXT,
                llm_enrichment TEXT,
                notified BOOLEAN NOT NULL DEFAULT FALSE,
                resolved_at TIMESTAMPTZ
            )
        """)
    conn.commit()


def write_db(incident: dict) -> bool:
    try:
        import psycopg2
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        ensure_incident_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO audit.etl_incident_log
                   (incident_id, step, exit_code, severity, error_class, impact,
                    recommended_actions, log_excerpt, llm_enrichment, notified)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    incident["incident_id"], incident["step"], incident["exit_code"],
                    incident["severity"], incident["error_class"], incident["impact"],
                    "\n".join(incident["recommended_actions"]), incident["log_excerpt"],
                    incident.get("llm_enrichment", ""), incident.get("notified", False),
                ),
            )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"  triage: DB write failed ({e}) — incident preserved as JSON")
        return False


def write_json(incident: dict) -> str:
    try:
        INCIDENT_DIR.mkdir(parents=True, exist_ok=True)
        path = INCIDENT_DIR / f"{incident['incident_id']}.json"
        path.write_text(json.dumps(incident, indent=2, default=str))
        return str(path)
    except Exception as e:
        print(f"  triage: JSON write failed ({e})")
        return ""


def webhook_url() -> str:
    url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if url:
        return url
    try:
        return Path(WEBHOOK_FILE).read_text().strip()
    except Exception:
        return ""


def notify_slack(text: str) -> bool:
    url = webhook_url()
    if not url:
        print("  triage: no Slack webhook configured — notification skipped (incident still logged)")
        return False
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15):
            pass
        return True
    except Exception as e:
        print(f"  triage: Slack notify failed ({e})")
        return False


def git_sha() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=PROJECT_DIR,
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except Exception:
        return "?"


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2))
    except Exception:
        pass


def build_message(incident: dict) -> str:
    emoji = SEVERITY_EMOJI.get(incident["severity"], "🔴")
    actions = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(incident["recommended_actions"]))
    msg = (
        f"{emoji} *Nightly pipeline: step `{incident['step']}` {incident['event']}* "
        f"on {incident['host']} (git {incident['git_sha']})\n"
        f"*Error class:* `{incident['error_class']}` (severity: {incident['severity']})\n"
        f"*Impact:* {incident['impact']}\n"
        f"*Recommended actions:*\n{actions}\n"
    )
    if incident.get("extra_detail"):
        msg += f"*Detail:*\n```{incident['extra_detail'][:800]}```\n"
    if incident.get("llm_enrichment"):
        msg += f"*AI analysis (unknown signature):*\n> {incident['llm_enrichment'][:600]}\n"
    msg += (
        f"*Log excerpt (last lines):*\n```{incident['log_excerpt'][-900:]}```\n"
        f"_Incident `{incident['incident_id']}` — full record in etl_incident_log + data/incidents/_"
    )
    return msg


STEP_CLASS_OVERRIDES = {
    "reconcile": {
        "error_class": "reconciliation_discrepancy",
        "severity": "critical",
        "fix": [
            "Read the failing checks in data/reconciliation.json (specifics in 'Detail' above)",
            "Check for schema drift first: SELECT * FROM public.etl_schema_drift ORDER BY detected_at DESC LIMIT 10",
            "Compare the affected company's extract vs raw: gunzip + sqlite3 counts vs raw_skimmer counts (see 'Ad Hoc Query Workflow' in CLAUDE.md)",
            "If a dbt model changed recently: git log --oneline -5 -- dbt/models/",
            "Do NOT 'fix' by re-running with --full-refresh — that destroys accumulated fact history",
        ],
    },
    "health": {
        "error_class": "api_unhealthy",
        "severity": "critical",
        "fix": [
            "docker compose ps  (is splashworks-api Up?)",
            "docker compose logs --tail=50 api",
            "curl -s http://localhost:8080/api/health — if the container is up but unhealthy, check DB connectivity from it",
            "Restart if needed: docker compose up -d api  (NOT 'restart' if .env changed)",
        ],
    },
}


def triage_failure(step: str, exit_code: int, log_file: str, event: str = "FAILED") -> None:
    excerpt = read_log_tail(log_file)
    sig = classify(excerpt)
    # For reconcile/health, a generic log-signature miss should not read as
    # "unknown" — these steps have well-defined failure semantics of their own.
    if sig["error_class"] == "unknown" and step in STEP_CLASS_OVERRIDES:
        sig = {**sig, **STEP_CLASS_OVERRIDES[step]}
    now = datetime.now(timezone.utc)
    incident = {
        "incident_id": f"{now.strftime('%Y%m%dT%H%M%SZ')}-{step}",
        "occurred_at": now.isoformat(),
        "event": event,
        "step": step,
        "exit_code": exit_code,
        "severity": sig["severity"],
        "error_class": sig["error_class"],
        "impact": STEP_IMPACT.get(step, "Unknown step — inspect manually."),
        "recommended_actions": sig["fix"],
        "log_excerpt": excerpt,
        "host": socket.gethostname(),
        "git_sha": git_sha(),
    }
    if step == "reconcile":
        incident["extra_detail"] = reconcile_detail()
    if sig["error_class"] == "unknown":
        incident["llm_enrichment"] = llm_enrichment(step, excerpt)

    incident["notified"] = notify_slack(build_message(incident))
    write_json(incident)
    write_db(incident)

    state = load_state()
    state["last_run_status"] = "fail"
    state["last_failure"] = {"step": step, "incident_id": incident["incident_id"],
                             "error_class": incident["error_class"], "at": incident["occurred_at"]}
    save_state(state)
    print(f"  triage: incident {incident['incident_id']} logged "
          f"(class={incident['error_class']}, notified={incident['notified']})")


def scan_warnings(log_file: str) -> None:
    """Non-fatal conditions that still deserve a triaged notification (e.g. an
    unmapped company extract being skipped every night)."""
    excerpt = read_log_tail(log_file, lines=200)
    m = re.search(r"WARNING: unmapped extract skipped: (\S+)", excerpt)
    if not m:
        return
    state = load_state()
    stem = m.group(1)
    # notify once per distinct file per 7 days, not every night
    seen = state.get("warned_unmapped", {})
    last = seen.get(stem)
    if last:
        try:
            age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).days
            if age_days < 7:
                return
        except Exception:
            pass
    triage_failure("etl", 0, log_file, event="WARNING (unmapped extract)")
    seen[stem] = datetime.now(timezone.utc).isoformat()
    state["warned_unmapped"] = seen
    save_state(state)


def record_success() -> None:
    state = load_state()
    if state.get("last_run_status") == "fail":
        prev = state.get("last_failure", {})
        sent = notify_slack(
            f"✅ *Nightly pipeline RECOVERED* on {socket.gethostname()} — full run green "
            f"(previous failure: step `{prev.get('step','?')}`, class `{prev.get('error_class','?')}`, "
            f"incident `{prev.get('incident_id','?')}`)."
        )
        print(f"  triage: recovery detected (notification {'sent' if sent else 'skipped — no webhook'})")
    state["last_run_status"] = "pass"
    state["last_success_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--step", choices=["sync", "etl", "dbt", "reconcile", "health"])
    p.add_argument("--exit-code", type=int, default=1)
    p.add_argument("--log-file", default=str(PROJECT_DIR / "data" / "pipeline.log"))
    p.add_argument("--scan-warnings", action="store_true")
    p.add_argument("--record-success", action="store_true")
    args = p.parse_args()

    if args.record_success:
        record_success()
    elif args.scan_warnings:
        scan_warnings(args.log_file)
    elif args.step:
        triage_failure(args.step, args.exit_code, args.log_file)
    else:
        p.print_help()
        sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # triage must never propagate a failure into the pipeline
        print(f"  triage: internal error ({e}) — continuing")
        sys.exit(0)

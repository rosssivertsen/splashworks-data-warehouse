"""Nightly ingestion report — status + statistics, emailed to Ross every run.

Called from nightly-pipeline.sh's EXIT trap so it fires on EVERY run, success or
failure (even when the pipeline aborts mid-way). Computes the *real* status from
three signals — the pipeline outcome, the reconciliation result, and data
freshness (extract date vs today) — so a green pipeline can never hide stale or
unvalidated data.

Delivery:
  - Email via SMTP if mail config is present (env or /root/.mail_env).
  - Slack #alerts webhook always, as a backup channel (never leaves Ross with
    no notification if email is misconfigured).

Usage:
  python3 -m etl.report --outcome success|failed --last-step <step> --exit-code N
"""
import argparse
import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import psycopg2

PROJECT_DIR = Path(__file__).resolve().parent.parent
RECON_PATH = PROJECT_DIR / "data" / "reconciliation.json"
MAIL_ENV_PATH = os.environ.get("MAIL_CONFIG", "/root/.mail_env")
SLACK_WEBHOOK_FILE = "/root/.slack_webhook"


def _load_mail_env() -> dict:
    """Read SMTP config from /root/.mail_env (KEY=VALUE), overlaid by real env."""
    cfg = {}
    p = Path(MAIL_ENV_PATH)
    if p.is_file():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("MAIL_TO", "MAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_USER",
              "SMTP_PASS", "SLACK_MENTION", "RESEND_API_KEY"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def gather_stats() -> dict:
    """Pull the latest run's ingestion stats + reconciliation + freshness."""
    stats = {"companies": [], "recon": None, "freshness": {}, "run": {}}
    dsn = os.environ["DATABASE_URL"]
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        # Latest run = rows within 30 min of the most recent load start.
        cur.execute("""
            WITH latest AS (SELECT max(load_started_at) AS t FROM public.etl_load_log)
            SELECT company_name,
                   max(extract_date)::text          AS extract_date,
                   count(*)                          AS tables_loaded,
                   coalesce(sum(row_count), 0)       AS rows_loaded,
                   bool_and(status IN ('completed', 'success')
                            AND load_completed_at IS NOT NULL) AS all_ok,
                   min(load_started_at)              AS started,
                   max(load_completed_at)            AS completed
            FROM public.etl_load_log, latest
            WHERE load_started_at >= latest.t - interval '30 minutes'
            GROUP BY company_name
            ORDER BY company_name
        """)
        for row in cur.fetchall():
            stats["companies"].append({
                "company": row[0], "extract_date": row[1], "tables": row[2],
                "rows": int(row[3]), "ok": row[4],
                "started": row[5], "completed": row[6],
            })
    # Freshness: newest extract_date vs today (UTC).
    today = datetime.now(timezone.utc).date().isoformat()
    dates = [c["extract_date"] for c in stats["companies"] if c["extract_date"]]
    newest = max(dates) if dates else None
    stats["freshness"] = {"today": today, "newest_extract": newest, "stale": bool(newest and newest < today)}
    # Reconciliation
    if RECON_PATH.is_file():
        try:
            stats["recon"] = json.loads(RECON_PATH.read_text())
        except Exception:
            stats["recon"] = None
    return stats


def decide_status(outcome: str, stats: dict) -> str:
    """Worst of pipeline outcome, reconciliation, and freshness."""
    if outcome != "success":
        return "FAILED"
    if any(not c["ok"] for c in stats["companies"]):
        return "FAILED"
    recon = (stats.get("recon") or {}).get("status")
    if recon == "fail":
        return "FAILED"
    if recon == "warn" or stats["freshness"]["stale"]:
        return "WARNING"
    return "SUCCESS"


def render(status: str, outcome: str, last_step: str, exit_code: int, stats: dict) -> tuple[str, str, str]:
    """Return (subject, text_body, html_body)."""
    fr = stats["freshness"]
    total_rows = sum(c["rows"] for c in stats["companies"])
    companies = "/".join(c["company"] for c in stats["companies"]) or "—"
    emoji = {"SUCCESS": "✅", "WARNING": "⚠️", "FAILED": "🔴"}.get(status, "")
    subject = f"[Splashworks DW] Nightly ingestion {status} — {fr['today']} ({companies}, {total_rows:,} rows)"

    lines = [f"{emoji} Nightly ingestion: {status}", f"Run date (UTC): {fr['today']}", ""]
    if status == "FAILED" and outcome != "success":
        lines.append(f"Pipeline FAILED at step '{last_step}' (exit {exit_code}).")
        lines.append("")
    # Freshness
    if fr["stale"]:
        lines.append(f"⚠ STALE DATA: newest extract is {fr['newest_extract']}, expected {fr['today']}.")
    else:
        lines.append(f"Freshness OK: extract date {fr['newest_extract']}.")
    lines.append("")
    # Per-company ingestion
    lines.append("Ingestion by company:")
    for c in stats["companies"]:
        flag = "ok" if c["ok"] else "FAILED"
        lines.append(f"  {c['company']:9} extract {c['extract_date']}  {c['tables']:>2} tables  {c['rows']:>10,} rows  [{flag}]")
    lines.append(f"  {'TOTAL':9} {'':>32} {total_rows:>10,} rows")
    lines.append("")
    # Reconciliation
    recon = stats.get("recon")
    if recon:
        checks = recon.get("checks", [])
        npass = sum(1 for c in checks if c["status"] == "pass")
        issues = [c for c in checks if c["status"] != "pass"]
        lines.append(f"Reconciliation: {npass}/{len(checks)} passed (overall: {recon.get('status')})")
        for c in issues:
            lines.append(f"  {c['status'].upper()}: {c['name']} — {c.get('detail', '')[:200]}")
    else:
        lines.append("Reconciliation: (no report found)")
    text = "\n".join(lines)

    # Minimal HTML (inline styles; renders in any client)
    color = {"SUCCESS": "#1a7f37", "WARNING": "#9a6700", "FAILED": "#cf222e"}.get(status, "#333")
    rows_html = "".join(
        f"<tr><td>{c['company']}</td><td>{c['extract_date']}</td><td align='right'>{c['tables']}</td>"
        f"<td align='right'>{c['rows']:,}</td><td>{'ok' if c['ok'] else 'FAILED'}</td></tr>"
        for c in stats["companies"]
    )
    recon_html = ""
    if recon:
        checks = recon.get("checks", [])
        npass = sum(1 for c in checks if c["status"] == "pass")
        issues = "".join(
            f"<li><b>{c['status'].upper()}</b>: {c['name']} — {c.get('detail','')[:300]}</li>"
            for c in checks if c["status"] != "pass"
        )
        recon_html = (f"<p><b>Reconciliation:</b> {npass}/{len(checks)} passed "
                      f"(overall: {recon.get('status')})</p>"
                      + (f"<ul>{issues}</ul>" if issues else ""))
    stale_html = (f"<p style='color:#9a6700'><b>⚠ STALE:</b> newest extract {fr['newest_extract']}, "
                  f"expected {fr['today']}.</p>" if fr["stale"] else
                  f"<p>Freshness OK: extract date {fr['newest_extract']}.</p>")
    fail_html = (f"<p style='color:#cf222e'>Pipeline FAILED at step '<b>{last_step}</b>' (exit {exit_code}).</p>"
                 if status == "FAILED" and outcome != "success" else "")
    html = f"""<html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#24292f">
      <h2 style="color:{color}">{emoji} Nightly ingestion: {status}</h2>
      <p>Run date (UTC): <b>{fr['today']}</b></p>
      {fail_html}{stale_html}
      <h3>Ingestion by company</h3>
      <table cellpadding="6" style="border-collapse:collapse" border="1">
        <tr style="background:#f6f8fa"><th>Company</th><th>Extract date</th><th>Tables</th><th>Rows</th><th>Status</th></tr>
        {rows_html}
        <tr style="font-weight:bold"><td colspan="3">TOTAL</td><td align="right">{total_rows:,}</td><td></td></tr>
      </table>
      {recon_html}
      <p style="color:#57606a;font-size:12px">Splashworks Data Warehouse · automated nightly report</p>
    </body></html>"""
    return subject, text, html


def send_email_resend(subject: str, text: str, html: str, cfg: dict) -> str:
    """Send via Resend's HTTP API. Chosen over M365 SMTP because both tenants have
    SmtpClientAuthentication disabled (Microsoft's default), and enabling it would
    mean re-opening legacy basic auth just to send a stats email. This report
    carries no customer PII — only row counts, company names, and check results."""
    payload = json.dumps({
        "from": cfg.get("MAIL_FROM", "onboarding@resend.dev"),
        "to": [cfg["MAIL_TO"]],
        "subject": subject,
        "text": text,
        "html": html,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload,
        headers={"Authorization": f"Bearer {cfg['RESEND_API_KEY']}",
                 "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        return f"email: sent via Resend to {cfg['MAIL_TO']}"
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        return f"email: FAILED (Resend HTTP {e.code}: {detail})"
    except Exception as e:
        return f"email: FAILED (Resend: {e})"


def send_email(subject: str, text: str, html: str, cfg: dict) -> str:
    # Resend takes precedence when configured; SMTP remains as a fallback path.
    if cfg.get("RESEND_API_KEY") and cfg.get("MAIL_TO"):
        return send_email_resend(subject, text, html, cfg)
    required = ("MAIL_TO", "MAIL_FROM", "SMTP_HOST", "SMTP_PORT")
    if not all(cfg.get(k) for k in required):
        return "email: skipped (no mail config)"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["MAIL_FROM"]
    msg["To"] = cfg["MAIL_TO"]
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    host, port = cfg["SMTP_HOST"], int(cfg["SMTP_PORT"])
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as s:
                if cfg.get("SMTP_USER"):
                    s.login(cfg["SMTP_USER"], cfg.get("SMTP_PASS", ""))
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=ssl.create_default_context())
                if cfg.get("SMTP_USER"):
                    s.login(cfg["SMTP_USER"], cfg.get("SMTP_PASS", ""))
                s.send_message(msg)
        return f"email: sent to {cfg['MAIL_TO']}"
    except Exception as e:
        return f"email: FAILED ({e})"


def send_slack(subject: str, text: str, mention: str = "") -> str:
    """Post the report. `mention` (e.g. "<@UEKC16A5T>") makes it a real Slack
    mention — a bare webhook post does NOT notify channel members whose channel
    prefs are 'mentions only', which is why the report can land correctly and
    still go unnoticed."""
    url = os.environ.get("SLACK_WEBHOOK_URL")
    if not url and Path(SLACK_WEBHOOK_FILE).is_file():
        url = Path(SLACK_WEBHOOK_FILE).read_text().strip()
    if not url:
        return "slack: skipped (no webhook)"
    prefix = f"{mention} " if mention else ""
    payload = json.dumps({"text": f"{prefix}*{subject}*\n```{text}```"}).encode()
    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=15)
        return "slack: sent"
    except Exception as e:
        return f"slack: FAILED ({e})"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outcome", default="success", choices=["success", "failed"])
    ap.add_argument("--last-step", default="")
    ap.add_argument("--exit-code", type=int, default=0)
    args = ap.parse_args()

    try:
        stats = gather_stats()
    except Exception as e:
        # Even if stat-gathering fails, still notify that the run happened.
        stats = {"companies": [], "recon": None,
                 "freshness": {"today": datetime.now(timezone.utc).date().isoformat(),
                               "newest_extract": None, "stale": False},
                 "_gather_error": str(e)}

    status = decide_status(args.outcome, stats)
    subject, text, html = render(status, args.outcome, args.last_step, args.exit_code, stats)
    if stats.get("_gather_error"):
        text += f"\n\n(note: stats gathering error: {stats['_gather_error']})"

    cfg = _load_mail_env()
    print(send_email(subject, text, html, cfg))
    print(send_slack(subject, text, cfg.get("SLACK_MENTION", "")))


if __name__ == "__main__":
    main()

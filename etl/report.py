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
import glob
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

from etl import status_page

PROJECT_DIR = Path(__file__).resolve().parent.parent
PIPELINE_LOG = str(PROJECT_DIR / "data" / "pipeline.log")
RECON_PATH = PROJECT_DIR / "data" / "reconciliation.json"
MAIL_ENV_PATH = os.environ.get("MAIL_CONFIG", "/root/.mail_env")
SLACK_WEBHOOK_FILE = "/root/.slack_webhook"
SFTP_MANIFEST_GLOB = "/srv/sftp/*/extracts/MANIFEST.txt"


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
        # dbt model count (tables + views across the dbt schemas) and open incidents.
        try:
            cur.execute("""SELECT count(*) FROM information_schema.tables
                           WHERE table_schema IN ('public_staging','public_warehouse','public_semantic')""")
            stats["model_count"] = cur.fetchone()[0]
        except Exception:
            stats["model_count"] = None
        try:
            cur.execute("SELECT count(*) FROM audit.etl_incident_log WHERE resolved_at IS NULL")
            stats["incidents"] = cur.fetchone()[0]
        except Exception:
            stats["incidents"] = 0
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


def gather_delivery(companies: list) -> dict:
    """Read each partner SFTP jail's MANIFEST.txt to confirm what was published:
    filename, sha256, size, source date — plus the row count for that company
    (from ingestion) so the report proves both delivery AND the data behind it.
    Returns {"accounts": [...], "files": [...], "published": bool}."""
    rows_by_company = {c["company"]: c["rows"] for c in companies}
    manifests = sorted(glob.glob(SFTP_MANIFEST_GLOB))
    accounts = sorted(os.path.basename(os.path.dirname(os.path.dirname(m))) for m in manifests)
    if not manifests:
        return {"accounts": [], "files": [], "published": False}
    # All jails publish an identical file set (per entitlements), so parse one.
    files, published = [], None
    for line in Path(manifests[0]).read_text().splitlines():
        line = line.strip()
        if line.startswith("# published:"):
            published = line.split(":", 1)[1].strip()
        elif line and not line.startswith("#"):
            parts = line.split()
            if len(parts) >= 4:
                fname, sha, size, mtime = parts[0], parts[1], parts[2], parts[3]
                company = fname.replace(".db.gz", "")
                files.append({
                    "file": fname, "sha256": sha, "bytes": int(size),
                    "source_mtime": mtime, "rows": rows_by_company.get(company),
                })
    return {"accounts": accounts, "files": files, "published_at": published,
            "published": bool(files)}


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
    # Partner delivery (SFTP)
    delivery = stats.get("delivery") or {}
    lines.append("")
    if delivery.get("published"):
        accts = ", ".join(delivery.get("accounts", [])) or "—"
        lines.append(f"Partner delivery (SFTP) — published {delivery.get('published_at','?')} to: {accts}")
        for f in delivery["files"]:
            rows = f"{f['rows']:,} rows" if f.get("rows") is not None else "rows n/a"
            mb = f["bytes"] / 1_000_000
            lines.append(f"  {f['file']:16} {mb:7.1f} MB  {rows:>14}  sha256 {f['sha256'][:16]}…")
    else:
        lines.append("Partner delivery (SFTP): nothing published (no jail manifest found)")
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
    # Partner delivery (SFTP) HTML
    delivery = stats.get("delivery") or {}
    if delivery.get("published"):
        drows = "".join(
            f"<tr><td><code>{f['file']}</code></td><td align='right'>{f['bytes']/1_000_000:.1f} MB</td>"
            f"<td align='right'>{f['rows']:,}</td><td><code>{f['sha256']}</code></td>"
            f"<td>{f['source_mtime']}</td></tr>"
            for f in delivery["files"] if f.get("rows") is not None
        )
        delivery_html = (
            f"<h3>Partner delivery (SFTP)</h3>"
            f"<p>Published <b>{delivery.get('published_at','?')}</b> to: "
            f"{', '.join('<code>%s</code>' % a for a in delivery.get('accounts', [])) or '—'}</p>"
            f"<table cellpadding='6' style='border-collapse:collapse' border='1'>"
            f"<tr style='background:#f6f8fa'><th>File</th><th>Size</th><th>Rows</th><th>SHA-256</th><th>Extract date</th></tr>"
            f"{drows}</table>"
        )
    else:
        delivery_html = "<h3>Partner delivery (SFTP)</h3><p>Nothing published (no jail manifest found).</p>"
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
      {delivery_html}
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
                 "Content-Type": "application/json",
                 # Resend's API is behind Cloudflare, which blocks urllib's default
                 # "Python-urllib/3.x" UA with HTTP 403 / error 1010. Verified: the
                 # identical request succeeds with any normal UA and fails with that
                 # one. Do not remove this header.
                 "User-Agent": "splashworks-dw-report/1.0"},
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


def gather_run_meta(log_path: str) -> dict:
    """Parse the last pipeline run's start/end from pipeline.log → run_date,
    run_time (start HH:MM), and human duration. Best-effort with safe fallbacks."""
    from datetime import datetime as _dt
    meta = {"run_date": datetime.now(timezone.utc).date().isoformat(), "run_time": "", "duration": "—"}
    try:
        text = Path(log_path).read_text()
        starts = re.findall(r"(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d)Z\s+=== Pipeline starting ===", text)
        ends = re.findall(r"\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d)Z\s+=== Pipeline complete ===", text)
        if starts:
            date, st = starts[-1]
            meta["run_date"], meta["run_time"] = date, st[:5]
            if ends:
                t0 = _dt.strptime(st, "%H:%M:%S")
                t1 = _dt.strptime(ends[-1], "%H:%M:%S")
                secs = int((t1 - t0).total_seconds()) % 86400
                meta["duration"] = f"{secs // 60} min {secs % 60:02d} s" if secs >= 60 else f"{secs} s"
    except Exception:
        pass
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outcome", default="success", choices=["success", "failed"])
    ap.add_argument("--last-step", default="")
    ap.add_argument("--exit-code", type=int, default=0)
    ap.add_argument("--html-out", default="", help="also write the dashboard HTML to this path (hosted status page)")
    args = ap.parse_args()

    try:
        stats = gather_stats()
    except Exception as e:
        # Even if stat-gathering fails, still notify that the run happened.
        stats = {"companies": [], "recon": None,
                 "freshness": {"today": datetime.now(timezone.utc).date().isoformat(),
                               "newest_extract": None, "stale": False},
                 "_gather_error": str(e)}

    try:
        stats["delivery"] = gather_delivery(stats.get("companies", []))
    except Exception as e:
        stats["delivery"] = {"published": False, "accounts": [], "files": [], "_error": str(e)}

    status = decide_status(args.outcome, stats)
    subject, text, _simple_html = render(status, args.outcome, args.last_step, args.exit_code, stats)
    if stats.get("_gather_error"):
        text += f"\n\n(note: stats gathering error: {stats['_gather_error']})"

    # Rich dashboard — the email body, the hosted status page, and a forwardable
    # artifact all come from one render.
    meta = gather_run_meta(PIPELINE_LOG)
    meta.update(status=status, model_count=stats.get("model_count"), incidents=stats.get("incidents", 0))
    # Two renderings: rich CSS for the hosted page (browser), email-safe table
    # HTML for the email body (Outlook strips the rich CSS entirely).
    try:
        dashboard_html = status_page.render(stats, meta, PIPELINE_LOG)
    except Exception as e:
        dashboard_html = _simple_html
        print(f"dashboard render failed, using simple HTML: {e}")
    try:
        email_html = status_page.render_email(stats, meta)
    except Exception as e:
        email_html = _simple_html
        print(f"email render failed, using simple HTML: {e}")

    if args.html_out:
        try:
            out = Path(args.html_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(dashboard_html)
            print(f"html: wrote {args.html_out}")
        except Exception as e:
            print(f"html: FAILED ({e})")

    cfg = _load_mail_env()
    print(send_email(subject, text, email_html, cfg))
    print(send_slack(subject, text, cfg.get("SLACK_MENTION", "")))


if __name__ == "__main__":
    main()

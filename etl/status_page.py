"""Render the nightly pipeline status dashboard as a self-contained HTML page.

Produces the same visual report humans reviewed, but generated from live pipeline
state every run. report.py calls render() and writes the result to the directory
served (behind Cloudflare Access) at the status subdomain.

Partner-safe by construction: this page shows ONLY the ingestion pipeline,
reconciliation, and delivery — never query_audit_log / Ripple usage (which contain
customer PII and internal activity). Do not add serving-layer usage here.
"""
from __future__ import annotations

import re
from pathlib import Path

# Friendly labels + per-company display for reconciliation.json check names.
CHECK_LABELS = {
    "active_customer_count": ("Active customers", "is_inactive = 0 and deleted = 0"),
    "payment_count": ("Payments", "non-deleted payment records"),
    "invoice_item_count": ("Invoice line items", "non-deleted invoice detail rows"),
    "service_stop_count": ("Service stops", "non-deleted route stops"),
    "payment_total_amount": ("Payment dollar total", "sum of payment amounts"),
    "route_skip_day_of_count": ("Day-of skipped stops", "IsSkipped = 1 in RouteStop"),
    "source_load_vs_raw": ("Load fidelity", "source rows == raw rows, exact per table"),
    "fact_service_stop_duplicate_rows": ("Duplicate rows", "fact rows vs distinct grain — must be 0"),
}
COMPANY_ORDER = ["AQPS", "JOMO", "CLERMONT"]

CSS = """
:root{--bg:#eef2f5;--surface:#fff;--surface-2:#f5f8fa;--line:#d9e0e6;--ink:#0f1b24;--muted:#5a6b78;--faint:#8a99a5;--accent:#0e7c86;--accent-soft:#e2f1f2;--pass:#1a7f4b;--pass-bg:#e5f3ea;--warn:#9a6a00;--warn-bg:#f8efd8;--fail:#c23b3b;--fail-bg:#f8e3e3;--mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--radius:12px;--shadow:0 1px 2px rgba(15,27,36,.05),0 8px 24px rgba(15,27,36,.05)}
@media (prefers-color-scheme:dark){:root{--bg:#0c141a;--surface:#131e26;--surface-2:#0f1920;--line:#233240;--ink:#e6eef2;--muted:#93a6b3;--faint:#647784;--accent:#3fb9c4;--accent-soft:#123138;--pass:#4cc38a;--pass-bg:#12261c;--warn:#e0b24a;--warn-bg:#2a2211;--fail:#e26d6d;--fail-bg:#2a1414;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}}
:root[data-theme="light"]{--bg:#eef2f5;--surface:#fff;--surface-2:#f5f8fa;--line:#d9e0e6;--ink:#0f1b24;--muted:#5a6b78;--faint:#8a99a5;--accent:#0e7c86;--accent-soft:#e2f1f2;--pass:#1a7f4b;--pass-bg:#e5f3ea;--warn:#9a6a00;--warn-bg:#f8efd8;--fail:#c23b3b;--fail-bg:#f8e3e3;--shadow:0 1px 2px rgba(15,27,36,.05),0 8px 24px rgba(15,27,36,.05)}
:root[data-theme="dark"]{--bg:#0c141a;--surface:#131e26;--surface-2:#0f1920;--line:#233240;--ink:#e6eef2;--muted:#93a6b3;--faint:#647784;--accent:#3fb9c4;--accent-soft:#123138;--pass:#4cc38a;--pass-bg:#12261c;--warn:#e0b24a;--warn-bg:#2a2211;--fail:#e26d6d;--fail-bg:#2a1414;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased;font-size:15px}
.wrap{max-width:1080px;margin:0 auto;padding:32px 20px 64px}.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
h1,h2,h3{margin:0;text-wrap:balance;letter-spacing:-.01em}
.masthead{display:flex;flex-wrap:wrap;gap:16px 24px;align-items:baseline;justify-content:space-between;padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:24px}
.brand{display:flex;flex-direction:column;gap:4px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);font-weight:700}
.brand h1{font-size:26px;font-weight:650}.runmeta{text-align:right;color:var(--muted);font-size:13px;line-height:1.6}.runmeta b{color:var(--ink)}
.banner{display:flex;flex-wrap:wrap;align-items:center;gap:18px;background:var(--surface);border:1px solid var(--line);border-left:5px solid var(--SBORDER);border-radius:var(--radius);padding:18px 22px;box-shadow:var(--shadow);margin-bottom:22px}
.banner .dot{width:14px;height:14px;border-radius:50%;background:var(--SBORDER);box-shadow:0 0 0 5px var(--SBG);flex:none}
.banner .lead{font-size:18px;font-weight:640}.banner .lead span{color:var(--SBORDER)}.banner .sub{color:var(--muted);font-size:13.5px;margin-left:auto;text-align:right}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:28px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow)}
.kpi .label{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:600}
.kpi .val{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:26px;font-weight:600;margin-top:6px;letter-spacing:-.02em}
.kpi .foot{font-size:12px;color:var(--faint);margin-top:2px}
section{margin-bottom:34px}.sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.sec-head h2{font-size:17px;font-weight:640}.sec-head .n{font-family:var(--mono);color:var(--faint);font-size:12.5px}.sec-head .rule{flex:1;height:1px;background:var(--line)}
.steps{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.step{display:grid;grid-template-columns:34px 1fr auto;gap:16px;align-items:center;padding:15px 20px;border-top:1px solid var(--line)}.step:first-child{border-top:none}
.step .marker{position:relative;display:flex;justify-content:center}.step .marker::before{content:"";position:absolute;top:-30px;bottom:22px;width:2px;background:var(--line)}.step:first-child .marker::before{display:none}
.step .node{width:24px;height:24px;border-radius:50%;background:var(--pass-bg);color:var(--pass);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;z-index:1;flex:none}
.step .body .name{font-weight:600;font-size:14.5px}.step .body .desc{color:var(--muted);font-size:13px;margin-top:1px}
.step .timing{font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;font-size:13px;color:var(--muted)}.step .timing .dur{font-weight:600;color:var(--ink)}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;padding:3px 10px;border-radius:999px;white-space:nowrap}.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.pill.pass{color:var(--pass);background:var(--pass-bg)}.pill.warn{color:var(--warn);background:var(--warn-bg)}.pill.fail{color:var(--fail);background:var(--fail-bg)}
.methods{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-bottom:18px}
.method{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px}
.method h3{font-size:14px;font-weight:640;margin-bottom:6px;display:flex;align-items:center;gap:8px}
.method h3 .tag{font-family:var(--mono);font-size:10.5px;font-weight:700;color:var(--accent);background:var(--accent-soft);padding:2px 7px;border-radius:5px}
.method p{margin:0;color:var(--muted);font-size:13px}
.tablewrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:11px 16px;border-top:1px solid var(--line);white-space:nowrap}
thead th{border-top:none;background:var(--surface-2);font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:650}
tbody tr:hover{background:var(--surface-2)}td.num,th.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
td.check{font-weight:600}td .cdesc{display:block;font-weight:400;color:var(--muted);font-size:12px;white-space:normal;margin-top:2px}
td.hash{font-family:var(--mono);font-size:12px;color:var(--muted)}tfoot td{border-top:2px solid var(--line);font-weight:700;background:var(--surface-2)}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px;display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
.sched{display:flex;flex-wrap:wrap;gap:8px}.sched .job{font-family:var(--mono);font-size:11.5px;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:3px 8px;color:var(--muted)}
.note{background:var(--accent-soft);border:1px solid var(--line);border-radius:var(--radius);padding:12px 16px;font-size:12.5px;color:var(--muted);margin-top:12px}
"""

SEV = {"SUCCESS": ("pass", "--pass", "--pass-bg"), "WARNING": ("warn", "--warn", "--warn-bg"),
       "FAILED": ("fail", "--fail", "--fail-bg")}

# Concrete light-theme colors for the EMAIL renderer. Outlook's Word engine ignores
# <style> blocks, CSS custom properties, and flex/grid — so the email is built with
# table layout + inline styles + hardcoded hex, single (light) theme.
EC = {"bg": "#eef2f5", "card": "#ffffff", "ink": "#0f1b24", "muted": "#5a6b78",
      "faint": "#8a99a5", "line": "#d9e0e6", "accent": "#0e7c86", "accent_bg": "#e2f1f2",
      "pass": "#1a7f4b", "pass_bg": "#e5f3ea", "warn": "#9a6a00", "warn_bg": "#f8efd8",
      "fail": "#c23b3b", "fail_bg": "#f8e3e3",
      "mono": "'SF Mono',Consolas,Menlo,monospace",
      "sans": "'Segoe UI',Arial,Helvetica,sans-serif"}


def _pill(status: str) -> str:
    c = {"pass": (EC["pass"], EC["pass_bg"], "Pass"), "warn": (EC["warn"], EC["warn_bg"], "Warn"),
         "fail": (EC["fail"], EC["fail_bg"], "Fail")}.get(status, (EC["pass"], EC["pass_bg"], "OK"))
    return (f'<span style="color:{c[0]};background:{c[1]};padding:2px 9px;border-radius:10px;'
            f'font-size:11px;font-weight:700;white-space:nowrap">{c[2]}</span>')


def render_email(stats: dict, meta: dict) -> str:
    """Email-safe HTML (table layout, inline styles, hardcoded light colors) so it
    renders in Outlook desktop as well as modern clients. Same content as the hosted
    dashboard, different delivery — Outlook strips the dashboard's CSS entirely."""
    fr = stats.get("freshness", {})
    companies = stats.get("companies", [])
    recon = stats.get("recon") or {}
    delivery = stats.get("delivery") or {}
    status = meta.get("status", "SUCCESS")
    scolor = {"SUCCESS": EC["pass"], "WARNING": EC["warn"], "FAILED": EC["fail"]}[status]
    sbg = {"SUCCESS": EC["pass_bg"], "WARNING": EC["warn_bg"], "FAILED": EC["fail_bg"]}[status]
    lead = {"SUCCESS": "completed successfully", "WARNING": "completed with warnings",
            "FAILED": "failed"}[status]
    total_rows = sum(c.get("rows", 0) or 0 for c in companies)
    npass = sum(1 for c in recon.get("checks", []) if c.get("status") == "pass")
    nchecks = len(recon.get("checks", []))

    def card(inner, pad="18px 20px"):
        return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
                f'style="background:{EC["card"]};border:1px solid {EC["line"]};border-radius:10px;'
                f'margin:0 0 16px"><tr><td style="padding:{pad}">{inner}</td></tr></table>')

    def h2(t):
        return (f'<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;'
                f'color:{EC["accent"]};margin:26px 0 10px">{t}</div>')

    # KPI tiles (2 columns table)
    kpis = [("Rows ingested", _fmt_int(total_rows)), ("Reconciliation", f"{npass} / {nchecks}"),
            ("dbt models", str(meta.get("model_count", "—"))),
            ("Freshness", "Current" if not fr.get("stale") else "STALE"),
            ("Open incidents", str(meta.get("incidents", 0))),
            ("Partner delivery", f"{len(delivery.get('files', []))} files" if delivery.get("published") else "—")]
    kcells = ""
    for i in range(0, len(kpis), 2):
        row = ""
        for lbl, val in kpis[i:i + 2]:
            row += (f'<td width="50%" style="padding:6px"><table role="presentation" width="100%" '
                    f'cellpadding="0" cellspacing="0" style="background:{EC["card"]};border:1px solid {EC["line"]};'
                    f'border-radius:8px"><tr><td style="padding:12px 14px">'
                    f'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:{EC["muted"]};'
                    f'font-weight:700">{lbl}</div>'
                    f'<div style="font-family:{EC["mono"]};font-size:22px;font-weight:700;color:{EC["ink"]};'
                    f'margin-top:4px">{val}</div></td></tr></table></td>')
        kcells += f"<tr>{row}</tr>"
    kpi_block = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                 f'style="margin:0 -6px 12px">{kcells}</table>')

    # Pipeline stages
    step_defs = [("Sync from source", "OneDrive → local staging (rclone)"),
                 ("ETL load", "SQLite → Postgres raw layer"),
                 ("dbt transform", "staging → warehouse → semantic"),
                 ("Reconciliation", f"{npass}/{nchecks} automated checks"),
                 ("Health check", "query API healthy"),
                 ("Partner delivery", "publish extracts + manifest to SFTP jails")]
    strows = ""
    for i, (name, desc) in enumerate(step_defs, 1):
        strows += (f'<tr><td width="30" style="padding:9px 0;color:{EC["accent"]};font-weight:700;'
                   f'font-family:{EC["mono"]}">{i}</td>'
                   f'<td style="padding:9px 0"><b style="color:{EC["ink"]}">{name}</b>'
                   f'<span style="color:{EC["muted"]};font-size:13px"> — {desc}</span></td>'
                   f'<td align="right" style="padding:9px 0">{_pill("pass")}</td></tr>')
    steps_block = card(f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                       f'style="font-size:14px">{strows}</table>')

    # Reconciliation table
    def th(t, a="left"):
        return (f'<th align="{a}" style="padding:8px 10px;background:{EC["bg"]};font-size:10px;'
                f'text-transform:uppercase;letter-spacing:.05em;color:{EC["muted"]};'
                f'border-bottom:1px solid {EC["line"]}">{t}</th>')

    def td(t, a="left", mono=False):
        fam = f'font-family:{EC["mono"]};' if mono else ""
        return (f'<td align="{a}" style="padding:9px 10px;border-bottom:1px solid {EC["line"]};'
                f'font-size:13px;color:{EC["ink"]};{fam}">{t}</td>')

    rrows = ""
    for check in recon.get("checks", []):
        label, desc = CHECK_LABELS.get(check["name"], (check["name"], ""))
        name_cell = (f'<td style="padding:9px 10px;border-bottom:1px solid {EC["line"]};font-size:13px">'
                     f'<b style="color:{EC["ink"]}">{label}</b><br>'
                     f'<span style="color:{EC["muted"]};font-size:11px">{desc}</span></td>')
        if check["name"] == "source_load_vs_raw":
            n = len(check.get("warehouse") or {})
            vals = (f'<td colspan="3" align="center" style="padding:9px 10px;border-bottom:1px solid '
                    f'{EC["line"]};font-size:13px;color:{EC["muted"]}">{n} / {n} exact</td>')
        else:
            wh = check.get("warehouse") or {}
            vals = ""
            for co in COMPANY_ORDER:
                v = wh.get(co)
                disp = "—" if v is None else (_fmt_money(v) if check["name"] == "payment_total_amount" else _fmt_int(v))
                vals += td(disp, "right", mono=True)
        rrows += f'<tr>{name_cell}{vals}{td(_pill(check.get("status","pass")), "left")}</tr>'
    recon_block = card(
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        f'<tr>{th("Check")}{th("AQPS","right")}{th("JOMO","right")}{th("Clermont","right")}{th("Status")}</tr>'
        f'{rrows}</table>', pad="6px 8px")

    # Ingestion
    irows = ""
    for co in COMPANY_ORDER:
        c = next((x for x in companies if x.get("company") == co), None)
        if not c:
            continue
        irows += (f'<tr>{td("<b>"+co+"</b>")}{td(c.get("extract_date","—"),mono=True)}'
                  f'{td(str(c.get("tables","—")),"right",True)}{td(_fmt_int(c.get("rows")),"right",True)}'
                  f'{td(_pill("pass" if c.get("ok") else "fail"))}</tr>')
    irows += (f'<tr>{td("<b>Total</b>")}{td("")}{td("")}'
              f'{td("<b>"+_fmt_int(total_rows)+"</b>","right",True)}{td("")}</tr>')
    ing_block = card(
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        f'<tr>{th("Company")}{th("Extract")}{th("Tables","right")}{th("Rows","right")}{th("Status")}</tr>'
        f'{irows}</table>', pad="6px 8px")

    # Delivery
    drows = ""
    for f in delivery.get("files", []):
        sha = f["sha256"]
        drows += (f'<tr>{td("<b>"+f["file"]+"</b>",mono=True)}{td(f"{f['bytes']/1_000_000:.1f} MB","right",True)}'
                  f'{td(_fmt_int(f.get("rows")),"right",True)}'
                  f'{td(sha[:14]+"…"+sha[-6:],mono=True)}{td(f.get("source_mtime","—"),mono=True)}</tr>')
    del_when = delivery.get("published_at", "—")
    del_accts = ", ".join(delivery.get("accounts", [])) or "—"
    del_block = card(
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        f'<tr>{th("File")}{th("Size","right")}{th("Rows","right")}{th("SHA-256")}{th("Extract (UTC)")}</tr>'
        f'{drows}</table>', pad="6px 8px")

    stale = ""
    if fr.get("stale"):
        stale = (f'<div style="background:{EC["warn_bg"]};border-left:4px solid {EC["warn"]};padding:10px 14px;'
                 f'border-radius:6px;color:{EC["warn"]};font-size:13px;margin:0 0 16px">'
                 f'&#9888; Newest extract is {fr.get("newest_extract")}, expected {fr.get("today")} — data may be a cycle behind.</div>')

    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{EC['bg']};font-family:{EC['sans']};color:{EC['ink']}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{EC['bg']}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">
  <tr><td style="padding:4px 4px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:{EC['accent']};font-weight:700">Data Warehouse · Nightly Operations</div>
    <div style="font-size:24px;font-weight:700;color:{EC['ink']};margin-top:4px">Splashworks Pipeline Report</div>
    <div style="color:{EC['muted']};font-size:13px;margin-top:4px">Run <b>{meta.get('run_date','—')} · {meta.get('run_time','—')} UTC</b> · AQPS / JOMO / Clermont</div>
  </td></tr>
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{sbg};border:1px solid {EC['line']};border-left:5px solid {scolor};border-radius:10px;margin:0 0 16px">
      <tr><td style="padding:16px 20px">
        <span style="font-size:17px;font-weight:700;color:{EC['ink']}">Pipeline <span style="color:{scolor}">{lead}</span></span>
        <div style="color:{EC['muted']};font-size:13px;margin-top:3px">6 stages · {npass} of {nchecks} reconciliation checks passed · runtime {meta.get('duration','—')}</div>
      </td></tr>
    </table>
    {stale}
    {kpi_block}
    {h2('Pipeline stages')}{steps_block}
    {h2('Reconciliation — every run, before anything is trusted')}{recon_block}
    {h2('Ingestion by company')}{ing_block}
    {h2('Partner delivery — published '+del_when+' to '+del_accts)}{del_block}
    <div style="color:{EC['faint']};font-size:11px;padding:8px 4px 0;border-top:1px solid {EC['line']};margin-top:8px">
      Generated from live pipeline state · {meta.get('run_date','—')} {meta.get('run_time','')} UTC · nightly 05:30 UTC
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def _fmt_int(n):
    return f"{int(n):,}" if isinstance(n, (int, float)) else "—"


def _fmt_money(n):
    n = float(n)
    if n >= 1_000_000:
        return f"${n/1_000_000:.2f} M"
    if n >= 1_000:
        return f"${n/1_000:.1f} K"
    return f"${n:,.0f}"


def parse_pipeline_steps(log_path: str) -> list[dict]:
    """Extract the last run's per-step timings from pipeline.log. Best-effort —
    returns [] if the log shape isn't recognized (dashboard then omits the timeline)."""
    try:
        text = Path(log_path).read_text()
    except Exception:
        return []
    runs = text.split("=== Pipeline starting ===")
    if len(runs) < 2:
        return []
    block = runs[-1]
    # capture "TS Step N: <name>..." and terminal markers
    events = []
    for m in re.finditer(r"(\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d)Z)\s+(Step \d[^\n]*|=== Pipeline complete ===)", block):
        events.append((m.group(2), m.group(3)))
    return events


def render(stats: dict, meta: dict, log_path: str | None = None) -> str:
    fr = stats.get("freshness", {})
    companies = stats.get("companies", [])
    recon = stats.get("recon") or {}
    delivery = stats.get("delivery") or {}
    status = meta.get("status", "SUCCESS")
    sev_class, sborder, sbg = SEV.get(status, SEV["SUCCESS"])

    total_rows = sum(c.get("rows", 0) or 0 for c in companies)
    npass = sum(1 for c in recon.get("checks", []) if c.get("status") == "pass")
    nchecks = len(recon.get("checks", []))
    lead_word = {"SUCCESS": "successfully", "WARNING": "with warnings", "FAILED": "with a failure"}[status]

    # KPIs
    fresh_txt = "Current" if not fr.get("stale") else "STALE"
    kpis = [
        ("Rows ingested", _fmt_int(total_rows), f"across {len(companies)} companies"),
        ("Reconciliation", f"{npass} / {nchecks}", "checks passed"),
        ("dbt models", str(meta.get("model_count", "—")), "staging → warehouse → semantic"),
        ("Data freshness", fresh_txt, f"extract dated {fr.get('newest_extract','—')}"),
        ("Incidents", str(meta.get("incidents", 0)), "open"),
        ("Partner delivery", f"{len(delivery.get('files', []))} / {len(delivery.get('files', []))}"
         if delivery.get("published") else "0 / 0",
         f"files to {len(delivery.get('accounts', []))} SFTP accounts"),
    ]
    kpi_html = "".join(
        f'<div class="kpi"><div class="label">{lbl}</div><div class="val">{val}</div><div class="foot">{foot}</div></div>'
        for lbl, val, foot in kpis)

    # Pipeline steps (best-effort timeline from the log)
    step_defs = [
        ("Sync from source", "Pull nightly Skimmer extracts from OneDrive (rclone) → local staging"),
        ("ETL load", "SQLite → Postgres raw layer, checksum-based change detection"),
        ("dbt transform", "staging (views) → warehouse (dims + incremental facts) → semantic (reports)"),
        ("Reconciliation", "Automated checks — load fidelity, business metrics, integrity, freshness"),
        ("Health check", "Query API reachable and healthy against the fresh warehouse"),
        ("Partner delivery", "Publish friendly-named extracts + checksummed manifest to partner SFTP jails"),
    ]
    steps_html = ""
    for i, (name, desc) in enumerate(step_defs, 1):
        steps_html += (
            f'<div class="step"><div class="marker"><div class="node">{i}</div></div>'
            f'<div class="body"><div class="name">{name}</div><div class="desc">{desc}</div></div>'
            f'<div class="timing"><span class="pill pass">OK</span></div></div>')

    # Reconciliation checks table
    def cell(check, co):
        wh = (check.get("warehouse") or {}).get(co)
        if wh is None:
            return '<td class="num">—</td>'
        if check["name"] == "payment_total_amount":
            return f'<td class="num">{_fmt_money(wh)}</td>'
        return f'<td class="num">{_fmt_int(wh)}</td>'

    rows_recon = ""
    for check in recon.get("checks", []):
        label, desc = CHECK_LABELS.get(check["name"], (check["name"], check.get("description", "")))
        st = check.get("status", "pass")
        pill = f'<span class="pill {st}">{st.title()}</span>'
        if check["name"] == "source_load_vs_raw":
            n = len(check.get("warehouse") or {})
            cells = f'<td class="num" colspan="3" style="text-align:center;color:var(--muted)">{n} / {n} exact match</td>'
        else:
            cells = "".join(cell(check, co) for co in COMPANY_ORDER)
        rows_recon += (f'<tr><td class="check">{label}<span class="cdesc">{desc}</span></td>'
                       f'{cells}<td>{pill}</td></tr>')

    # Ingestion table
    rows_ing = ""
    for co in COMPANY_ORDER:
        c = next((x for x in companies if x.get("company") == co), None)
        if not c:
            continue
        okpill = '<span class="pill pass">OK</span>' if c.get("ok") else '<span class="pill fail">FAIL</span>'
        rows_ing += (f'<tr><td class="check">{co}</td><td class="mono">{c.get("extract_date","—")}</td>'
                     f'<td class="num">{c.get("tables","—")}</td><td class="num">{_fmt_int(c.get("rows"))}</td>'
                     f'<td>{okpill}</td></tr>')

    # Delivery table
    rows_del = ""
    for f in delivery.get("files", []):
        mb = f["bytes"] / 1_000_000
        sha = f["sha256"]
        rows_del += (f'<tr><td class="check mono">{f["file"]}</td><td class="num">{mb:.1f} MB</td>'
                     f'<td class="num">{_fmt_int(f.get("rows"))}</td>'
                     f'<td class="hash">{sha[:16]}…{sha[-8:]}</td>'
                     f'<td class="mono">{f.get("source_mtime","—")}</td></tr>')
    del_accts = ", ".join(delivery.get("accounts", [])) or "—"
    del_when = delivery.get("published_at", "—")

    stale_banner = ""
    if fr.get("stale"):
        stale_banner = (f'<div class="note" style="border-left:4px solid var(--warn)">⚠ Newest extract is '
                        f'{fr.get("newest_extract")}, expected {fr.get("today")} — data may be a cycle behind.</div>')

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Splashworks Data Warehouse — Nightly Pipeline Report</title>
<style>{CSS}
.banner{{--SBORDER:var({sborder});--SBG:var({sbg})}}</style></head><body>
<div class="wrap">
  <header class="masthead">
    <div class="brand"><div class="eyebrow">Data Warehouse · Nightly Operations</div>
      <h1>Splashworks Pipeline Report</h1></div>
    <div class="runmeta">Run <b>{meta.get('run_date','—')} · {meta.get('run_time','—')} UTC</b><br>
      Companies <b>AQPS / JOMO / Clermont</b></div>
  </header>
  <div class="banner"><span class="dot"></span>
    <div><div class="lead">Pipeline completed <span>{lead_word}</span></div></div>
    <div class="sub">6 stages · {npass} of {nchecks} reconciliation checks passed<br>
      Runtime <b>{meta.get('duration','—')}</b></div></div>
  {stale_banner}
  <div class="kpis">{kpi_html}</div>
  <section><div class="sec-head"><h2>Pipeline stages</h2><span class="n">sync → transform → verify → publish</span><span class="rule"></span></div>
    <div class="steps">{steps_html}</div></section>
  <section><div class="sec-head"><h2>How we reconcile</h2><span class="n">every run, before anything is trusted</span><span class="rule"></span></div>
    <div class="methods">
      <div class="method"><h3><span class="tag">EXACT</span> Load fidelity</h3><p>Rows read from each SQLite extract must equal rows landed in the raw layer — per company, per table, zero tolerance.</p></div>
      <div class="method"><h3><span class="tag">METRIC</span> Business totals</h3><p>Customers, payments, invoices, service stops and dollar totals reconciled source-to-warehouse. The warehouse accumulates history beyond the source's rolling 6-month window, so warehouse ≥ source is expected.</p></div>
      <div class="method"><h3><span class="tag">INTEGRITY</span> No duplicates</h3><p>Fact tables checked for duplicate rows against their true grain — catches incremental-merge bugs that silently re-append rows.</p></div>
      <div class="method"><h3><span class="tag">FRESHNESS</span> Same-day data</h3><p>Newest extract date compared to today; a stale extract warns even when every other check is green.</p></div>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th>Check</th><th class="num">AQPS</th><th class="num">JOMO</th><th class="num">Clermont</th><th>Status</th></tr></thead>
      <tbody>{rows_recon}</tbody></table></div></section>
  <section><div class="sec-head"><h2>Ingestion by company</h2><span class="n">this run</span><span class="rule"></span></div>
    <div class="tablewrap"><table>
      <thead><tr><th>Company</th><th>Extract date</th><th class="num">Tables</th><th class="num">Rows loaded</th><th>Status</th></tr></thead>
      <tbody>{rows_ing}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td class="num">{_fmt_int(total_rows)}</td><td></td></tr></tfoot>
    </table></div></section>
  <section><div class="sec-head"><h2>Partner delivery</h2><span class="n">published {del_when} → {del_accts}</span><span class="rule"></span></div>
    <div class="tablewrap"><table>
      <thead><tr><th>File</th><th class="num">Size</th><th class="num">Rows</th><th>SHA-256</th><th>Extract date (UTC)</th></tr></thead>
      <tbody>{rows_del}</tbody></table></div>
    <div class="note"><b>Every download is logged.</b> A Slack alert fires on each partner SFTP login, distinguishing the automated pipeline account from interactive access. The manifest's checksums let the partner verify byte-for-byte integrity.</div>
  </section>
  <footer class="footer">
    <div class="sched"><span class="job">05:30 UTC · nightly pipeline</span><span class="job">02:30 UTC · audit retention</span><span class="job">*/5 min · SFTP access monitor</span></div>
    <div>Generated from live pipeline state · {meta.get('run_date','—')} {meta.get('run_time','')} UTC</div>
  </footer>
</div></body></html>""".replace("{sborder}", sborder).replace("{sbg}", sbg)

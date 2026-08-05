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
import hashlib
import json
import os
import re
import smtplib
import ssl
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import psycopg2

from etl import status_page
from etl.config import COMPANY_MAP
from etl.config import EXTRACT_DIR as _CFG_EXTRACT_DIR

PROJECT_DIR = Path(__file__).resolve().parent.parent
# config's EXTRACT_DIR honours the env var the pipeline exports; fall back to the
# in-repo path so the report still works when run by hand without that env set.
EXTRACT_DIR = _CFG_EXTRACT_DIR if _CFG_EXTRACT_DIR.is_dir() else PROJECT_DIR / "data" / "extracts"
PIPELINE_LOG = str(PROJECT_DIR / "data" / "pipeline.log")
RECON_PATH = PROJECT_DIR / "data" / "reconciliation.json"
MAIL_ENV_PATH = os.environ.get("MAIL_CONFIG", "/root/.mail_env")
SLACK_WEBHOOK_FILE = "/root/.slack_webhook"
SFTP_MANIFEST_GLOB = "/srv/sftp/*/extracts/MANIFEST.txt"
SFTP_DROPOFF_GLOB = "/srv/sftp/*/incoming"


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


def gather_source_delivery() -> list:
    """Per-company delivery status read from the extract files themselves.

    rclone preserves the remote mtime, so a file's mtime IS Skimmer's publish
    time. Returns one row per company in COMPANY_MAP (so a company whose file
    never arrived shows up as missing rather than silently vanishing).
    """
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    rows = []
    for guid, company in sorted(COMPANY_MAP.items(), key=lambda kv: kv[1]):
        path = EXTRACT_DIR / f"{guid}.db.gz"
        row = {"company": company, "file": path.name, "present": path.is_file(),
               "published_at": None, "age_hours": None, "bytes": None, "current": False}
        if row["present"]:
            mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            row["published_at"] = mtime.strftime("%Y-%m-%d %H:%M UTC")
            row["age_hours"] = round((now - mtime).total_seconds() / 3600, 1)
            row["bytes"] = path.stat().st_size
            row["current"] = mtime.date() == today
        rows.append(row)
    return rows


def _freshness_from_source(source: list) -> dict:
    """Stale if ANY company's extract is missing or not published today."""
    today = datetime.now(timezone.utc).date().isoformat()
    problems = [r["company"] for r in source if not r["current"]]
    dates = [r["published_at"][:10] for r in source if r["published_at"]]
    return {
        "today": today,
        "newest_extract": max(dates) if dates else None,
        "oldest_extract": min(dates) if dates else None,
        "stale": bool(problems),
        "stale_companies": problems,
    }


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
    # Freshness: derived from the SOURCE FILES, per company.
    #
    # Do NOT use etl_load_log.extract_date — that column is `date.today()` at ETL
    # time (etl/main.py, etl/load.py), i.e. the day we RAN, never the day Skimmer
    # PUBLISHED. Comparing it to today is tautological: it can only fire when the
    # pipeline didn't run at all, so it could never detect a delivery failure —
    # the exact scenario the guard exists for.
    #
    # The real signal is each extract file's mtime, which rclone preserves from
    # OneDrive == Skimmer's publish time. Checked PER COMPANY: a max() across
    # companies hides a single-company delivery failure behind its healthy siblings.
    stats["source"] = gather_source_delivery()
    stats["freshness"] = _freshness_from_source(stats["source"])
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


def gather_partner_activity(hours: int = 24) -> dict:
    """What partners actually DID in the jails, read from the systemd journal.

    `gather_delivery` proves what we *published*. This proves what was actually
    *collected* — and, since 2026-08-05, what was *uploaded* into a partner's
    write-scoped drop-off. The two together close the loop: a silent partner-side
    failure looks identical to success if you only report your own publishing.

    Requires `ForceCommand internal-sftp -l INFO` in the sshd Match block (set by
    infrastructure/sftp/setup-sftp-user.sh). Without it, logins still appear but
    every transfer count reads zero — so a zero here means "check -l INFO is on"
    before it means "the partner did nothing".

    Never raises: a reporting section must not be able to fail the report.
    """
    out = {"available": False, "window_hours": hours, "accounts": {},
           "any_pickup": False, "events": [], "failures": [], "dropoff": []}
    # Filesystem view FIRST — it must survive a journal outage, because the two
    # views exist precisely to cross-check each other.
    try:
        out["dropoff"] = inspect_dropoffs()
    except Exception as e:
        out["dropoff"] = [{"account": "?", "path": SFTP_DROPOFF_GLOB, "files": [],
                           "error": str(e)[:160]}]
    try:
        proc = subprocess.run(
            ["journalctl", "-t", "sshd", "-t", "internal-sftp",
             "--since", f"-{hours}h", "-o", "short-iso", "--no-pager"],
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0:
            return out
    except Exception:
        return out                      # not on the VPS, or no journal access
    out["available"] = True

    def acct(name: str) -> dict:
        return out["accounts"].setdefault(name, {
            "logins": 0, "ips": set(), "last_login": None,
            "dl_files": 0, "dl_bytes": 0, "uploads": [], "deletes": [],
        })

    pid_user: dict[str, str] = {}

    def ev(ts, user, kind, detail, nbytes=None):
        out["events"].append({"ts": ts, "user": user, "kind": kind,
                              "detail": detail, "bytes": nbytes})

    for ln in proc.stdout.splitlines():
        ts = ln.split()[0] if ln.split() else "—"
        m = re.search(r"Accepted publickey for (sftp-[\w.-]+) from ([\d.a-fA-F:]+)", ln)
        if m:
            a = acct(m.group(1))
            a["logins"] += 1
            a["ips"].add(m.group(2))
            a["last_login"] = ts
            ev(ts, m.group(1), "LOGIN", f"from {m.group(2)}")
            continue
        m = re.search(r"internal-sftp\[(\d+)\].*session opened for local user (sftp-[\w.-]+)", ln)
        if m:
            pid_user[m.group(1)] = m.group(2)
            continue
        m = re.search(r'internal-sftp\[(\d+)\]: close "([^"]*)" bytes read (\d+) written (\d+)', ln)
        if m:
            user = pid_user.get(m.group(1), "unknown")
            a = acct(user)
            path, read_b, wrote = m.group(2), int(m.group(3)), int(m.group(4))
            if wrote > 0:
                a["uploads"].append({"path": path, "bytes": wrote, "ts": ts})
                ev(ts, user, "IN", path, wrote)          # partner -> us
            elif read_b > 0:
                a["dl_files"] += 1
                a["dl_bytes"] += read_b
                ev(ts, user, "OUT", path, read_b)        # us -> partner
            continue
        m = re.search(r'internal-sftp\[(\d+)\]: remove name "([^"]*)"', ln)
        if m:
            user = pid_user.get(m.group(1), "unknown")
            acct(user)["deletes"].append({"path": m.group(2), "ts": ts})
            ev(ts, user, "DELETE", m.group(2))

        # ---- failures: auth rejections and refused/aborted transfers ----
        m = re.search(r"Failed publickey for (sftp-[\w.-]+) from ([\d.a-fA-F:]+)", ln)
        if m:
            out["failures"].append({"ts": ts, "user": m.group(1), "kind": "AUTH",
                                    "detail": f"rejected key from {m.group(2)}"})
            continue
        m = re.search(r"internal-sftp\[(\d+)\]:.*?(Permission denied|No such file|failed:.*)$", ln)
        if m:
            out["failures"].append({"ts": ts, "user": pid_user.get(m.group(1), "unknown"),
                                    "kind": "XFER", "detail": m.group(2)[:160]})

    for a in out["accounts"].values():
        a["ips"] = sorted(a["ips"])     # sets are not JSON-serialisable
    out["any_pickup"] = any(a["dl_files"] > 0 for a in out["accounts"].values())
    out["dropoff"] = inspect_dropoffs()
    return out


CHECKSUM_EXTS = (".sha256", ".sha512", ".md5")


def _digest(path: Path, algo: str, chunk: int = 1 << 20) -> str:
    h = hashlib.new(algo)
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def _verify_checksum(path: Path) -> dict:
    """Compare a partner upload against a sidecar checksum file, if supplied.

    Convention: `<file>.sha256` (preferred), `.sha512`, or `.md5` sitting beside
    the payload. Accepts either a bare hex digest or standard `<hex>  <name>`
    coreutils format.

    This is the only check that proves IDENTITY. `gzip -t` proves the archive
    decompresses; a file corrupted before compression, or an entirely different
    file, passes it cleanly. MD5 is honoured for compatibility but is
    collision-broken — SHA-256 matches what we publish outbound in MANIFEST.txt.
    """
    for ext in CHECKSUM_EXTS:
        side = path.with_name(path.name + ext)
        if not side.is_file():
            continue
        algo = ext.lstrip(".")
        try:
            raw = side.read_text(errors="replace").strip().split()
            expected = next((t.lower() for t in raw if re.fullmatch(r"[0-9a-fA-F]{32,128}", t)), None)
            if not expected:
                return {"state": "UNREADABLE", "algo": algo, "detail": "no hex digest in sidecar"}
            actual = _digest(path, algo)
            if actual == expected:
                return {"state": "VERIFIED", "algo": algo, "detail": f"{algo} matches sidecar"}
            return {"state": "MISMATCH", "algo": algo,
                    "detail": f"{algo} MISMATCH — expected {expected[:16]}…, got {actual[:16]}…"}
        except Exception as e:
            return {"state": "ERROR", "algo": algo, "detail": f"checksum error: {e}"[:140]}
    return {"state": "NONE", "algo": None, "detail": "no checksum supplied"}


def _qc_incoming(path: Path) -> dict:
    """Non-destructive integrity check on one partner-uploaded file.

    A log line saying bytes were written proves a transfer *happened*, not that
    the payload is usable — a truncated or aborted upload still closes cleanly.
    This is the second opinion: does the file actually decompress?
    """
    now = datetime.now(timezone.utc).timestamp()
    st = path.stat()
    # `checksum` is initialised here, not only on the success path: the early
    # returns below (zero-byte, still-uploading) would otherwise omit the key and
    # KeyError in any renderer that reads it.
    rec = {"file": path.name, "bytes": st.st_size,
           "mtime": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(timespec="seconds"),
           "age_min": round((now - st.st_mtime) / 60, 1), "qc": "OK", "note": "",
           "checksum": "NOT-CHECKED"}
    if st.st_size == 0:
        rec.update(qc="FAIL", note="zero bytes")
        return rec
    if rec["age_min"] < 2:
        rec.update(qc="PENDING", note="modified <2 min ago — may still be uploading")
        return rec
    name = path.name.lower()
    try:
        if name.endswith((".gz", ".tgz")):
            p = subprocess.run(["gzip", "-t", str(path)], capture_output=True, timeout=180)
            if p.returncode != 0:
                rec.update(qc="FAIL", note="gzip integrity FAILED: "
                           + p.stderr.decode(errors="replace").strip()[:120])
            else:
                rec["note"] = "gzip integrity OK"
        elif name.endswith(".zip"):
            p = subprocess.run(["unzip", "-t", str(path)], capture_output=True, timeout=180)
            rec.update(**({"qc": "FAIL", "note": "zip integrity FAILED"} if p.returncode
                          else {"note": "zip integrity OK"}))
        else:
            rec["note"] = "no integrity test for this type"
    except FileNotFoundError:
        rec.update(qc="UNKNOWN", note="test tool not installed")
    except Exception as e:
        rec.update(qc="UNKNOWN", note=f"integrity test error: {e}"[:140])

    # Identity check. Decisive when a sidecar is supplied — a MISMATCH means the
    # bytes that landed are not the bytes the partner intended to send, even if
    # the archive decompresses perfectly.
    ck = _verify_checksum(path)
    rec["checksum"] = ck["state"]
    rec["note"] = (rec["note"] + " · " + ck["detail"]).strip(" ·")
    if ck["state"] == "MISMATCH":
        rec["qc"] = "FAIL"
    return rec


def inspect_dropoffs(glob_pat: str = SFTP_DROPOFF_GLOB) -> list:
    """List and QC what is ACTUALLY sitting in each partner drop-off.

    Deliberately independent of the journal: if transfer logging regresses (or
    `-l INFO` is dropped from the sshd Match block) the log-derived view silently
    reads zero, while this still sees the files. Two sources, one truth.
    """
    results = []
    for d in sorted(glob.glob(glob_pat)):
        acct = os.path.basename(os.path.dirname(d))
        files = []
        try:
            for f in sorted(Path(d).iterdir()):
                if not f.is_file() or f.name.startswith("."):
                    continue
                if f.name.endswith(CHECKSUM_EXTS):
                    continue      # sidecar — reported against the payload it signs
                files.append(_qc_incoming(f))
        except Exception as e:
            results.append({"account": acct, "path": d, "files": [], "error": str(e)[:160]})
            continue
        results.append({
            "account": acct, "path": d, "files": files,
            "total_bytes": sum(f["bytes"] for f in files),
            "failed": [f for f in files if f["qc"] == "FAIL"],
            "newest": max((f["mtime"] for f in files), default=None),
        })
    return results


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
        who = ", ".join(fr.get("stale_companies") or [])
        lines.append(f"⚠ SOURCE DELIVERY PROBLEM — not published today ({fr['today']}): {who}")
    else:
        lines.append(f"Source delivery OK: all companies published {fr['newest_extract']}.")
    # Per-company source delivery — the authoritative "did Skimmer deliver" view.
    for r in (stats.get("source") or []):
        if not r["present"]:
            lines.append(f"  {r['company']:9} MISSING — no extract file ({r['file']})")
        else:
            flag = "ok" if r["current"] else "STALE"
            mb = (r["bytes"] or 0) / 1_000_000
            lines.append(f"  {r['company']:9} published {r['published_at']}  "
                         f"({r['age_hours']}h ago, {mb:.1f} MB)  [{flag}]")
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

    # Partner ACTIVITY — itemised, with timestamps and direction. Delivery above
    # says what we published; this says what actually moved, and which way.
    act = stats.get("partner_activity") or {}
    lines.append("")
    if not act.get("available"):
        lines.append("Partner activity (SFTP): unavailable (systemd journal not readable here)")
    else:
        win, evs = act.get("window_hours", 24), act.get("events", [])
        n_out = sum(1 for e in evs if e["kind"] == "OUT")
        b_out = sum(e["bytes"] or 0 for e in evs if e["kind"] == "OUT")
        n_in = sum(1 for e in evs if e["kind"] == "IN")
        b_in = sum(e["bytes"] or 0 for e in evs if e["kind"] == "IN")
        n_log = sum(1 for e in evs if e["kind"] == "LOGIN")
        n_del = sum(1 for e in evs if e["kind"] == "DELETE")
        lines.append(f"Partner activity (SFTP, last {win}h) — {len(evs)} event(s):")
        if evs:
            lines.append(f"  {'TIMESTAMP':26} {'ACCOUNT':20} {'DIR':6} DETAIL")
            for e in evs:
                sz = f"  ({e['bytes'] / 1_000_000:.1f} MB)" if e.get("bytes") else ""
                lines.append(f"  {e['ts']:26} {e['user']:20} {e['kind']:6} {e['detail']}{sz}")
        else:
            lines.append("  (no SFTP activity recorded in this window)")
        lines.append(
            f"  Totals: OUT {n_out} file(s) / {b_out / 1_000_000:.1f} MB"
            f" · IN {n_in} file(s) / {b_in / 1_000_000:.1f} MB"
            f" · {n_log} login(s) · {n_del} delete(s)"
        )
        if not act.get("any_pickup"):
            lines.append("  ⚠ Nothing collected in this window — extracts published but not pulled.")
        if n_log and not (n_out or n_in):
            lines.append("  ⚠ Logins recorded but ZERO transfer events — verify "
                         "`ForceCommand internal-sftp -l INFO` is still active before "
                         "concluding the partner transferred nothing.")
        fails = act.get("failures", [])
        if fails:
            lines.append(f"  FAILURES ({len(fails)}):")
            for f in fails[:15]:
                lines.append(f"    {f['ts']:26} {f['user']:20} {f['kind']:6} {f['detail']}")
            if len(fails) > 15:
                lines.append(f"    … and {len(fails) - 15} more")
        else:
            lines.append("  Failures: none recorded")

    # Drop-off contents + integrity QC. Filesystem truth, deliberately independent
    # of the journal — if transfer logging regresses, this still sees the files.
    drop = act.get("dropoff") or []
    lines.append("")
    if not drop:
        lines.append("Partner drop-off: none configured")
    for d in drop:
        if d.get("error"):
            lines.append(f"Drop-off {d['account']}: ERROR {d['error']}")
            continue
        files, nfail = d.get("files", []), len(d.get("failed", []))
        nver = sum(1 for f in files if f.get("checksum") == "VERIFIED")
        nnone = sum(1 for f in files if f.get("checksum") == "NONE")
        lines.append(f"Drop-off {d['account']} ({d['path']}): {len(files)} file(s), "
                     f"{d.get('total_bytes', 0) / 1_000_000:.1f} MB"
                     f"  [checksum: {nver} verified, {nnone} unverified]"
                     + (f"  ⚠ {nfail} FAILED" if nfail else ""))
        if nnone:
            lines.append(f"    note: {nnone} file(s) arrived without a sidecar checksum — "
                         "integrity tested, identity NOT proven.")
        for f in files:
            lines.append(f"    [{f['qc']:7}] {f['file']:34} {f['bytes'] / 1_000_000:8.1f} MB  "
                         f"{f['mtime']}  ({f['age_min']}m ago)  {f['note']}")
        if not files:
            lines.append("    (empty — no partner uploads present)")
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

    try:
        stats["partner_activity"] = gather_partner_activity()
    except Exception as e:
        stats["partner_activity"] = {"available": False, "accounts": {}, "events": [],
                                     "any_pickup": False, "_error": str(e)}

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

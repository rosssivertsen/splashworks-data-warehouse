# Runbook: nightly pipeline schedule fix + status email

## The bug (found 2026-07-14)

The warehouse was serving data ~24 hours stale, while every health signal read green.

**Root cause — schedule ordering.** Skimmer publishes each night's extract to OneDrive
at **~03:56–04:40 UTC**. The nightly pipeline ran at **01:15 UTC** — *before* the drop —
so every run synced the *previous* day's extract, reported "Sync complete: 3 files", and
passed reconciliation + health on stale input. Nothing failed; the data was just a full
cycle old.

**Evidence:** `rclone` showed the OneDrive source at `2026-07-14 04:38 UTC` while the VPS
copy was `2026-07-13 04:38 UTC` (`rclone check` → sizes differ). After a manual run once
today's extract existed, `rclone check` → 0 differences.

## The fix

1. **Reschedule** so the run lands after Skimmer's publish:

   | Job | Old | New (UTC) |
   |-----|-----|-----------|
   | `nightly-pipeline.sh` | `15 1` | **`30 5`** |
   | `publish-extracts-to-sftp.sh` | `45 1` | **`0 6`** |
   | `audit-retention.sh` | `30 2` | `30 2` (unchanged) |

   ~50 min buffer past the observed ~04:40 publish, for drift. Tighten after watching a few nights.

2. **Freshness guard** — the nightly report (below) compares the newest `extract_date` to
   today (UTC) and flags **STALE** if behind, so a green pipeline can never again hide old data.

## Nightly status + statistics email

`etl/report.py`, fired from `nightly-pipeline.sh`'s **EXIT trap** (so it sends on EVERY run —
success or a mid-pipeline abort). It computes the real status from three signals: pipeline
outcome, reconciliation result, and data freshness.

**Contents:** overall status (SUCCESS/WARNING/FAILED), run date, freshness, per-company
ingestion (extract date, tables, rows), and the reconciliation summary with any issues.

**Delivery:**
- **Email** via SMTP when configured (below).
- **Slack** webhook always, as a backup so a mail misconfig never leaves Ross un-notified.

### Enabling email — provide SMTP creds

`report.py` reads mail config from `/root/.mail_env` (root-only, `KEY=VALUE`):

```
MAIL_TO=mail@ross-sivertsen.com
MAIL_FROM=dw-reports@<a-domain-you-control>
SMTP_HOST=smtp.hostinger.com     # or your relay
SMTP_PORT=465                    # 465 = SSL, 587 = STARTTLS
SMTP_USER=<mailbox login>
SMTP_PASS=<mailbox password / app password>
```

Recommended relay (no new subscription): a mailbox on a domain you already control
(Hostinger email `smtp.hostinger.com:465`, or M365 `smtp.office365.com:587` with an app
password). Until this file exists, the report still posts to Slack every night.

Create it (root only):
```bash
ssh root@2.24.202.170 'umask 077; cat > /root/.mail_env' <<'EOF'
MAIL_TO=...
...
EOF
```
Test immediately:
```bash
ssh root@2.24.202.170 'cd /opt/splashworks && source .venv/bin/activate \
  && export DATABASE_URL="postgresql://splashworks:$(grep DB_PASSWORD .env|cut -d= -f2)@localhost:5432/splashworks" \
  && python3 -m etl.report --outcome success --last-step health --exit-code 0'
```

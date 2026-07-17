# Runbook: nightly status dashboard (hosted + email)

A single visual report of the whole nightly pipeline — stages, reconciliation
methodology + results, ingestion, and partner delivery — generated from live
state every run and delivered three ways from one render.

## Architecture

```
nightly-pipeline.sh (05:30 UTC)
  └─ EXIT trap → etl/report.py --html-out data/status/index.html
       ├─ EMAIL  (Resend)  → rich dashboard HTML, forwardable            [report.py send_email]
       ├─ FILE   data/status/index.html                                  [--html-out]
       └─ SLACK  plain-text summary + @mention                           [report.py send_slack]

data/status/index.html  ──(volume, ro)──►  splashworks-status (nginx:alpine, 127.0.0.1:8090)
                                               ▲
        Cloudflare tunnel  status.splshwrks.com ── behind Cloudflare Access
```

- `etl/status_page.py` — the dashboard renderer. **Parameterized** — takes `stats`
  + `meta`, nothing hardcoded. **Partner-safe by design:** pipeline / reconciliation
  / delivery only. Never add `query_audit_log` or Ripple usage here (customer PII).
- `etl/report.py` — gathers stats (ingestion, reconciliation.json, delivery manifest,
  model count, open incidents, run timing) and renders once for all three channels.
- `docker-compose.yml` `status` service — static nginx serving `data/status`.

## One-time Cloudflare setup (dashboard — tunnel is token-managed)

The prod tunnel is dashboard-managed, so routing + Access are done in Zero Trust:

1. **Networks → Tunnels →** the `splashworks-warehouse` tunnel **→ Public Hostname → Add**
   - Subdomain `status`, Domain `splshwrks.com`
   - Service: **HTTP** → `localhost:8090`
   - (This auto-creates the `status` DNS record.)
2. **Access → Applications → Add → Self-hosted**
   - Name `DW Status`, Domain `status.splshwrks.com`
   - **Attach the existing policy** used for the other subdomains (reuse — do not
     hand-craft a per-person rule). Whoever that policy admits sees the page.
   - Save.

`status.splshwrks.com` is then live behind Access. Revoke = remove the public
hostname or detach the policy.

## Deploy / redeploy

```bash
ssh root@<host> 'cd /opt/splashworks && git pull && mkdir -p data/status && docker compose up -d status'
# page regenerates on the next pipeline run; to generate now:
ssh root@<host> 'cd /opt/splashworks && source .venv/bin/activate \
  && export DATABASE_URL="postgresql://splashworks:$(grep DB_PASSWORD .env|cut -d= -f2)@localhost:5432/splashworks" \
  && python3 -m etl.report --outcome success --last-step sftp-publish --exit-code 0 \
       --html-out /opt/splashworks/data/status/index.html'
```

Deployed on **prod `2.24.202.170`** and the **personal box `76.13.29.44`**.

## Reuse for CCE / other clients (IP)

This stack — reconciliation checks (`etl/reconcile.py`), nightly report + freshness
guard (`etl/report.py`), and the dashboard renderer (`etl/status_page.py`) — is a
reusable pattern, not Splashworks-specific. To port:

- Client-specific config to lift out: `etl/config.py` `COMPANY_MAP`, `status_page.py`
  `COMPANY_ORDER` + `CHECK_LABELS`, and the `reconcile.py` check list. These are the
  only Splashworks-coupled pieces; the rest is generic.
- Recommended home: extract to `enterprise-templates` as a `data-warehouse-nightly`
  module so CCE and future clients scaffold it rather than copy it. (Delivery principle:
  second time → abstract into a reusable tool.)

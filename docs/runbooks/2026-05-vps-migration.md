# VPS Migration Runbook — May 2026

**Status:** DRAFT — pending decision on cutover window and tunnel strategy
**Stream:** IN (Infrastructure)
**Branch:** `feature/in-vps-migration`
**Authored:** 2026-05-01

---

## Source → Target

| | Source | Target |
|---|---|---|
| **VM ID** | 1317522 | 1590691 |
| **Hostinger account** | personal (`Azz5B5V9vdJnb7Pov`) | splashworks (`AzygFAVGsJsVM1zNY`) |
| **Plan** | KVM-2 (2 CPU / 8 GB RAM / 100 GB disk / 8 TB BW) | KVM-4 (4 CPU / 16 GB RAM / 200 GB disk / 16 TB BW) |
| **Hostname** | srv1317522.hstgr.cloud | srv1590691.hstgr.cloud |
| **IPv4** | 76.13.29.44 | 2.24.202.170 |
| **IPv6** | 2a02:4780:2d:599d::1 | 2a02:4780:75:e087::1 |
| **DC** | 17 | 24 |
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **Created** | 2026-02-01 | 2026-04-15 |

Net effect: 2x compute, 2x RAM, 2x disk, 2x bandwidth — and ownership moves from personal to splashworks billing. No OS-level migration concerns; Ubuntu major version matches.

---

## Inventory of what's moving

### Irreplaceable state (must dump/restore correctly)

- **Postgres 16 + pgvector data**, schemas: `public`, `public_staging`, `public_warehouse`, `public_semantic`, `ripple`, plus `etl` metadata schema. **Critical:** `public_warehouse.fact_*` tables are incremental and have accumulated history beyond the rolling 6-month raw window — losing them means losing accumulated transactions.
- **Postgres roles + grants:** `postgres` (admin), `ripple_rw`, `metabase_ro`. Captured via `pg_dumpall --globals-only`.
- **`query_audit_log`** — audit trail for all `/api/query` and `/api/query/raw` requests (compliance artifact, not regenerable).
- **`.env`** — DB password, Anthropic API key, OpenAI API key, Cloudflare service tokens.

### Recreatable from sources (no dump needed)

- `data/` SQLite extracts — re-pulled from OneDrive after rclone is reconfigured on target.
- dbt artifacts (`target/`, `dbt_packages/`) — regenerated via `dbt deps && dbt run`.
- Docker images — pulled fresh on target (faster than scp'ing image tarballs over the public internet).
- Frontend static builds — produced by `npm run build` from repo source.
- Python venvs, npm node_modules — reinstalled by Dockerfile builds.

### Configuration to copy (small files, scp via SSH)

- `/etc/cloudflared/` — tunnel credentials JSON, `cert.pem`, `config.yml`, systemd unit.
- `/etc/systemd/system/cloudflared.service` — service definition.
- `/etc/cron.d/` or root crontab — nightly ETL pipeline schedule.
- `~/.config/rclone/rclone.conf` — OneDrive OAuth tokens. **May need re-auth on target** if Microsoft Graph rejects the migrated token.
- `/opt/splashworks/.env` — secrets file.
- SSH `authorized_keys` for ongoing access.

### Lives elsewhere — does not move

- **DNS records** in Cloudflare → still point at `<tunnel-id>.cfargotunnel.com`. Zero DNS edits required if we keep the tunnel ID.
- **Cloudflare Access policies** — applications + login methods + email allowlists live in the CF dashboard. Survive automatically.
- **Cloudflare Tunnel routing rules** — defined in `config.yml` on the VPS, not in CF dashboard.
- **GitHub repo** — clone fresh on target.

---

## Strategy: tunnel-credential move + maintenance-window cutover

The migration uses **the same tunnel ID** on both VPSes (sequentially, never simultaneously). Cloudflare DNS records reference `f062b2e4-2fed-4575-85ea-f9f9f39e5525.cfargotunnel.com` — by moving the tunnel credentials JSON file from source to target, the tunnel "follows" the credentials. No DNS changes, no TTL waiting, no propagation risk.

**Why not run both tunnels in parallel for a no-downtime cutover?**

A single Cloudflare tunnel ID supports multiple replicas (Cloudflare load-balances between them). But during the data-sync window, the application stack must be writing to exactly one Postgres — running two app stacks simultaneously while the database moves causes split-brain writes and lost data. The cleanest sequencing is: stop source app stack → dump → restore → start target app stack → swap tunnel.

Estimated downtime: **30–60 minutes** for a fresh `pg_dump --format=custom` of a few GB of data, transfer, and `pg_restore`. Verification adds 30 minutes.

---

## Phase 0 — Pre-flight (this week, before cutover window)

| # | Step | Owner | Verifies |
|---|------|-------|----------|
| 0.1 | Audit source VPS (read-only): `df -h`, `docker compose ps`, `crontab -l`, `du -sh /var/lib/docker /opt/splashworks /var/lib/postgresql`, `systemctl status cloudflared`, list `/etc/cloudflared/`, `rclone listremotes` | Sherpa (gated on Ross OK for prod read) | Sizing + completeness of inventory |
| 0.2 | Audit target VPS: confirm clean Ubuntu install or document any pre-existing config; install SSH key for ongoing access | Sherpa | Target is reachable + safe to provision |
| 0.3 | Install on target: Docker, Docker Compose plugin, cloudflared, rclone, postgresql-client (for pg_dump/restore), `git` | Sherpa | Target ready to receive workload |
| 0.4 | Clone repo on target into `/opt/splashworks/`, install secrets (`.env`) but DO NOT start containers | Sherpa | App layer ready to flip on |
| 0.5 | Pre-pull all Docker images on target (`docker compose pull`) | Sherpa | Cutover window doesn't include image pulls |
| 0.6 | Test pg_dump → pg_restore round-trip with a recent snapshot (use staging schema or a dump-to-/tmp restore test) | Sherpa | Catch dump/restore issues *before* the live cutover |
| 0.7 | Verify Cloudflare Access policies still work (test login from a fresh browser session at `app.splshwrks.com`) | Ross | Baseline before cutover |
| 0.8 | Disable nightly ETL cron on source (comment out crontab entry) — runs from 1:15 AM UTC | Sherpa | No mid-migration ETL writes |
| 0.9 | Confirm rollback procedure: source stays *paused but intact* for retention window | Ross | Rollback target exists |

---

## Phase 1 — Cutover window (Saturday, time TBD)

Target window: **TBD — recommend Sat 10pm CT** (low traffic, internal users asleep).

```
T+0:00  Disable nightly cron on source (already done in 0.8 if not earlier)
T+0:00  ssh source: docker compose down              # stops api/frontend/metabase/ripple/etc.
T+0:01  ssh source: pg_dumpall --globals-only > /tmp/globals.sql
T+0:02  ssh source: pg_dump --format=custom --no-owner --no-privileges --jobs=2 \
                    --file=/tmp/warehouse.dump warehouse
T+0:08  ssh source: pg_dump --format=custom --no-owner --no-privileges \
                    --file=/tmp/ripple.dump ripple        # if separate DB; verify
T+0:10  scp /tmp/*.dump /tmp/globals.sql target:/tmp/
T+0:15  ssh target: createdb warehouse (and ripple) on the postgres container
T+0:16  ssh target: psql -f /tmp/globals.sql            # users, roles, grants
T+0:17  ssh target: pg_restore --no-owner --no-privileges \
                    --jobs=4 -d warehouse /tmp/warehouse.dump
T+0:25  ssh target: VACUUM ANALYZE; reindex if needed
T+0:30  Move tunnel credentials:
        scp /etc/cloudflared/* target:/etc/cloudflared/
T+0:31  ssh source: systemctl stop cloudflared          # tunnel is now offline
T+0:32  ssh target: systemctl enable --now cloudflared  # tunnel reattaches from new IP
T+0:33  ssh target: docker compose up -d                # bring up api/frontend/etc.
T+0:35  Begin verification (Phase 2)
```

If anything fails between T+0:30 and T+0:35, see **Rollback**.

---

## Phase 2 — Verification (immediately after cutover)

Run in this order — each step gates the next:

1. **Tunnel reattach:** `ssh target: cloudflared tunnel info <tunnel-id>` shows the new IP as the active connection.
2. **Public reachability:** `curl -I https://app.splshwrks.com` and `https://api.splshwrks.com/api/health` from off-network. Expect 200 (or 302 to CF Access login on `app.`).
3. **Cloudflare Access:** browser login at `app.splshwrks.com` succeeds via GitHub OAuth.
4. **Database integrity:**
   ```sql
   -- Pre-cutover counts (captured during Phase 1 step T+0:00)
   -- Post-cutover counts (run on target now)
   SELECT 'dim_customer' AS table, count(*) FROM public_warehouse.dim_customer
   UNION ALL SELECT 'fact_service_stop', count(*) FROM public_warehouse.fact_service_stop
   UNION ALL SELECT 'fact_payment',      count(*) FROM public_warehouse.fact_payment
   UNION ALL SELECT 'fact_invoice_item', count(*) FROM public_warehouse.fact_invoice_item
   UNION ALL SELECT 'rpt_customer_360',  count(*) FROM public_semantic.rpt_customer_360;
   ```
   Expect parity with pre-cutover snapshot.
5. **AI query path:** post a known-verified query (one of the 13 few-shot examples) to `/api/query` and confirm SQL generation + execution returns expected rows.
6. **Metabase:** load `bi.splshwrks.com`, run a saved question, confirm results.
7. **Ripple:** `ripple.splshwrks.com` answers a known doc-RAG question. Confirms pgvector is working.
8. **ETL dry run:** manually invoke `/opt/splashworks/etl/scripts/nightly-pipeline.sh --dry-run` (or equivalent) — confirms rclone OneDrive auth, ETL Python, dbt run all functional.
9. **Re-enable nightly cron** on target.
10. **Disable nightly cron** stays disabled on source (already done in 0.8).

If steps 1–7 pass: cutover is **GO**. If 8 fails, the platform is up but ETL needs follow-up — not a rollback condition.

---

## Phase 3 — Rollback (if Phase 2 fails before declared GO)

Source has been *stopped* but not destroyed. To revert:

1. `ssh target: systemctl stop cloudflared && docker compose down`
2. `ssh target: systemctl disable cloudflared`
3. `ssh source: systemctl start cloudflared && docker compose up -d`
4. Tunnel reattaches from source IP. Public traffic flows back.
5. Re-enable source nightly cron.
6. Open an incident note documenting what failed; iterate before re-attempting.

**Critical rollback constraint:** rollback is *only* valid before any writes hit the target Postgres. Once business users start writing (queries logged, dashboards saved, Ripple feedback recorded), rolling back loses those writes. Phase 2 verification should complete before unblocking writes.

---

## Phase 4 — Post-cutover (week of 2026-05-04 onwards)

| Day | Action |
|-----|--------|
| Sun | Monitor: confirm nightly ETL ran cleanly on target at 1:15 AM UTC. Spot-check reconciliation JSON. |
| Mon | Confirm Ripple chat history continues, audit log entries persist. |
| Tue–Fri | Normal use. Source remains running but offline (containers down, cloudflared down). |
| **Day 7 (2026-05-09 Sat)** | Decommission source: cancel personal Hostinger subscription `Azz5B5V9vdJnb7Pov`, take final snapshot for archive, release VM 1317522. |

(Retention window of 7 days is recommended default — adjust per Ross's risk tolerance.)

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | pg_dump corrupts under load | Low | High | App stack is down before dump; `--format=custom` checksums; round-trip dry run in Phase 0.6 |
| R2 | pgvector extension version mismatch on target | Med | High | Pin `pgvector/pgvector:pg16` image — same as source. Verify `\dx` on target after restore. |
| R3 | Tunnel credential conflict (split-brain) | Low | High | Stop source cloudflared *before* starting target. Cloudflared logs the active connection — verify before declaring GO. |
| R4 | rclone OneDrive token rejected on new IP | Med | Med | Test in Phase 0.6 by running rclone manually from target. Re-auth via OAuth flow if needed (browser-based). |
| R5 | DNS TTL caching causes intermittent routing | Negligible | Low | Tunnel-credential approach avoids DNS edits entirely. |
| R6 | OneDrive blocks new IP as suspicious | Low | Med | If hit, Microsoft typically requires interactive sign-in; have Ross's MS account credentials available. |
| R7 | Hostinger firewall blocks inbound on target | Med | High | Check `firewall_group_id` on target VM (currently `null` — unrestricted). Verify SSH (22), Cloudflared outbound (443) work. |
| R8 | Postgres data dir UID/GID mismatch | Low | Med | Use Docker volumes (managed by Docker), not bind mounts — no UID issues. Verify `docker compose ps postgres` healthy. |
| R9 | Schema-governance scaffold expects specific paths | Low | Low | Files live under `/opt/splashworks/docs/data-governance/` — moves with repo clone. |
| R10 | Crons exist outside captured crontab (e.g., systemd timers) | Med | Med | Phase 0.1 runs `systemctl list-timers` + `crontab -l` for both root and user accounts. |
| R11 | `/var/lib/docker` size on source > target free space | Low | High | Phase 0.1 captures `du -sh /var/lib/docker` — abort if > 150 GB. Currently expected ~10–20 GB. |
| R12 | Source IP is whitelisted in any external system (Stripe, Slack webhooks, customer integrations) | Med | Med | Audit `.env` and any IP-allowlist references. Update whitelists during Phase 0 to include target IP. |

---

## Open decisions (Ross)

Need answers before Phase 0 starts:

1. **Cutover window:** Friday night, Saturday day, **Saturday 10pm CT (recommended)**, or Sunday?
2. **Source retention:** decommission immediately on success, **7 days (recommended)**, or hold until next billing cycle?
3. **Tunnel strategy:** **move existing tunnel credentials (recommended — zero DNS work)**, or create a new tunnel + update CF DNS?
4. **Pre-flight prod read access:** OK to SSH read-only to source for Phase 0.1 inventory? Production reads need explicit confirmation.
5. **External IP whitelists:** any third-party services (Stripe webhooks, customer integrations, monitoring) that whitelist source IP `76.13.29.44`?

---

## Out of scope for this runbook

- Recreating Cloudflare Access policies (no change needed; already in CF dashboard).
- Domain/DNS migration (already in Cloudflare; tunnel approach avoids DNS edits).
- Postgres major-version upgrade (target uses same Postgres 16 image).
- Application changes — all code moves verbatim via `git clone`.
- ETL-9 schema-governance rollout — independent stream.

---

## Artifacts produced by this migration

- This runbook → committed to `feature/in-vps-migration`.
- Pre-cutover row-count snapshot → captured in Phase 1 step T+0:00, persisted in `docs/runbooks/2026-05-vps-migration-snapshot.md` post-cutover.
- Post-cutover verification log → appended to this file as a new section.
- BACKLOG entry **IN-10** → added on this branch.

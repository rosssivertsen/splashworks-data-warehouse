# VPS Migration Runbook — May 2026

**Status:** READY for Phase 0.6 (dump/restore dry run) and Phase 1 cutover. All pre-flight discovery complete.
**Stream:** IN (Infrastructure)
**Branch:** `feature/in-vps-migration`
**Authored:** 2026-05-01
**Updated:** 2026-05-01 (post-audit revisions)

---

## Source → Target

| | Source | Target |
|---|---|---|
| **VM ID** | 1317522 | 1590691 |
| **Hostinger account** | personal (`Azz5B5V9vdJnb7Pov`) | splashworks (`AzygFAVGsJsVM1zNY`) |
| **Plan** | KVM-2 (2 CPU / 8 GB RAM / 100 GB disk / 8 TB BW) | KVM-4 (4 CPU / 16 GB RAM / 200 GB disk / 16 TB BW) |
| **Hostname** | srv1317522.hstgr.cloud | srv1590691.hstgr.cloud |
| **IPv4** | 76.13.29.44 | 2.24.202.170 |
| **DC** | 17 | 24 |
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **Disk usage** | 30 GB / 96 GB (32%) | 3 GB / 193 GB (2%) |

---

## Decisions locked in (2026-05-01)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Cutover window | Not weekend-bound; "material amount done as quickly as possible" over the next week |
| 2 | Source retention | **Indefinite** — no decommission timer |
| 3 | Tunnel strategy | **Move tunnel via token-based systemd unit copy** |
| 4 | Production-read access | **Authorized** — full root credentials |
| 5 | External IP whitelists | None expected; no SLA-bound external customer traffic |

Domain → separate Cloudflare account is a **post-migration project**, out of scope here.

---

## Audit findings (2026-05-01) — what's actually running on source

### Application stack (8 containers, all healthy 26h)

| Container | Port | Public route |
|---|---|---|
| `splashworks-postgres` (pgvector/pgvector:pg16) | 5432 | internal |
| `splashworks-api` | 8080 | api.splshwrks.com |
| `splashworks-frontend` | 3001 | app.splshwrks.com |
| `splashworks-metabase` (metabase/metabase:latest) | 3000 | bi.splshwrks.com |
| `splashworks-ripple-api` | 8082 | ripple.splshwrks.com (via ripple-frontend) |
| `splashworks-ripple-frontend` | 3003 | ripple.splshwrks.com |
| `splashworks-staging-api` | 8081 | staging-api.splshwrks.com |
| `splashworks-staging-frontend` | 3002 | staging-app.splshwrks.com |

### Postgres state

- **Single database:** `splashworks` (12 GB) — schemas `public`, `public_staging`, `public_warehouse`, `public_semantic`, `ripple`, `etl` all live inside this one DB
- **Superuser role:** `splashworks` (NOT `postgres`)
- **Other roles:** `splashworks_ro`, `ripple_rw`, `metabase_ro`
- **Volume:** `splashworks_pg_data` (Docker-managed, 14 GB on host)

### Cloudflared

- **Mode:** token-based (`tunnel run --token <base64>`) — *not* credentials-file mode
- **Tunnel ID:** `f062b2e4-2fed-4575-85ea-f9f9f39e5525`
- **Config file:** `/etc/cloudflared/config.yml` exists but is **vestigial** — token mode ignores it. Routing is managed in the Cloudflare dashboard.
- **Systemd unit:** `/etc/systemd/system/cloudflared.service` — token is embedded in `ExecStart`. This is the file we move.
- **Active service:** `systemctl is-active cloudflared` → `active`

### Cron / scheduled work

- **Root crontab:** `15 1 * * * /opt/splashworks/etl/scripts/nightly-pipeline.sh >> /opt/splashworks/data/pipeline-cron.log 2>&1`
- **No systemd timers for app workload** (only stock Ubuntu housekeeping)

### Other

- **Repo:** `/opt/splashworks/` on commit `3602c69` (latest main), clean working tree
- **`.env`:** 10 lines, secrets including DB password, Anthropic key, OpenAI key
- **rclone:** `onedrive:` remote configured

---

## Audit findings (2026-05-01) — what's running on target

- **Already running:** `jomo-inventory` (port 8000) + `jomo-inventory-staging` (port 8001) — separate Splashworks app, healthy 11+ days. **MUST NOT BE DISTURBED.**
- **Port conflicts with warehouse stack:** **None** (warehouse uses 3000-3003, 5432, 8080-8082; jomo uses 8000-8001).
- **Pre-installed:** Docker 29.4.0, docker compose v5.1.3, **cloudflared 2026.3.0 (binary present, not configured)**, git, curl
- **Not yet installed:** rclone, postgresql-client (for pg_dump/restore)
- **Firewall:** UFW inactive; iptables `policy ACCEPT`. Docker manages its own iptables rules.
- **`/etc/cloudflared/`:** does not exist yet
- **Cron:** empty
- **SSH:** Ross's key authorized; access confirmed

---

## Strategy: token-based tunnel handoff + maintenance-window cutover

Cloudflare tunnel uses **token-based authentication**, not credentials-file mode. Tunnel "movement" is just installing the same systemd unit (with embedded token) on the target and starting it. Cloudflare load-balances between tunnel replicas if both are running, but we'll sequence stop-source-then-start-target to avoid split-brain Postgres writes.

DNS records and ingress routing live in the Cloudflare dashboard, keyed by tunnel ID `f062b2e4-2fed-4575-85ea-f9f9f39e5525`. Zero DNS work required.

Estimated downtime: **20-30 minutes** for stop → pg_dump (12 GB compressed to ~2-4 GB) → scp → pg_restore → start. Verification adds ~30 minutes (Phase 2).

---

## Phase 0 — Pre-flight (in progress)

| # | Step | Status | Notes |
|---|------|--------|-------|
| 0.1 | Source audit (read-only) | ✅ DONE 2026-05-01 | Findings in section above |
| 0.2 | Target audit | ✅ DONE 2026-05-01 | Findings in section above |
| 0.3a | Install rclone on target | TODO | `apt install rclone` |
| 0.3b | Install postgresql-client-16 on target | TODO | `apt install postgresql-client-16` |
| 0.3c | Pre-create `/etc/cloudflared/` directory on target | TODO | Permissions: 755 root:root |
| 0.4 | Clone repo on target into `/opt/splashworks/` | TODO | Same path as source for parity |
| 0.4b | Copy `.env` from source to target | TODO | scp; chmod 600; gated on cutover window |
| 0.5 | `docker compose pull` on target (pre-pull all images) | TODO | Compose file uses pgvector/pgvector:pg16 + custom-built api/frontend/ripple |
| 0.5b | `docker compose build` on target (custom images) | TODO | api, frontend, ripple-api, ripple-frontend, staging-* are built locally from repo |
| 0.6 | Dump/restore round-trip dry run | TODO | Use `splashworks` DB → `splashworks_test`, verify counts. **Highest-value rehearsal step.** |
| 0.7 | Configure rclone OneDrive on target | TODO | OAuth flow may require browser-based re-auth — Ross's MS account |
| 0.8 | Disable nightly cron on source | TODO | Right before Phase 1 starts. Not earlier — we want fresh data through last night. |
| 0.9 | Snapshot row counts on source | TODO | Pre-cutover comparison baseline |

---

## Phase 1 — Cutover sequence

```
T+0:00  ssh source: crontab -l > /tmp/source-crontab.bak  # save before disabling
T+0:00  ssh source: crontab -r                            # disable nightly cron
T+0:00  ssh source: cd /opt/splashworks && docker compose down
T+0:01  ssh source: docker run --rm -v splashworks_pg_data:/var/lib/postgresql/data \
                    -e POSTGRES_USER=splashworks -e POSTGRES_DB=splashworks \
                    pgvector/pgvector:pg16 bash -c \
                    "pg_dumpall -U splashworks --globals-only > /tmp/globals.sql"
                    # Tricky — Postgres needs to be UP for dump. Better:
T+0:01  ssh source: docker compose up -d postgres        # bring postgres back up only
T+0:02  ssh source: docker exec splashworks-postgres bash -c \
                    "pg_dumpall -U splashworks --globals-only" > /tmp/globals.sql
T+0:03  ssh source: docker exec splashworks-postgres bash -c \
                    "pg_dump -U splashworks --format=custom --no-owner --no-privileges \
                     --jobs=2 splashworks" > /tmp/splashworks.dump
        # ~3-8 minutes for 12 GB → ~2-4 GB compressed
T+0:11  scp source:/tmp/splashworks.dump /tmp/globals.sql target:/tmp/
        # ~2-5 minutes depending on egress bandwidth
T+0:15  ssh target: mkdir -p /opt/splashworks
T+0:15  ssh target: cd /opt/splashworks && git clone https://github.com/rosssivertsen/splashworks-data-warehouse.git .
T+0:16  ssh target: scp source:/opt/splashworks/.env /opt/splashworks/.env && chmod 600 .env
T+0:17  ssh target: cd /opt/splashworks && docker compose up -d postgres
        # Wait for healthcheck
T+0:19  ssh target: docker exec splashworks-postgres bash -c \
                    "psql -U splashworks -d postgres -f /tmp/globals.sql"
T+0:19  ssh target: docker exec splashworks-postgres bash -c \
                    "createdb -U splashworks splashworks"
T+0:20  ssh target: docker exec splashworks-postgres bash -c \
                    "pg_restore -U splashworks --no-owner --no-privileges \
                     --jobs=4 -d splashworks /tmp/splashworks.dump"
        # ~5-10 minutes
T+0:28  ssh target: docker exec splashworks-postgres psql -U splashworks -d splashworks \
                    -c "VACUUM ANALYZE;"
T+0:30  Move cloudflared service:
        scp source:/etc/systemd/system/cloudflared.service target:/etc/systemd/system/
T+0:31  ssh source: systemctl stop cloudflared && systemctl disable cloudflared
T+0:32  ssh target: systemctl daemon-reload && systemctl enable --now cloudflared
        # Tunnel reattaches from new IP; CF dashboard sees new connection
T+0:33  ssh target: cd /opt/splashworks && docker compose up -d
        # api, frontend, metabase, ripple-*, staging-*
T+0:35  Begin verification (Phase 2)
```

If anything fails between T+0:30 and T+0:35 → see **Rollback** below.

---

## Phase 2 — Verification

Run in this order — each step gates the next:

1. **Tunnel reattach:** `ssh target: journalctl -u cloudflared -n 50` shows `Connection registered with protocol`. Old connections from source IP are gone.
2. **Public reachability:** off-network, `curl -I https://app.splshwrks.com` → expect 302 (CF Access). `curl -I https://api.splshwrks.com/api/health` → expect 302 or 200.
3. **CF Access:** browser login at app.splshwrks.com via GitHub OAuth.
4. **Database integrity** — compare to pre-cutover snapshot:
   ```sql
   SELECT 'dim_customer'      AS t, count(*) FROM public_warehouse.dim_customer
   UNION ALL SELECT 'fact_service_stop',  count(*) FROM public_warehouse.fact_service_stop
   UNION ALL SELECT 'fact_payment',       count(*) FROM public_warehouse.fact_payment
   UNION ALL SELECT 'fact_invoice_item',  count(*) FROM public_warehouse.fact_invoice_item
   UNION ALL SELECT 'rpt_customer_360',   count(*) FROM public_semantic.rpt_customer_360
   UNION ALL SELECT 'query_audit_log',    count(*) FROM public.query_audit_log
   UNION ALL SELECT 'ripple chunks',      count(*) FROM ripple.chunks;
   ```
5. **Postgres roles:** `\du` shows `splashworks`, `splashworks_ro`, `ripple_rw`, `metabase_ro`.
6. **AI query path:** post a known-verified query to `/api/query`. Expect SQL generation + execution.
7. **Metabase:** load bi.splshwrks.com, run a saved question.
8. **Ripple:** ripple.splshwrks.com answers a known doc-RAG question (verifies pgvector).
9. **JOMO Inventory still healthy on target:** `docker ps | grep jomo` shows both containers up. (Confirms our work didn't disturb them.)
10. **ETL dry run:** manually invoke `nightly-pipeline.sh` (or a dry-run flag if implemented) — confirms rclone OneDrive auth works from new IP.
11. **Re-enable nightly cron** on target: `crontab` with the original entry.

If 1–8 pass: cutover is **GO**. 9 confirms isolation. 10–11 are operational follow-ups.

---

## Phase 3 — Rollback (only valid before any writes hit target)

Source has been *stopped* but kept indefinitely (per decision #2).

1. `ssh target: systemctl stop cloudflared && cd /opt/splashworks && docker compose down`
2. `ssh target: systemctl disable cloudflared`
3. `ssh source: systemctl enable --now cloudflared && cd /opt/splashworks && docker compose up -d`
4. `ssh source: crontab /tmp/source-crontab.bak` to restore the nightly cron
5. Tunnel reattaches from source IP. Public traffic flows back.

**Critical constraint:** rollback is only valid before users start writing to target. Once query_audit_log entries / Ripple chat / Metabase saved questions accumulate on target, rolling back loses those writes. Phase 2 verification should complete before unblocking writes.

---

## Phase 4 — Post-cutover

| Day | Action |
|-----|--------|
| Day 1 | Confirm nightly ETL ran cleanly on target at 1:15 UTC. Spot-check `data/reconciliation.json`. |
| Day 2-7 | Normal use; monitor logs. |
| Day 7+ | Source remains paused but intact (no auto-decommission per decision #2). |
| Future | Domain migration to separate Cloudflare account — separate project. |

---

## Risk register (post-audit revision)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | pg_dump corrupts under load | Low | High | App stack stopped; `--format=custom` checksums; **Phase 0.6 dry run is mandatory** |
| R2 | pgvector version mismatch | Negligible | High | Same `pgvector/pgvector:pg16` image on both sides. Verify `\dx` post-restore. |
| R3 | Tunnel split-brain (both connected) | Low | Med | Sequence: stop source first; verify in CF dashboard before re-enabling target writes |
| R4 | rclone OneDrive token rejected on new IP | Med | Med | Re-auth in Phase 0.7 via OAuth browser flow; works because Ross has the MS account |
| R5 | DNS TTL caching | Negligible | Low | Token-based tunnel; no DNS edits |
| R6 | OneDrive flags new IP | Low | Med | Microsoft typically requires interactive sign-in once; do during Phase 0.7 |
| R7 | Hostinger firewall blocks inbound on target | Negligible | High | Target `firewall_group_id = null` (unrestricted); UFW inactive. Verified in audit. |
| R8 | Postgres data volume mount issue | Low | Med | Docker-managed volume; same image; no UID issues |
| R9 | Disrupts JOMO Inventory on target | Low | High | No port conflicts; separate compose project; verify in Phase 2.9 |
| R10 | Custom Docker images need rebuild on target | High | Low | Phase 0.5b explicitly builds; confirm before cutover |
| R11 | `.env` includes secrets — file permissions | Low | High | scp + chmod 600; verify on target |
| R12 | Source IP whitelisted somewhere unexpected | Low | Med | Per decision #5: none expected. Monitor for failures post-cutover. |
| R13 | Hostinger personal-account billing lapses (source kept indefinitely) | Med | Low | Source retention costs ~one KVM-2 plan/mo; accept. |

---

## Open work after this runbook closes

- **DL-14 recurring-checklist report** (separate branch `feature/dl-recurring-checklist`) — independent.
- **Skimmer Service Checklist data request** — pending Glenn's reply.
- **Domain migration to separate CF account** — out of scope for this runbook; separate future project.
- **ETL-9 schema-governance rollout** — independent.

---

## Artifacts

- This runbook → `feature/in-vps-migration` branch
- Pre-cutover row-count snapshot → captured in Phase 0.9, persisted in this file post-cutover
- Phase 2 verification log → appended here post-cutover
- BACKLOG entry **IN-10**

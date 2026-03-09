# Metabase + Power BI Connectivity — Design

## Goal

Add Metabase (open source BI tool) as a browser-based dashboard layer on top of the existing Postgres warehouse, and document Power BI Desktop connectivity via SSH tunnel.

## Architecture

```
Browser → bi.splshwrks.com → Cloudflare Access → Cloudflare Tunnel → localhost:3000 → Metabase container → postgres:5432
Power BI Desktop → localhost:5432 (SSH tunnel) → VPS postgres:5432
```

## Metabase

- **Image:** `metabase/metabase:latest` (Community Edition, AGPL, free)
- **Port:** 3000 (localhost only, routed via Cloudflare Tunnel)
- **Subdomain:** `bi.splshwrks.com` (already reserved in DNS)
- **Auth:** Cloudflare Access (add `bi.splshwrks.com` to existing Access application)
- **Database connection:** Internal Docker network to `postgres:5432` (same as API service)
- **Metadata storage:** Embedded H2 (default, fine for small team — migrate to Postgres later if needed)
- **Schemas to expose:** `public_warehouse`, `public_semantic` (NOT `public_staging` or raw tables)

### Docker Compose Addition

```yaml
metabase:
  image: metabase/metabase:latest
  container_name: splashworks-metabase
  environment:
    MB_DB_TYPE: h2
    JAVA_TIMEZONE: America/New_York
  ports:
    - "127.0.0.1:3000:3000"
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

### First-Time Setup (in browser)

1. Go to `bi.splshwrks.com` after deployment
2. Metabase setup wizard: create admin account, add Postgres database
3. Database config: host=`postgres`, port=`5432`, db=`splashworks`, user=`splashworks`, password from `.env`
4. Restrict visible schemas to `public_warehouse` and `public_semantic`

## Power BI Desktop (SSH Tunnel)

For local Power BI access (Ross only):

```bash
ssh -L 5432:localhost:5432 root@76.13.29.44
```

Then in Power BI Desktop:
- Data source: PostgreSQL
- Server: `localhost:5432`
- Database: `splashworks`
- User: `splashworks`
- Password: from VPS `.env`

## Cloudflare Tunnel Update

Add route in Cloudflare Tunnel dashboard:
- Public hostname: `bi.splshwrks.com`
- Service: `http://localhost:3000`

Add `bi.splshwrks.com` to the existing Cloudflare Access application policy.

## Read-Only Database User (future)

For production hardening, create a `metabase_ro` Postgres user with SELECT-only on warehouse/semantic schemas. Not needed for MVP — the `splashworks` user is fine for now.

## What Changes

- `docker-compose.yml` — add metabase service
- Cloudflare Tunnel — add bi.splshwrks.com route
- Cloudflare Access — add bi.splshwrks.com to application

## What Does NOT Change

- No frontend code changes
- No backend code changes
- No dbt model changes
- No nginx changes

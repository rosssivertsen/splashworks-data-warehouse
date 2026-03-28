# Repository Bifurcation: SPA Archive + Warehouse Promotion

**Date:** 2026-03-10
**Status:** Approved
**Branch:** feature/warehouse-etl

## Context

The repo `pool-service-bi-dashboard` (local dir: `Skimmer-AI-Query-Visualization`) contains two divergent products:

1. **Original SPA** — React + sql.js, client-side SQLite, Netlify deployment, Netlify Functions for AI proxy
2. **Data Warehouse MVP** — React + FastAPI + Postgres + dbt, VPS deployment, Docker Compose

The SPA is deprecated. The warehouse is the active product. They share the React frontend (`src/`) which is backend-agnostic.

## Decision

- Promote the warehouse (`feature/warehouse-etl`) to `main`
- Archive the SPA as a tagged branch
- Remove SPA-only artifacts from `main`
- Rename the GitHub repo to `splashworks-data-warehouse`

## Steps

### 1. Disconnect Netlify

Disconnect the repo from Netlify's auto-deploy settings (or delete the Netlify site). Must happen BEFORE merging to `main` to prevent a broken deploy trigger.

### 2. Disable GitHub Actions deploy workflow

Remove `.github/workflows/deploy.yml` (Netlify deploy pipeline) from the feature branch before merging. Also clean up `.github/workflows/ci-cd.yml.disabled` if present.

### 3. Archive the SPA

```bash
git checkout main
git checkout -b legacy/spa
git tag v0-spa-archive -m "Archive: original SPA before warehouse promotion"
git push origin legacy/spa
git push origin v0-spa-archive
```

### 4. Merge warehouse into main

Main's HEAD (`cc0bf00`) is the merge base — no divergent commits on main. Fast-forward is possible and preferred:

```bash
git checkout main
git merge --ff-only feature/warehouse-etl
```

If `--ff-only` fails (due to step 2 changes on the feature branch), fall back to:

```bash
git merge feature/warehouse-etl -m "Promote data warehouse MVP to main"
```

### 5. Remove SPA-only files from main

Delete from `main` after merge:
- `netlify/` — Netlify serverless functions
- `netlify.toml` — Netlify build config
- `src-legacy/` — legacy frontend code (15 files, unused)
- `.github/workflows/deploy.yml` — Netlify deploy pipeline (if not already removed in step 2)
- `wrangler.toml` — Cloudflare Workers config (SPA era; warehouse uses Tunnels)
- `wrangler.jsonc` — Cloudflare Workers config variant

Keep:
- `src/` — React frontend (serves the warehouse)
- Everything else (docs, dbt, etl, api, cli, scripts, infrastructure, Docker)

### 6. Verify

```bash
npm run build        # Frontend still builds
npm run test         # Tests pass
```

### 7. Rename GitHub repo

```bash
gh repo rename splashworks-data-warehouse
```

GitHub automatically sets up redirects from the old URL.

### 8. Update VPS remote and branch

Check current VPS remote protocol (SSH vs HTTPS) and match it:

```bash
# On VPS — check current remote
git remote -v

# Update URL (use SSH if that's what VPS uses)
git remote set-url origin git@github.com:rosssivertsen/splashworks-data-warehouse.git

# Switch to main
git fetch origin
git checkout main
git pull
```

Containers continue running — rebuild only if code changed.

### 9. Update documentation

- Update `CLAUDE.md` — remove Netlify references, update repo name
- Update memory files — reflect new repo name and branch strategy
- Review `.env.example` — ensure it reflects warehouse-only config

### 10. Clean up branches (local + remote)

```bash
# Local
git branch -d feature/warehouse-etl
git branch -d staging
git branch -d development

# Remote
git push origin --delete feature/warehouse-etl
git push origin --delete staging
git push origin --delete development
```

Retain `legacy/spa` branch and `v0-spa-archive` tag on remote.

## What's preserved

- Full git history (every commit from SPA and warehouse eras)
- SPA snapshot on `legacy/spa` branch + `v0-spa-archive` tag
- GitHub URL redirects from old repo name

## What's removed from main

- `netlify/` directory
- `netlify.toml`
- `src-legacy/`
- `wrangler.toml` + `wrangler.jsonc`
- `.github/workflows/deploy.yml`

## Risks

- **Netlify auto-deploy:** Mitigated by disconnecting in Step 1 before merge.
- **GitHub redirects:** Old URLs redirect automatically. No broken links.
- **VPS:** Just a remote URL + branch update. No service disruption.
- **Merge conflicts:** None expected — main has no commits ahead of the feature branch.

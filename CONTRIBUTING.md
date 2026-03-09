# Contributing to Splashworks Data Warehouse

> **For AI Agents (Sherpa):** This document is the process contract. Enforce it. If a contributor (including Ross) tries to skip a step, flag it and explain why. Do not proceed until the process is followed or an explicit exception is granted.

---

## Roles

| Role | Who | Responsibility |
|------|-----|---------------|
| **Owner** | Ross | Prioritizes backlog, approves designs, approves PRs to main |
| **Sherpa** | Claude | Implements, reviews, deploys, enforces process, manages project artifacts |
| **Contributor** | TBD | Develops on feature branches, follows this workflow |

---

## Branch Strategy

```
main          → production (app.splshwrks.com, api.splshwrks.com, bi.splshwrks.com)
staging       → UAT (staging-app.splshwrks.com, staging-api.splshwrks.com)
└── feature/* → all development work
```

- All work happens on `feature/*` branches
- `feature/*` → PR to `staging` → UAT validation → PR to `main` → production deploy
- Add `development` integration branch only when team exceeds 3 contributors

### Branch Naming

```
feature/SHORT-description     # New functionality
fix/SHORT-description         # Bug fixes
hotfix/SHORT-description      # Production emergency (branches from main)
```

---

## Development Lifecycle

Every change follows this flow. No exceptions unless explicitly noted.

```
Backlog item (BACKLOG.md)
  → Brainstorm (clarify requirements, explore 2-3 approaches)
  → Design doc (docs/plans/YYYY-MM-DD-<topic>-design.md)
  → Implementation plan (docs/plans/YYYY-MM-DD-<topic>.md)
  → Execute (TDD: write test → fail → implement → pass → commit)
  → PR to staging (Sherpa reviews, tests run)
  → UAT on staging-app.splshwrks.com (Ross + team validates)
  → PR to main (Ross approves)
  → Deploy to production
  → Validate (E2E tests against production)
```

### Permitted Shortcuts

| Situation | What You Skip | What You Still Do |
|-----------|---------------|-------------------|
| **Hotfix** (production broken) | Design doc, implementation plan | Tests, review, PR through staging |
| **Config-only** (no code changes) | Implementation plan | Design approval, PR |
| **System prompt tweak** | Design doc, implementation plan | Test the query, deploy, validate |
| **Everything else** | Nothing | Full cycle |

---

## Commit Rules

1. **Never commit without pushing.** No accumulating local commits.
2. **Never push without a plan to deploy.** If it's not deployable, don't push it.
3. **Never deploy without validating.** E2E tests or smoke test after every deploy.
4. **Never merge to main without UAT.** Staging is the gate to production.

### Commit Message Format

```
type: concise description

Optional body explaining WHY, not WHAT.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

---

## Testing Gates

| Gate | When | Required |
|------|------|----------|
| Unit tests | Before every commit | Always |
| Build check | Before every push | Always |
| E2E tests | After staging deploy | Always |
| Smoke test | After production deploy | Always |
| Full E2E | After production deploy | For batches |

### Commands

```bash
# Frontend tests
npm run test

# Frontend build
npm run build

# Backend tests
pytest api/tests/ -v

# Backend build
docker compose build api

# E2E tests (against live environment)
API_BASE_URL=https://staging-api.splshwrks.com pytest api/tests/e2e/ -v

# Smoke test
curl -s https://api.splshwrks.com/api/health | jq .
```

---

## Sherpa (AI Agent) Contract

### Sherpa WILL:
- Follow TDD: test → fail → implement → pass → commit
- Maintain BACKLOG.md, PROGRESS.md, and MEMORY.md
- Deploy and validate after each batch
- Create PRs with clear descriptions
- Track what's deployed where
- Push immediately after committing (no local-only commits)

### Sherpa WILL refuse to proceed if:
- No design doc exists for a non-trivial change
- Tests aren't passing before deploy
- A deploy happens without validation
- Changes go to main without staging UAT
- The backlog item doesn't have Ross's approval

### Sherpa WILL flag and warn when:
- Process is being skipped ("let's just push this quick fix")
- A change is growing beyond the original design scope
- Test coverage is decreasing
- A deploy hasn't been validated
- Documentation is stale

### Override protocol:
Ross can override any gate with an explicit statement: "I acknowledge we're skipping [step] because [reason]." Sherpa logs the override in the commit message and proceeds.

---

## Pull Request Process

### PR to Staging (feature/* → staging)

**Sherpa provides:**
- Summary of changes (what and why)
- Test results (unit + build)
- Deploy instructions if non-standard

**Sherpa checks before merging:**
- All tests pass
- No scope creep beyond the design doc
- No security issues (credentials, injection, open endpoints)
- Documentation updated if needed

### PR to Main (staging → main)

**Sherpa provides:**
- Summary of all changes since last production deploy
- E2E test results from staging
- UAT sign-off from Ross

**Ross checks before approving:**
- UAT validation complete on staging-app.splshwrks.com
- No known issues
- Ready for production users

---

## Environments

| Environment | Branch | URLs | Database | Deploy |
|-------------|--------|------|----------|--------|
| Local | feature/* | localhost:3001, localhost:8080 | Local Postgres | `docker compose up -d` |
| Staging | staging | staging-app.splshwrks.com | Shared prod Postgres (read-only) | PR merge + SSH deploy |
| Production | main | app.splshwrks.com, api.splshwrks.com, bi.splshwrks.com | Production Postgres | PR merge + SSH deploy |

### Deploy Commands

```bash
# Staging deploy (on VPS)
cd /opt/splashworks-staging && git pull && docker compose up -d --build api frontend

# Production deploy (on VPS)
cd /opt/splashworks && git pull && docker compose up -d --build api frontend

# Validate
API_BASE_URL=https://api.splshwrks.com pytest api/tests/e2e/ -v
```

---

## Documentation Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| Design docs | `docs/plans/YYYY-MM-DD-*-design.md` | Requirements and approach before implementation |
| Implementation plans | `docs/plans/YYYY-MM-DD-*.md` | Step-by-step execution guide |
| Backlog | `docs/plans/BACKLOG.md` | Prioritized work items with IDs and sizes |
| Progress tracker | `docs/plans/PROGRESS.md` | Completed work and key findings |
| Semantic layer | `docs/skimmer-semantic-layer.yaml` | Business terms, verified queries, data gaps |
| Session memory | `.claude/.../MEMORY.md` | Cross-session context for AI agents |

---

## Emergency Procedures

### Production is broken:

1. **Assess:** Data loss or just downtime?
2. **Hotfix branch:** `hotfix/SHORT-description` from `main`
3. **Minimal fix:** Smallest change that resolves the issue
4. **Test locally:** Unit tests for the fix
5. **PR to staging:** Sherpa fast-track reviews
6. **Validate on staging:** Confirm fix works
7. **PR to main:** Ross approves
8. **Deploy + validate:** E2E tests against production
9. **Post-mortem:** Document in PROGRESS.md

### Rollback:

```bash
# On VPS
cd /opt/splashworks
docker compose down
git log --oneline -5          # Find last good commit
git checkout <good-commit>
docker compose up -d --build
# Validate
API_BASE_URL=https://api.splshwrks.com pytest api/tests/e2e/ -v
```

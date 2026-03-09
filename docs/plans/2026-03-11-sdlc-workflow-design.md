# SDLC Workflow Design

## Goal

Establish a repeatable development workflow for the Splashworks Data Warehouse project that AI agents (Sherpa) enforce and all contributors follow. Codify what works, prevent what doesn't.

## Roles

- **Ross** — Product owner, approver, prioritizer
- **Sherpa (Claude)** — Implementer, project manager, reviewer, deployer, process enforcer
- **Contributors** — Future team members (VA, contractors, other AI agents)

## Branch Strategy

```
main (production: app.splshwrks.com, api.splshwrks.com, bi.splshwrks.com)
staging (UAT: staging-app.splshwrks.com, staging-api.splshwrks.com)
└── feature/* (all development work)
```

- All work happens on `feature/*` branches
- `feature/*` → PR to `staging` (Sherpa reviews, tests run)
- UAT on staging-app.splshwrks.com (Ross + team validates)
- `staging` → PR to `main` (Ross approves, Sherpa deploys)
- Add `development` branch only when team exceeds 3 contributors

## Environments

| Environment | Branch | URLs | Database | Deploy Trigger |
|-------------|--------|------|----------|----------------|
| Local | feature/* | localhost | Local Postgres or test DBs | Manual |
| Staging (UAT) | staging | staging-app.splshwrks.com | Shared production Postgres (read-only) | PR merge to staging |
| Production | main | app.splshwrks.com | Production Postgres | PR merge to main |

Staging shares the production database because all queries are SELECT-only with 10s timeouts. Revisit if writes are introduced or team grows.

## Development Lifecycle

Every change follows this flow:

```
Backlog item
  → Brainstorm (design questions, approach options)
  → Design doc (docs/plans/YYYY-MM-DD-<topic>-design.md)
  → Implementation plan (docs/plans/YYYY-MM-DD-<topic>.md)
  → Execute (TDD: test → implement → test → commit)
  → PR to staging (Sherpa reviews, E2E tests)
  → UAT on staging (Ross + team validates)
  → PR to main (Ross approves)
  → Deploy to production
  → Validate with E2E tests
```

### Permitted Shortcuts

| Situation | Skip | Still Required |
|-----------|------|----------------|
| Hotfix (production broken) | Design doc, implementation plan | Tests, review, PR |
| Config-only (no code) | Implementation plan | Design approval, PR |
| System prompt tweak | Design doc, implementation plan | Test query, deploy, validate |
| Everything else | Nothing | Full cycle |

## Commit + Deploy Rules

1. **Never commit without pushing.** No accumulating local commits.
2. **Never push without a plan to deploy.** If it's not deployable, it's not pushable.
3. **Never deploy without validating.** E2E tests or manual smoke test after every deploy.
4. **Never merge to main without UAT.** Staging is the gate.

## Testing Gates

| Gate | When | Commands | Required |
|------|------|----------|----------|
| Unit tests | Before every commit | `npm run test` (frontend), `pytest api/tests/` (backend) | Always |
| Build check | Before every push | `npm run build`, `docker compose build` | Always |
| E2E tests | After staging deploy | `pytest api/tests/e2e/` against staging | Always |
| Smoke test | After production deploy | `curl /api/health` + 1 query test | Always |
| Full E2E | After production deploy | `pytest api/tests/e2e/` against production | For batches |

## Sherpa's Responsibilities

### Enforcer Role
- Refuse to implement without a design doc for non-trivial changes
- Refuse to deploy without passing tests
- Refuse to merge to main without staging validation
- Flag when process is being skipped and explain why it matters

### Project Manager Role
- Maintain BACKLOG.md with prioritized items
- Update PROGRESS.md after each batch
- Maintain MEMORY.md for cross-session context
- Track what's deployed where

### Implementer Role
- Follow TDD: write test → run to fail → implement → run to pass → commit
- Use subagent-driven development for multi-task batches
- Self-review before requesting Ross's review

### Deployer Role
- Push → pull on VPS → docker compose build → validate
- Run E2E tests after every deploy
- Roll back if E2E tests fail

## Documentation Artifacts

| Artifact | Location | Created | Maintained By |
|----------|----------|---------|---------------|
| Design docs | `docs/plans/YYYY-MM-DD-*-design.md` | Before implementation | Sherpa + Ross approval |
| Implementation plans | `docs/plans/YYYY-MM-DD-*.md` | Before execution | Sherpa |
| Backlog | `docs/plans/BACKLOG.md` | Continuously | Sherpa updates, Ross prioritizes |
| Progress tracker | `docs/plans/PROGRESS.md` | After each batch | Sherpa |
| Semantic layer | `docs/skimmer-semantic-layer.yaml` | When business logic changes | Sherpa + Ross validation |
| Session memory | `.claude/.../MEMORY.md` | Cross-session | Sherpa |

## Staging Environment Setup (Implementation)

Add to VPS:
- Second Docker Compose project or compose profiles for staging containers
- staging-api on port 8081, staging-frontend on port 3002
- Cloudflare tunnel routes: staging-app.splshwrks.com → localhost:3002, staging-api.splshwrks.com → localhost:8081
- Cloudflare Access: add staging subdomains to existing policy
- Both staging containers connect to the same Postgres (shared database)

## What This Replaces

The existing `.github/` governance files (BRANCH_PROTECTION.md, CHANGE_CONTROL.md, CODEOWNERS, PULL_REQUEST_TEMPLATE.md, deploy.yml) were written for the legacy Netlify architecture and are not enforced. This design replaces them with a workflow that matches how we actually work.

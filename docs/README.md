# Splashworks Data Warehouse — Documentation Index

**Last Updated:** 2026-03-28

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| **Reference** (long-lived) | `SCREAMING_CASE.md` | `DATA_DICTIONARY.md` |
| **Report** (point-in-time) | `TYPE_YYYY-MM-DD.md` | `SECURITY_AUDIT_2026-03-28.md` |
| **Design/Plan** (dated) | `YYYY-MM-DD-description.md` | `2026-03-07-data-warehouse-mvp-design.md` |
| **Glossary entity** | `kebab-case.md` | `service-location.md` |
| **Config/data** | `kebab-case.yaml` | `skimmer-semantic-layer.yaml` |
| **Asset** | `Description-YYYY-MM-DD.ext` | `Skimmer-Database-ERD-2025-10-30.svg` |

## Directory Structure

```
docs/
  README.md                              # This file
  DATA_DICTIONARY.md                     # Skimmer raw schema — 44 tables, field-level docs
  ERD.md                                 # Entity relationship diagrams (Mermaid)
  skimmer-semantic-layer.yaml            # Business terms, metrics, verified queries, data gaps
  Skimmer-schema.sql                     # Raw SQLite schema DDL
  Skimmer-Database-ERD-*.svg/.png        # Visual ERD exports
  SECURITY_AUDIT_2026-03-28.md           # Security audit findings and remediation status

  enterprise/                            # Enterprise Information Architecture (EIA)
    README.md                            #   Entry point, entity template, how to contribute
    enterprise-index.yaml                #   Machine-readable catalog of all EIA docs
    CLAUDE.md                            #   AI tooling context for this directory
    glossary/                            #   One file per business entity (8 entities)
      customer.md, contact.md, service-location.md, pool.md,
      work-order.md, invoice.md, payment.md, product.md
    standards/                           #   Cross-system rules
      naming-conventions.md
    references/                          #   External API docs
      qbo-accounting-api.md, qbo-payments-api.md
    system-landscape.md                  #   Architecture diagram (Mermaid)

  plans/                                 # Design docs, backlog, progress
    BACKLOG.md                           #   Prioritized work items by stream
    PROGRESS.md                          #   Implementation progress tracker
    AI_STRATEGY.md                       #   AI strategy document
    YYYY-MM-DD-*.md                      #   Dated design and implementation docs (20+)
    ripple-design.md                     #   Ripple RAG agent architecture

  ripple/                                # Ripple RAG corpus
    corpus/                              #   Documents indexed for retrieval
      customer-cancellation-workflow.md
      skimmer-onboarding-resources.md
      Skimmer Training & Workflow Videos.pdf

  archive/                               # Historical docs (not actively maintained)
    v0-spa/                              #   23 files from pre-warehouse SPA era (Oct 2025)
    superpowers/                         #   Completed implementation plans (IN-4, IN-5)
```

## Key References

| Document | Purpose | Audience |
|----------|---------|----------|
| [DATA_DICTIONARY.md](DATA_DICTIONARY.md) | Field-level docs for all 44 Skimmer tables | Developers, AI agents |
| [ERD.md](ERD.md) | Entity relationships (Mermaid diagrams) | Developers, analysts |
| [skimmer-semantic-layer.yaml](skimmer-semantic-layer.yaml) | Business terms, SQL patterns, verified queries | AI query pipeline, developers |
| [enterprise/README.md](enterprise/README.md) | Enterprise glossary entry point | All audiences |
| [enterprise/enterprise-index.yaml](enterprise/enterprise-index.yaml) | Machine-readable doc catalog | AI agents, tooling |
| [plans/BACKLOG.md](plans/BACKLOG.md) | Prioritized backlog by stream | PM, developers |
| [plans/PROGRESS.md](plans/PROGRESS.md) | Implementation status | PM, stakeholders |
| [SECURITY_AUDIT_2026-03-28.md](SECURITY_AUDIT_2026-03-28.md) | Security findings and status | Security, developers |

## Streams

Documentation follows the same stream prefixes as the codebase:

| Prefix | Stream | Docs Location |
|--------|--------|---------------|
| DL- | Data Layer | `plans/` (design docs), root (dictionary, ERD, semantic layer) |
| AQ- | AI Query | `plans/` (design docs), `skimmer-semantic-layer.yaml` |
| EIA- | Enterprise Info Architecture | `enterprise/` |
| DA- | Dashboard | `plans/` (design docs) |
| IN- | Infrastructure | `plans/` (design docs), security audit |
| RP- | Ripple | `plans/ripple-design.md`, `ripple/` |

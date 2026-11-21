# Migration Inventory

Audit date: 21 November 2026
Scope: static repository inspection only; no SQL was executed and no database was contacted.

## Existing mechanisms

| Mechanism | Location | Execution | Tracking | Assessment |
| --- | --- | --- | --- | --- |
| Dated risk migrations | `backend/sql/migrations/*.sql` | Explicit release runner | Manifest plus ledger after this change | Primary forward path; depends on legacy baseline tables |
| Legacy schema bootstrap SQL | `backend/sql/schema-*.sql` | Manual/operational scripts | None | Historical baseline inputs, not ordered migrations |
| Runtime repository DDL | repository `ensure*Schema` functions | Application startup | None | Major drift risk; should be converted incrementally into migrations |
| Runtime service bootstrap DDL | `authBootstrap`, `assetBootstrap`, access governance, activity ledger | Application startup | None | Major drift risk; application startup still mutates schema |
| Seed scripts | `backend/src/scripts/seed-*.ts`, `backend/sql/seed-*.sql` | Manual; formerly production startup | None | Data operation, now separated from application startup |
| Cleanup utility | `backend/cleanup-workspace-constraints.ts` | Manual | None | Destructive compatibility utility; not a migration |

## Ordered migration manifest

All migrations are executed transactionally by the runner even where the SQL file lacks its own wrapper. Checksums are SHA-256 values fixed in `migrationManifest.ts`.

| Order | ID | Purpose | Main objects | Dependency | Source transaction | Idempotent SQL | Historical status/risk |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `20260920-risk-cia-impact` | CIA impact fields | `risks` | baseline `risks` | Yes | Mostly | Existing historical migration |
| 2 | `20260920-risk-treatment-lifecycle` | Treatment lifecycle | `risks` | 1 | Yes | Mostly | Existing historical migration |
| 3 | `20260922-risk-treatment-plans` | Treatment plans | `risk_treatment_plans` | 2, baseline `risks` | Yes | Yes | Existing historical migration |
| 4 | `20260922-treatment-control-links` | Treatment/control join | `risk_treatment_plan_controls` | 3, baseline `controls` | No | Yes | Runner supplies transaction |
| 5 | `20260923-risk-methodologies` | Methodology versions/events | `risk_methodologies`, `risk_methodology_events` | baseline `workspaces` | Yes | Yes | Existing historical migration |
| 6 | `20260923-risk-version-pinning` | Pin risks/treatments | `risks`, `risk_treatment_plans` | 5 | Yes | Mostly | Trigger/function changes; no silent rescoring |
| 7 | `20260924-risk-tenant-rollout` | Workspace rollout mode | `workspaces`, `risk_methodology_mode_events` | 6 | Yes | Mostly | Requires workspace baseline |
| 8 | `20260924-risk-references` | Stable Risk Ref ID | `risks` | 7 | Yes | Mostly | Includes data backfill; runtime validation outstanding |
| 9 | `20260926-risk-report-evidence-workflows` | Report/evidence workflow | four risk workflow tables | 8, `workspaces`, `evidence` | Yes | Yes | Existing historical migration |
| 10 | `20260927-risk-actions` | Action tracker | `risk_actions` | 9, `workspaces` | No | Yes | Runner supplies transaction |
| 11 | `20260927-risk-library` | Risk templates/linkage | `risk_library_templates`, `risks` | 10 | No | Mostly | Previously omitted from runner and masked by runtime DDL |
| 12 | `20260928-weighted-risk-scoring` | Optional weighted scoring | methodology/risk/treatment objects | 11 | Yes | Mostly | Functions/triggers; history preservation required |
| 13 | `20260928-governance-document-compatibility` | Compatibility columns | `governance_documents`, `review_tasks` | legacy governance baseline, 12 | Yes | Mostly | Must precede constraints |
| 14 | `20260928-governance-document-constraints` | Governance constraints | `governance_documents` | 13 | Yes | Mostly | Constraint validation requires compatible data |

## Legacy baseline SQL

Eleven schema files define historical baseline domains: activity log, assets/vendors, authentication, control/governance/training links, core GRC, frameworks, governance review, regulatory change, TPRM, training, training practice, workspace onboarding, and workspaces. These files contain `CREATE TABLE IF NOT EXISTS`, indexes, functions, triggers, and `ALTER TABLE` statements but have no shared ledger or deterministic orchestrator. Some indexes omit `IF NOT EXISTS`, so whole-file reapplication is not reliably idempotent.

## Runtime DDL owners

Runtime schema mutation exists in AI Governance, Audit Management, BCM, Enterprise Operations, ESG, Framework Scope, Privacy, Regulatory, Reporting Center, Risk Actions, Risk Intelligence, Risk Library, Risk Treatment, Treatment Controls, Workspaces, Access Governance, Assets, Authentication, and the Activity Ledger. These routines create more than 80 tables plus indexes and alterations without migration checksums or a ledger.

## Seeds

Core, administration, governance, TPRM, and training-practice seed scripts remain separate data operations. `npm start` no longer invokes migration or core seed automatically. Seeds must never be treated as schema migrations or run implicitly during release startup.

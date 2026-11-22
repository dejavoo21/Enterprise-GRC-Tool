# LAFLO Final Release Handover

## Candidate

- Branch: `codex/polish-login-and-risk-workspaces`
- Baseline: `d626f200053636b425dc0d22b1f387628feccd43`
- Candidate: the scoped commit containing this handover and Audit/CAP verified-closure integration
- Decision: **CONDITIONAL - DATABASE AND RUNTIME GATE**
- Push/deployment: not performed

## Included scope

The candidate includes the nine unpublished commits from `9321a9a` through `d626f20` plus the scoped Audit/CAP release fix. The final fix separates corrective-action completion from independent closure, requires persisted workspace evidence, enforces `Audits.edit` and `Audits.approve`, prevents submitter self-verification, preserves finding/CAP references, and records Activity Ledger events.

## Offline validation

- Backend TypeScript build: PASS
- Frontend production build: PASS
- Frontend ESLint: PASS
- Focused workflow/CAP tests: PASS (12 tests)
- Migration manifest: PASS (20 ordered migrations/checksums)
- Schema ownership validator: PASS (19 known runtime DDL owners)
- Whitespace check: PASS for scoped changes
- Focused secret scan: PASS for scoped changes
- PostgreSQL integration and browser acceptance: NOT VERIFIED

## Database prerequisites

1. Reconcile the production migration ledger against the 20-entry deterministic manifest without stamping or guessing.
2. Review and approve all unapplied manifest migrations in listed dependency order.
3. Apply migrations using the controlled runner with `MIGRATION_RUN`, expected-database verification, and production approval gates.
4. Apply `20261122-audit-verified-closure` only after its dependency `20261122-policy-workflow-integration` is confirmed applied.
5. Verify the new Audit/CAP columns, indexes, foreign record references, and existing historical rows before feature acceptance.
6. Keep application startup separate from migration execution. Do not enable runtime schema bootstrap as a substitute for reconciliation.

## Required configuration

- Backend: `DATABASE_URL`, production `NODE_ENV`, platform-assigned `PORT`, authentication/passkey origin and RP configuration, and existing secrets.
- Frontend: existing production API/base configuration used by the current Railway service.
- Optional email/AI/connectors remain inactive unless their existing credential and activation gates are explicitly approved.
- `ALLOW_RUNTIME_SCHEMA_BOOTSTRAP` must not be used to bypass the migration process.

## Controlled deployment sequence

1. Approve the exact candidate commit list; do not push the branch wholesale without reviewing all nine unpublished commits.
2. Back up and reconcile the production database and migration ledger.
3. Approve and run the deterministic migrations separately from application startup.
4. Deploy backend; require `/health` success and inspect startup logs without writing test records.
5. Deploy frontend only after backend health and API compatibility checks pass.
6. Perform read-only authenticated smoke checks for workspace isolation, Risk Management, Workflow Management, Audit/CAP, and report access.
7. Enable optional features only after their migration, permissions, credentials, and source data are verified.
8. Accept the release only after authorised runtime/database evidence is recorded.

## Rollback and roll-forward

- Stop deployment if migration reconciliation, health checks, authentication, tenant isolation, or required routes fail.
- Prefer roll-forward schema corrections for applied additive migrations; do not reverse or edit historical migrations.
- Roll back application artifacts to the last accepted deployment if the schema remains compatible.
- Escalate for a controlled recovery decision if application and schema compatibility cannot be proven.

## Outstanding gates

- Production PostgreSQL baseline and migration ledger are unverified.
- Migrations have not been executed in this task.
- Runtime API, authenticated browser, and provider integrations are unverified.
- The nine unpublished commits require explicit release-scope approval before any push.
- No Git tag should be created until controlled deployment approval is granted.

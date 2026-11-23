# LAFLO Final Release Handover

## Candidate

- Branch: `codex/polish-login-and-risk-workspaces`
- Baseline: `d626f200053636b425dc0d22b1f387628feccd43`
- Previous release candidate SHA: `a67875dc52cf1d7f247fc550caccc4248fb9626f`
- New release candidate: the scoped commit containing this handover; use its resulting Git SHA as the candidate identifier
- Decision: **CONDITIONAL - DATABASE AND RUNTIME GATE**
- Push/deployment: not performed

## Migration compatibility remediation

- Corrected policy acknowledgement `user_id` from `TEXT` to `UUID`; manifest checksum updated.
- Added controlled legacy-ledger compatibility attestations without fabricating historical checksums, statuses, or timestamps.
- Replaced mutable full-catalog attestation matching with immutable baseline evidence plus a post-migration catalog checkpoint recorded after every committed migration.
- Added durable UUID database identity registration, candidate/plan binding, and explicit clone/restore rotation requirements.
- Existing identity registrations with no active identity now fail closed as an ambiguous replacement or recovery state; only an absent identity table permits approved first registration.
- Made database identity registration, approved attestations, reconciliation DDL, and the reconciliation ledger row one atomic transaction.
- Added a signature-checked, additive Risk Library partial-index repair.
- Expanded the deterministic manifest from 20 to 22 entries without renumbering historical migrations.
- Corrected the obsolete fixed 14-entry test to validate the authoritative manifest and dependency ordering.

Production inspection showed the corrected policy migration absent. Its application history in other environments is unverified. If the previous checksum executed elsewhere, do not apply the rewritten migration there; prepare a reviewed forward migration.

The reconciliation migration checksum changed again for the lifecycle/recovery correction. Production evidence shows that migration absent, but any environment containing either earlier reconciliation checksum must stop for explicit recovery or a superseding migration. A restored or cloned database must receive a separately approved identity registration/rotation before migration execution; copied identity configuration is not approval.

## Included scope

The candidate includes the nine unpublished commits from `9321a9a` through `d626f20` plus the scoped Audit/CAP release fix. The final fix separates corrective-action completion from independent closure, requires persisted workspace evidence, enforces `Audits.edit` and `Audits.approve`, prevents submitter self-verification, preserves finding/CAP references, and records Activity Ledger events.

## Offline validation

- Backend TypeScript build: PASS
- Frontend production build: PASS
- Frontend ESLint: PASS
- Focused workflow/CAP tests: PASS (12 tests)
- Migration manifest: PASS (22 ordered migrations/checksums)
- Schema ownership validator: PASS (19 known runtime DDL owners)
- Migration/startup/reconciliation tests: PASS (13 tests, 0 failures)
- Whitespace check: PASS for scoped changes
- Focused secret scan: PASS for scoped changes
- PostgreSQL integration and browser acceptance: NOT VERIFIED

## Database prerequisites

1. Reconcile the production migration ledger against the 22-entry deterministic manifest without stamping or guessing.
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

- Production metadata was inspected read-only, but approved compatibility attestations have not been created or persisted.
- The new migrations have not been executed against PostgreSQL; locking, duration, constraints, and runtime behaviour remain unverified.
- Backup/restore evidence, production preflight, migration approval, and post-migration verification remain outstanding.
- Migrations have not been executed in this task.
- Runtime API, authenticated browser, and provider integrations are unverified.
- The nine unpublished commits require explicit release-scope approval before any push.
- No Git tag should be created until controlled deployment approval is granted.

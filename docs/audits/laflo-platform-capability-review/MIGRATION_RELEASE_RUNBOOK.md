# Migration Release Runbook

## Current acceptance boundary

This runbook describes a future controlled execution. Phase 0B performed no database connection or migration execution.

## 1. Offline preparation

1. Review the migration SQL, purpose, dependencies, backfills, locks, and destructive classification.
2. Build the backend with `npm run build`.
3. Run `npm run migrate:validate`; it must report all manifest entries valid.
4. Run the pure migration-manifest unit tests.
5. Confirm the release contains no modified historical migration checksum.
6. Prepare rollback and backup evidence appropriate to the target environment.

## 2. Unknown-environment baseline

Do not run the release runner against an environment with unknown state.

1. Obtain a read-only catalog inventory and existing `risk_schema_migrations` rows.
2. Compare tables, columns, types, constraints, indexes, functions, and triggers to the repository.
3. Identify objects created by runtime bootstraps but absent from the ledger.
4. Investigate gaps and checksum-free rows; do not infer that `IF NOT EXISTS` means equivalent.
5. Produce a signed baseline/adoption plan.
6. Apply any baseline ledger adoption only through a separately reviewed, explicit operation. Never stamp automatically.

## 3. Controlled execution

1. Confirm the intended database identity and set `MIGRATION_EXPECTED_DATABASE` to the reviewed database name. Add an approved environment marker before first production use.
2. Stop concurrent schema-changing release jobs; the advisory lock is a secondary safeguard.
3. Set `MIGRATION_RUN=true` for the migration command only.
4. For production, record formal approval and set `MIGRATION_PRODUCTION_APPROVED=true` for the command only.
5. If the manifest contains a reviewed destructive migration, separately set `MIGRATION_DESTRUCTIVE_APPROVED=true`.
6. Run the compiled `npm run migrate:release` command once.
7. Treat any non-zero exit as release failure. Do not start the application as if migration succeeded.

## 4. Post-execution verification

1. Verify every expected ledger row, checksum, status, and timestamp.
2. Compare the live catalog to the expected schema.
3. Verify required constraints, indexes, functions, and triggers.
4. Run read-only smoke checks and approved module regressions.
5. Record release metadata without connection strings or secrets.

## 5. Failure and rollback

- The current migrations are forward migrations; rollback SQL is not automatically generated.
- Transactional failure rolls back the current migration and prevents its ledger insertion.
- Stop on checksum, gap, unknown row, or failed status. Reconcile manually; never delete ledger history casually.
- Restore from an approved backup only under the environment's change-control procedure.
- Do not edit an already applied SQL file to repair a failure. Add a new migration.

## 6. Seed operations

Seed commands are separate from schema release. Run them only when the release scope explicitly requires data initialization, with workspace targeting and idempotency reviewed. Never couple seeds to application startup or treat a successful seed as schema verification.

## Phase 0B result

Offline architecture and validation are acceptable. PostgreSQL execution, catalog parity, lock behavior, backfill performance, baseline adoption, and Railway runtime sequencing remain outstanding.

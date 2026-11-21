# Migration Reliability Design

## Target architecture

The dated SQL manifest is the only forward migration path. Every new schema change must have:

- A stable, unique migration ID and immutable SQL file.
- A SHA-256 checksum committed in the manifest.
- Explicit dependencies that refer only to earlier manifest entries.
- A purpose statement and destructive-change classification.
- Transactional execution through the release runner.
- A successful ledger record written in the same transaction as the schema change.

Schema and seed operations are separate. Application startup must not run either operation.

## Ledger

The strengthened `risk_schema_migrations` contract contains:

| Column | Purpose |
| --- | --- |
| `name` | Stable migration ID; historical `.sql` names are normalized for validation |
| `checksum` | SHA-256 of the exact migration content |
| `status` | Applied/recovery state; anything except `applied` blocks continuation |
| `applied_at` | Database timestamp |
| `execution_metadata` | Non-secret runner metadata |

The runner rejects unknown ledger rows, checksum-free legacy rows, changed checksums, failed statuses, gaps, and out-of-order history. It does not automatically stamp a baseline.

## Execution controls

- Migration execution is opt-in through `npm run migrate:release` after compilation.
- `MIGRATION_RUN=true` is required in every environment.
- `MIGRATION_EXPECTED_DATABASE` must equal PostgreSQL `current_database()` before any DDL runs.
- Production additionally requires `MIGRATION_PRODUCTION_APPROVED=true`.
- A future destructive migration must set `destructive: true` and requires `MIGRATION_DESTRUCTIVE_APPROVED=true`.
- A PostgreSQL advisory lock serializes concurrent release attempts.
- SQL and ledger insertion share one transaction.
- Connection URLs and credentials are not logged by the runner.
- `npm start` launches only the API process and cannot migrate or seed.

Database-name verification is implemented. A stronger non-secret environment marker should be agreed before the first controlled production use because database names can be reused across environments.

## Drift detection

Offline drift detection covers repository files: missing files, unmanifested SQL, duplicate IDs/files, dependency order, checksum changes, and unreviewed destructive statements. Database drift requires a read-only schema snapshot and catalog comparison in a future authorized environment. `IF NOT EXISTS` is not accepted as proof of parity.

## Historical adoption

Existing environments may contain:

- name-only ledger rows;
- schema created by runtime bootstraps with no ledger rows;
- migrations applied manually;
- later migrations with gaps, particularly Risk Library;
- columns or constraints that differ from repository definitions.

The runner therefore fails closed. Adoption requires an explicit, reviewed baseline report that maps catalog objects and historical rows to manifest checksums. No automatic baseline stamping is permitted. Historical migration files and IDs remain unchanged.

## Remaining architectural debt

Runtime `ensure*Schema` calls in `index.ts` still mutate schema when the application starts. Removing them safely requires converting each routine into new forward migrations and proving empty/upgrade behavior. This phase does not remove those calls because doing so without PostgreSQL verification could break existing environments. Until conversion is complete, the platform has a deterministic risk-migration path but not a fully deterministic whole-platform schema path.

## Relationship Intelligence readiness

Before adding canonical relationships:

1. Establish and approve a known baseline for `workspaces`, risks, assets, controls, evidence, vendors/contracts, governance documents, frameworks, findings/remediation, and business processes.
2. Convert the relationship migration into a new immutable manifest entry; do not edit prior files.
3. Define tenant-scoped endpoint ownership checks and indexed forward/reverse traversal.
4. Use stable entity type vocabulary, provenance, actor, validity, metadata, and append-only relationship events.
5. Provide a report-only backfill analyser before any mutation.
6. Validate empty and supported-upgrade paths in PostgreSQL before release.

Result: the repository is architecturally prepared for a future relationship migration, but the platform is not yet runtime-ready because the baseline and database parity are unverified and startup DDL remains.

# Production Migration Reconciliation Plan

## Decision

Release candidate `e4003a23f77a6d3fbeac996f2cc874b3052cde41` is **BLOCKED** from migration execution and deployment. The production database is a valid legacy baseline, but its ledger is not compatible with the current runner and one pending migration has a confirmed foreign-key type defect.

This package is offline preparation only. It does not authorize SQL execution, ledger changes, migration execution, deployment, restart, or feature activation.

## 1. Confirmed production baseline

Source: `PRODUCTION_DATABASE_READONLY_INSPECTION.md`, inspected 22 November 2026.

| Evidence | Confirmed result |
| --- | --- |
| PostgreSQL | 17.11 |
| Application schema | `public` |
| Catalog | 159 tables, 2,092 columns, 334 constraints, 366 indexes, 47 functions, 12 triggers |
| Legacy ledger | `risk_schema_migrations`; 13 rows; `name` and `applied_at` only |
| Repository manifest | 22 ordered, checksummed migrations after offline remediation |
| Runtime DDL | All 97 extracted runtime-created tables are present |
| Missing manifest tables | 22 |
| Risk Library | Table and source column present; source index missing; ledger row absent |
| Audit verified closure | Required columns and indexes absent |

No business-record contents, row counts, orphan counts, or production values were collected. Any decision that requires those facts remains a pre-execution check.

## 2. Legacy ledger analysis

The ledger records migrations 1-10, omits `20260927-risk-library`, and then records migrations 12-14. It is therefore not a contiguous manifest prefix. It also lacks checksum, status, and execution-metadata columns.

### Facts that must be preserved

- Preserve all 13 original names and `applied_at` timestamps unchanged.
- Do not claim that the missing Risk Library ledger row was historically applied.
- Do not claim that repository checksums are historical checksums.
- Treat the observed catalog as compatibility evidence, not execution evidence.
- Require an approval reference, reviewer, timestamp, catalog fingerprint, and candidate SHA for every adoption decision.

### Legacy runner limitation and corrected model

The original runner deliberately stopped when the ledger lacked `checksum`, `status`, or `execution_metadata`. The corrected offline candidate retains that fail-closed posture and adds explicit baseline attestations, durable target identity, and catalog checkpoints. It remains unauthorised for production until current evidence and approvals are supplied.

### Required adoption design

Before production execution, prepare and independently review an additive ledger-compatibility change that:

1. Preserves the legacy ledger rows and timestamps.
2. Adds nullable compatibility fields without rewriting existing facts.
3. Records compatibility attestations separately from historical execution evidence.
4. Associates each attestation with the repository migration ID, repository checksum, catalog fingerprint, release candidate, reviewer, approval reference, and reconciliation timestamp.
5. Allows the runner to accept a legacy row only when an explicit approved attestation exists.
6. Fails closed on an unknown row, missing attestation, checksum change, dependency gap, or incompatible catalog signature.
7. Does not insert the missing Risk Library row until its partial schema has been repaired and an explicit adoption decision has been approved.

This is an enhancement to the existing ledger and runner, not a second migration system.

## 3. Migration reconciliation matrix

| Migration | Position / dependency | Observed production state | Decision |
| --- | --- | --- | --- |
| `20260927-risk-library` | 11; after `20260927-risk-actions` and before weighted scoring | Template table and expected columns substantially present through runtime DDL; `risks.library_risk_id` present; workspace/status index present; `idx_risks_workspace_library_source` absent; no ledger row | **Manual reconciliation required.** Do not replay blindly or stamp. Validate constraints, add the missing index through an approved additive repair, then approve a compatibility attestation. |
| `20261121-enterprise-workflows` | 15; after governance constraints | All six tables and five indexes absent | **Eligible only after ledger adoption.** Additive creation appears structurally safe, subject to key-type, name-collision, and lock preflight. |
| `20261122-data-quality` | 16; after Enterprise Workflows | All three tables and three indexes absent | **Eligible after migration 15.** Existing `data_quality_records` is a different runtime object and must not be treated as this migration. |
| `20261122-records-governance` | 17; after Data Quality | All six tables and four indexes absent | **Eligible after migration 16.** Requires source-table and key-type assertions; creates governance metadata only and does not move or delete records. |
| `20261122-group-governance` | 18; after Records Governance | All six tables and three indexes absent | **Eligible after migration 17.** Canonical `users.id UUID` and `workspaces.id TEXT` align with this migration's foreign keys. |
| `20261122-policy-workflow-integration` | 21 after two reconciliation migrations and Group Governance | Table and index absent | **Corrected offline.** `user_id UUID REFERENCES users(id)` now matches the canonical key. The checksum changed; use only after confirming the old checksum was not applied in the target environment. |
| `20261122-audit-verified-closure` | 22; after Policy Workflow Integration | Base Audit/CAP tables exist; 13 required columns and two indexes absent | **Eligible only after corrected policy integration.** Additive, but requires lock-duration, existing-row default, and column-name collision checks. |

## 4. Risk Library reconciliation

### Expected and observed

| Object | Expected | Observed | Result |
| --- | --- | --- | --- |
| `risk_library_templates` | Table with text IDs, workspace-scoped reference, scenario, scoring suggestions, JSONB mappings, status, usage and audit fields | Present with expected column families and types | Compatible evidence, not historical execution proof |
| Workspace/library reference uniqueness | `UNIQUE(workspace_id, library_risk_id)` | Corresponding unique index present | Matched |
| Workspace/status index | `idx_risk_library_workspace_status` | Present | Matched |
| Risk source column | `risks.library_risk_id TEXT` | Present | Matched |
| Risk source partial index | `idx_risks_workspace_library_source` | Missing | Repair required |
| Scenario/status/usage checks | Migration-owned checks | Full definition parity not retained in the redacted report | Must be reasserted in approved preflight |
| Ledger row | `20260927-risk-library` | Missing | Manual adoption decision required |

### Smallest safe remediation

Do not drop or recreate the table and do not replay the original migration as proof of execution. Prepare a new additive repair migration after re-verifying constraint definitions:

```sql
CREATE INDEX IF NOT EXISTS idx_risks_workspace_library_source
  ON risks (workspace_id, library_risk_id)
  WHERE library_risk_id IS NOT NULL;
```

The approved execution procedure must first assert that any existing index with that name has the expected table, columns, ordering, and predicate. If a conflicting definition exists, stop rather than replace it automatically.

After the repair is verified, the missing historical row may be represented only through the approved compatibility-attestation mechanism. Do not invent a 2026 historical execution timestamp and do not label runtime creation as migration execution.

## 5. Migrations 15-20 and missing object mapping

### Migration 15: Enterprise Workflows

Missing tables:

- `enterprise_workflow_definitions`
- `enterprise_workflows`
- `enterprise_workflow_assignments`
- `enterprise_workflow_events`
- `enterprise_workflow_escalations`
- `enterprise_workflow_notifications`

Missing indexes:

- `idx_workflows_workspace_status`
- `idx_workflow_assignments_user`
- `idx_workflow_assignments_sequence`
- `idx_workflow_events_history`
- `idx_workflow_escalations_open`

### Migration 16: Data Quality

Missing tables:

- `data_quality_rules`
- `data_quality_issues`
- `data_quality_issue_events`

Missing indexes:

- `idx_data_quality_issues_queue`
- `idx_data_quality_issues_source`
- `idx_data_quality_events_issue`

### Migration 17: Records Governance

Missing tables:

- `records_retention_rules`
- `governed_record_index`
- `records_legal_holds`
- `records_legal_hold_items`
- `records_governance_requests`
- `records_governance_events`

Missing indexes:

- `idx_retention_rules_scope`
- `idx_governed_records_queue`
- `idx_records_requests_queue`
- `idx_records_events_entity`

### Migration 18: Group Governance

Missing tables:

- `organisation_groups`
- `organisation_group_members`
- `managed_client_engagements`
- `workspace_delegations`
- `group_shared_controls`
- `group_governance_events`

Missing indexes:

- `idx_group_members_allowlist`
- `idx_delegations_user_scope`
- `idx_engagements_provider`

### Migration 19: Policy Workflow Integration

Missing objects:

- `governance_document_acknowledgements`
- `idx_document_acknowledgements_document`

Implemented offline correction:

```sql
-- Correct type for compatibility with users.id UUID.
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

The manifest checksum is now `4b716123b4a037d59454c938a811ad865c4533b02f811c79ea89cc813daccdca`. Production inspection showed this migration absent, but other environments remain unverified. Do not apply the rewritten file to an environment where its previous checksum executed; prepare an explicitly versioned forward strategy for that environment.

### Migration 20: Audit Verified Closure

Missing `audit_corrective_actions` columns:

- `evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb`
- `submitted_by_user_id TEXT`
- `submitted_at TIMESTAMPTZ`

Missing `audit_follow_ups` columns:

- `corrective_action_id TEXT`
- `verification_reference TEXT`
- `requested_by_user_id TEXT`
- `evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb`
- `verification_method TEXT`
- `decision TEXT`
- `comments TEXT`
- `reviewed_at TIMESTAMPTZ`
- `closure_authorised_by TEXT`
- `closure_authorised_at TIMESTAMPTZ`

Missing indexes:

- `audit_follow_up_verification_reference_unique`
- `audit_follow_up_action`

No existing records are deleted or rewritten by the proposed DDL. The JSONB default applies an empty evidence list to existing rows; this is a storage and semantic change that must be explicitly approved and lock-tested.

## 6. Proposed ordered remediation sequence

### Offline correction stage

1. Correct the migration-19 UUID foreign-key defect.
2. Add focused static/server-free coverage asserting that every migration foreign key uses a compatible canonical key type.
3. Design the additive ledger compatibility/attestation change and runner fail-closed behavior.
4. Prepare a Risk Library repair migration for the missing partial index.
5. Generate a new release candidate SHA; do not continue to use `e4003a2` as the executable candidate.
6. Re-run manifest checksums, schema ownership validation, builds, focused tests, whitespace, and secret scans.

### Separately authorised production stage

1. Confirm exact database identity and repeat read-only preflight signatures.
2. Confirm backup completion, restore owner, restore target, and recovery-time expectation.
3. Apply the approved ledger compatibility schema change without altering legacy timestamps.
4. Record reviewed compatibility attestations for the 13 historical rows.
5. Apply and verify the Risk Library repair.
6. Record the separately approved Risk Library adoption outcome without claiming unproven historical execution.
7. Execute corrected migrations 15, 16, 17, 18, 19, and 20 in manifest dependency order.
8. Stop after each migration if its postcondition fails; do not continue to dependent migrations.
9. Re-run read-only catalog and ledger reconciliation.
10. Approve backend deployment only if the database is classified compatible.

## 7. Pre-execution compatibility assertions

Every assertion must pass before SQL execution:

- Durable database identity matches the independently approved production UUID registration; name, host and connection string are insufficient.
- Transaction and role are the approved migration mechanism, not the application startup path.
- `workspaces.id` is `TEXT`; `users.id` is `UUID`; `governance_documents.id` is `TEXT`.
- All 22 target table names are absent or exactly compatible; partial/conflicting tables fail closed.
- All proposed index names are absent or exactly equivalent.
- Existing Audit/CAP columns with target names are absent or exactly type/default compatible.
- Risk Library check constraints and unique constraint match the migration intent.
- No unknown ledger rows exist.
- Every legacy ledger row has an approved attestation tied to the immutable baseline fingerprint, evidence version, migration-plan fingerprint, durable database identity and candidate.
- Migration 19 uses UUID for `user_id`.
- Backup and restore evidence is current and approved.
- Lock and statement timeout values are approved for the migration window.

## 8. SQL safety and data preservation

The seven reviewed migration files contain no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE`, data `UPDATE`, data `INSERT`, column-type conversion, or column rename statement. Their intended changes are table, column, constraint, and index additions.

Safety limitations:

- `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` do not prove compatibility. Preflight assertions remain mandatory.
- Foreign keys can fail on incompatible key types or existing orphans.
- Index and `ALTER TABLE` operations acquire locks.
- The Audit JSONB defaults affect existing-row semantics.
- The runner must not be forced past identity, baseline, checkpoint, approval or recovery-state checks.

## 9. Failure and recovery plan

| Failure | Required response |
| --- | --- |
| Identity mismatch | Stop before SQL; investigate target selection |
| Unknown/conflicting ledger row | Stop; preserve evidence; obtain database-owner decision |
| Risk Library signature conflict | Stop; do not replay or drop objects; prepare a new additive repair |
| Foreign-key type mismatch | Stop before migration; correct candidate offline |
| Migration transaction fails | Roll back that migration; preserve logs; do not run dependants |
| Migration commits but postcondition fails | Stop release; prefer reviewed roll-forward; do not drop populated objects automatically |
| Backend startup fails after compatible schema | Keep schema; roll application artifact back if schema remains backward compatible |
| Restore required | Database owner invokes the pre-approved restore procedure; application team must not improvise destructive rollback |

## 10. Post-migration verification checklist

- Ledger contains the approved legacy attestations and new migration execution rows.
- Ledger order is complete and dependency-valid through migration 20.
- New execution rows contain repository checksums, status, and execution metadata.
- Risk Library partial index exists with the exact expected predicate.
- All 22 tables and required indexes/constraints exist.
- Policy acknowledgement `user_id` is UUID with a valid foreign key to `users(id)`.
- All Audit/CAP columns and both indexes exist with expected definitions.
- No unexpected table, function, or trigger appeared.
- Runtime DDL does not silently replace a failed migration.
- Backend health, authentication, workspace isolation, RBAC, workflows, policy acknowledgement, and Audit/CAP are tested under separate runtime authorization.
- Final read-only inspection classifies the database as compatible before frontend deployment or feature activation.

## 11. Approval checklist

- [ ] Engineering owner approves corrected migration 19 and new candidate SHA.
- [ ] Database owner approves legacy-ledger adoption design.
- [ ] Database owner approves Risk Library repair and compatibility attestation.
- [ ] Security owner confirms tenant/RBAC schema dependencies.
- [ ] Release owner approves exact migration list and order.
- [ ] Backup owner confirms successful backup and tested recovery procedure.
- [ ] Operations owner approves lock/statement timeouts and release window.
- [ ] Business owner approves temporary unavailability if required.
- [ ] Rollback/roll-forward decision owners are named.
- [ ] Post-migration read-only verification and runtime acceptance owners are named.

## 12. Outstanding unknowns

- Historical checksums and execution mechanisms for the 13 legacy rows
- Complete Risk Library check-constraint parity after redaction of the temporary snapshot
- Whether migration 19 has been applied in any non-production environment
- Production row counts, orphan/null collisions, and index build duration
- Lock behavior and migration duration at production scale
- Backup recency and demonstrated restore capability
- Runtime behavior after migrations 15-20

These unknowns do not justify production writes. They define mandatory review and preflight work.

## 13. Offline safety validation

| Check | Result |
| --- | --- |
| Backend TypeScript build | PASS |
| Deterministic migration manifest | PASS - 22 ordered files and checksums |
| Runtime DDL ownership validator | PASS - 19 known owners, no unclassified owner |
| Migration manifest tests | PASS |
| Startup schema policy tests | PASS |
| SQL destructive/data-mutation scan for the seven reconciliation migrations | PASS - no destructive or data-mutating statement detected |
| Whitespace check | PASS |
| Combined schema ownership and focused reconciliation tests | PASS - 13 tests, 0 failures |

The stale fixed-count assertion was replaced with authoritative uniqueness and dependency-order checks. No PostgreSQL execution or runtime verification was performed.

## 14. Offline remediation implementation

- Added a separate compatibility-attestation table and nullable ledger compatibility columns; original legacy names and timestamps are not rewritten.
- Added fail-closed validation tied to durable database identity, immutable baseline evidence, post-migration catalog checkpoints, migration-plan fingerprint, repository checksums, release candidate SHA, reconciliation version, explicit approval reference, and observed schema evidence.
- Reconciliation DDL, identity registration, attestations and its ledger checkpoint now commit atomically. Rollback leaves the pre-reconciliation state; a committed state contains all four elements.
- Every later migration stores its resulting catalog checkpoint. Retry accepts expected schema evolution but rejects missing checkpoints and unexplained drift.
- Restores and clones require independent approval and a controlled database-identity rotation. Reusing copied identity configuration does not establish target approval.
- An existing identity registry with no active identity is not treated as a first registration; the runner stops for explicit database-owner recovery.
- Added an additive Risk Library repair that validates table, column, and existing-index signatures before creating the missing partial index.
- Inserted reconciliation and repair migrations before pending business migrations. The manifest now contains 22 entries without renumbering historical IDs.
- Ordinary `CREATE INDEX` is retained because the controlled runner wraps each migration in a transaction. This can lock writes while the index is built; production duration and lock tolerance require separate approval. `CREATE INDEX CONCURRENTLY` was not used because it is incompatible with that transaction wrapper.
- Production compatibility remains **BLOCKED** until attestations are independently approved, target signatures are rechecked, migrations execute through an authorised window, and post-migration runtime/database verification passes.

## Exact next authorised action

Obtain independent database/release-owner review of the new candidate and the attestation evidence package. If approved, separately authorise a bounded production preflight; do not execute migrations until backup, lock/timeouts, database identity, catalog fingerprints, and environment-specific migration history are confirmed.

# Production Database Read-Only Inspection

## 1. Release candidate and inspection

- Release candidate: `e4003a23f77a6d3fbeac996f2cc874b3052cde41`
- Inspection completed: 22 November 2026 at 12:14 GMT
- Railway project: `Enterprise-GRC-Tool`
- Railway environment: `production`
- Database identity: fingerprint `e34d1c9011e0` (database name and connection details redacted)
- PostgreSQL version: 17.11
- Final compatibility classification: **BLOCKED**

This report records structural metadata only. No application or business record contents were queried.

## 2. Read-only enforcement

The existing production backend connection configuration was used without printing its value. Every database query ran inside:

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5000ms';
SET LOCAL lock_timeout = '1000ms';
```

The session reported `transaction_read_only=on` and ended with `ROLLBACK`. The existing database role can create objects outside a read-only transaction, so the transaction boundary was mandatory. No write or DDL statement was issued.

## 3. Observed migration ledger

The production ledger is `public.risk_schema_migrations` with only `name TEXT NOT NULL` and `applied_at TIMESTAMPTZ NOT NULL`. It has no checksum, status, or execution-metadata columns. All entries are therefore legacy name-only records whose historical checksums cannot be established from production metadata.

### Recorded migrations

1. `20260920-risk-cia-impact.sql`
2. `20260920-risk-treatment-lifecycle.sql`
3. `20260922-risk-treatment-plans.sql`
4. `20260922-treatment-control-links.sql`
5. `20260923-risk-methodologies.sql`
6. `20260923-risk-version-pinning.sql`
7. `20260924-risk-tenant-rollout.sql`
8. `20260924-risk-references.sql`
9. `20260926-risk-report-evidence-workflows.sql`
10. `20260927-risk-actions.sql`
11. `20260928-weighted-risk-scoring.sql`
12. `20260928-governance-document-compatibility.sql`
13. `20260928-governance-document-constraints.sql`

### Missing ledger entries

- `20260927-risk-library`
- `20261121-enterprise-workflows`
- `20261122-data-quality`
- `20261122-records-governance`
- `20261122-group-governance`
- `20261122-policy-workflow-integration`
- `20261122-audit-verified-closure`

The ledger is not a contiguous prefix of the 20-entry manifest because `20260928-weighted-risk-scoring` is recorded after the missing Risk Library dependency. The missing entry must not be stamped automatically.

## 4. Catalog inventory

The bounded catalog inspection observed:

- 1 application schema
- 159 tables
- 2,092 columns
- 334 constraints
- 366 indexes
- 0 views
- 47 functions
- 12 non-internal triggers

The first 10 recorded risk migrations have their principal tables and expected risk scoring functions/triggers present. The weighted-scoring and governance-document structures recorded after the ledger gap are also present, but their historical checksums remain unverified.

## 5. Manifest compatibility

The repository manifest expects 33 migration-created tables. Eleven are present and 22 required tables are absent:

- `enterprise_workflow_definitions`
- `enterprise_workflows`
- `enterprise_workflow_assignments`
- `enterprise_workflow_events`
- `enterprise_workflow_escalations`
- `enterprise_workflow_notifications`
- `data_quality_rules`
- `data_quality_issues`
- `data_quality_issue_events`
- `records_retention_rules`
- `governed_record_index`
- `records_legal_holds`
- `records_legal_hold_items`
- `records_governance_requests`
- `records_governance_events`
- `organisation_groups`
- `organisation_group_members`
- `managed_client_engagements`
- `workspace_delegations`
- `group_shared_controls`
- `group_governance_events`
- `governance_document_acknowledgements`

The `20261122-audit-verified-closure` migration alters existing tables rather than creating new ones. None of its required Audit/CAP columns or indexes were observed:

- `audit_corrective_actions`: `evidence_ids`, `submitted_by_user_id`, `submitted_at`
- `audit_follow_ups`: `corrective_action_id`, `verification_reference`, `requested_by_user_id`, `evidence_ids`, `verification_method`, `decision`, `comments`, `reviewed_at`, `closure_authorised_by`, `closure_authorised_at`
- indexes `audit_follow_up_verification_reference_unique` and `audit_follow_up_action`

These are required by the release candidate and their absence is a deployment blocker.

## 6. Risk Library reconciliation

`risk_library_templates` and `risks.library_risk_id` exist even though the Risk Library migration is absent from the ledger. The table signature, supporting workspace/status index, and source column are substantially present through runtime DDL. However, the migration-owned partial index `idx_risks_workspace_library_source` is missing.

This is evidence of runtime creation and partial migration compatibility, not proof that `20260927-risk-library` was applied. It requires a reviewed baseline decision and an additive repair/adoption plan; it must not be silently stamped or inferred from table existence.

## 7. Runtime DDL compatibility

Static extraction identified 97 actual table names created by the 19 reviewed runtime DDL owners; all 97 are present in production. This explains why multiple modules currently operate despite incomplete manifest history.

Remaining concerns:

- permanent schema ownership is split between runtime code and migrations;
- Risk Library has duplicate ownership and a missing migration-owned index;
- runtime table presence does not prove column, constraint, function, or trigger parity for every owner;
- the release-candidate migrations from Enterprise Workflows onward have no equivalent runtime-created required tables, except the pre-existing Audit/CAP base tables that still lack the new closure fields.

## 8. Confirmed differences and release blockers

1. Legacy ledger has no checksums or statuses.
2. Ledger dependency gap at `20260927-risk-library` followed by later records.
3. Seven manifest migrations are not recorded.
4. Twenty-two required migration-owned tables are missing.
5. Audit verified-closure columns and indexes are missing.
6. Risk Library source index is missing.
7. Production is deployed from an older commit than the release candidate; runtime compatibility of the candidate remains unverified.

## 9. Required reconciliation actions

1. Preserve this metadata evidence and obtain database-owner and release-owner review.
2. Prepare an explicit legacy-ledger adoption decision for migrations 1-14, including the Risk Library gap; do not stamp automatically.
3. Decide whether the missing Risk Library index should be introduced through a new additive repair migration or as part of an approved baseline procedure.
4. Review and approve migrations 15-20 in dependency order against the current production catalog.
5. Confirm backup and recovery arrangements before any migration execution.
6. Execute only through the separately authorised controlled migration mechanism.
7. Re-run the read-only ledger/catalog comparison after migration execution and before backend deployment.

## 10. Remaining uncertainties

- Historical checksums for all 13 legacy ledger rows
- Exact creation provenance for runtime-owned objects
- Full definition parity for every runtime-owned column and constraint
- Migration lock/backfill behavior at production scale
- Application behavior after migrations 15-20
- Authenticated runtime acceptance of release candidate `e4003a2`

## 11. Compatibility decision

**BLOCKED**

Production is not structurally compatible with the complete release candidate. This classification is based on confirmed missing required schema, a non-contiguous legacy ledger, unavailable historical checksums, and a partial Risk Library migration signature. It is not a runtime application assessment.

## 12. Exact recommended next release action

Obtain database-owner and release-owner approval for a controlled reconciliation package that documents legacy-ledger adoption, resolves the Risk Library gap, and reviews migrations 15-20. Do not deploy the backend or frontend until that package is approved, migrations are executed under separate authorization, and a follow-up read-only inspection confirms compatibility.

## 13. Safety confirmation

- No write SQL, DDL, stored procedure, maintenance command, or advisory lock executed
- No migration, seed, backup, or restore executed
- No schema or business data modified
- No customer or business record contents retrieved
- No credentials, connection strings, role names, or hostnames recorded in this report
- No Railway configuration, service, environment, role, grant, or endpoint changed
- No service restarted or deployed
- No application started locally
- No Git commit or push performed
- No new infrastructure cost intentionally introduced

## 14. Refreshed production preflight - 23 November 2026

### Scope and target

- Candidate reviewed: `3dadb74b3924834286969f082635997b8f95e0d8`
- Railway project/environment: `Enterprise-GRC-Tool` / `production`
- Backend database endpoint matched the active `Postgres-mkXL` public endpoint, not the stopped legacy PostgreSQL service.
- The session used `BEGIN TRANSACTION READ ONLY`, verified `transaction_read_only=on`, set a 5-second statement timeout and 1-second lock timeout, and ended with `ROLLBACK`.

### Current evidence

- PostgreSQL remains 17.11.
- The database/catalog identity fingerprint is recorded separately from credentials; catalog fingerprint: `102418b98e8d682b579053de91a2eb5807e8a483579dc4d88c1fbf983af5eab3`.
- Catalog counts remain unchanged at 159 tables, 2,092 columns, 334 constraints, 366 indexes, 47 functions and 12 non-internal triggers.
- The ledger still contains the same 13 name/timestamp-only entries and still omits `20260927-risk-library`.
- All 22 required pending migration tables remain absent.
- `risk_library_templates` remains present with 32 columns and its workspace/status and uniqueness indexes; `risks.library_risk_id TEXT` remains present and nullable.
- `idx_risks_workspace_library_source` remains absent.
- All 13 required Audit/CAP closure columns and both required indexes remain absent.
- Canonical key types remain `users.id UUID`, `workspaces.id TEXT`, and `governance_documents.id TEXT`; corrected migration 19 is type-compatible.
- `risk_database_identity` and `risk_schema_migration_attestations` are absent, as expected before reconciliation.

No customer/business records or integrity values were read. The existing 97-runtime-table finding was not recomputed because it remains supported by the unchanged catalog counts and prior authorised inspection, but current definition-level parity is not inferred from that fact.

### Approval package and execution gates

The controlled runner must not execute until all of the following are supplied and independently approved:

1. A production database UUID identity and identity-registration approval reference tied to the fingerprint above.
2. Thirteen reviewed legacy compatibility attestations plus the explicit forward-repair assessment for the missing Risk Library migration, all bound to candidate `3dadb74`, the current migration-plan fingerprint, baseline evidence version and catalog fingerprint.
3. Database-owner approval for the Risk Library transactional index build, including approved `statement_timeout`, `lock_timeout`, maintenance window and stop criteria.
4. Separately authorised metadata/data-integrity checks for foreign-key or uniqueness collisions; none were performed in this preflight.
5. Current backup completion evidence, a tested restore procedure, named recovery owner and accepted recovery-time objective.
6. Named database owner, release owner and post-migration verification owner, with explicit approval of the exact 22-entry manifest order.

Only after those gates are recorded may an execution approval consider the existing controlled command:

```text
railway run --service courteous-beauty -- npm run migrate:release
```

The command additionally requires deliberate values for `MIGRATION_RUN`, `MIGRATION_PRODUCTION_APPROVED`, `MIGRATION_EXPECTED_DATABASE`, `MIGRATION_RELEASE_CANDIDATE_SHA`, `MIGRATION_DATABASE_IDENTITY`, `MIGRATION_DATABASE_IDENTITY_APPROVAL_REFERENCE`, `MIGRATION_RECONCILIATION_APPROVED`, `MIGRATION_RECONCILIATION_VERSION`, `MIGRATION_BASELINE_EVIDENCE_VERSION`, and the approved attestation file. These gates must not be configured or activated until execution is separately authorised.

### Refreshed decision

**CONDITIONAL - ADDITIONAL APPROVAL/EVIDENCE REQUIRED**

The read-only preflight is complete and found no new code/schema conflict beyond the known, planned pending objects. Migration execution and deployment remain blocked by missing attestations, identity registration approval, integrity evidence, lock/window approval, backup/recovery evidence and named owner approvals.

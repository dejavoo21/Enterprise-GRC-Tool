# Treatment control linking and risk score profile

## Scope and API
The existing workspace Control Library is reused. No controls or evidence are created by this change.
- GET /api/v1/controls: existing picker source, with existing Controls permissions.
- GET /api/v1/risk-treatments: returns linkedControls with each plan.
- POST /api/v1/risk-treatments/risk/:riskId: accepts linkedControls.
- PATCH /api/v1/risk-treatments/:treatmentId: replaces linkedControls when supplied; omission preserves existing links, [] removes all links.

Example input (IDs must come from the real current-workspace library):
linkedControls: [{ controlId, role, implementationNote }]

Plan changes and link replacement share a PostgreSQL transaction. Invalid/missing/foreign-workspace controls roll back the plan save. Duplicate links are rejected by validation and a unique database constraint. Composite workspace foreign keys enforce ownership. Unlinking never deletes a control. The authenticated workspace must match the request workspace. Existing module authorization remains in place.

## Migration
20260922-treatment-control-links.sql is idempotent and creates only relationship infrastructure plus composite unique indexes on existing IDs/workspaces. The existing ensureRiskTreatmentSchema startup path also applies the same DDL. Deploy backend before frontend. Run the migration against a disposable PostgreSQL database before production; that integration verification has not been performed here. Existing plan rows require no fabricated links or backfill.

## Scoring
Current residual scores are never written by treatment create/update/completion. Expected residual after treatment stays a nullable plan outcome (0-25), with a display rating derived from existing bands. Clearing the field sends null. It is no longer prefilled from current residual risk.
Target score is derived only when real targetLikelihood and targetImpact are both valid (1-5). Missing/invalid targets show Not set. Existing local risk-model target fields are part of unrelated pending changes, so target editing/persistence rollout remains a separate task. No second competing target field was introduced. The treatment form explicitly discloses that target editing is not connected.

## Ledger
Existing ledger infrastructure records plan saves plus control-linked, control-removed, role-updated and note-updated events. As with existing infrastructure, ledger errors are logged rather than rolling back saved business data. This is not a transactional audit outbox.

## Validation boundaries
Backend/frontend builds, ESLint, validation/repository-contract unit tests, and score-profile tests run locally. Repository-contract tests use a fake PoolClient and do not establish PostgreSQL FK/transaction behaviour. No production writes, migrations, deployment, or in-app browser audit were performed.

Before rollout, verify migration idempotency and workspace FKs in PostgreSQL; save/reload/edit/unlink through the API; rejected writes leave plans unchanged; controls survive unlink; role/note events appear; modal, pagination, CIA and query filters work at desktop/laptop widths.

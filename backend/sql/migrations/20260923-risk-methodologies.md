# Risk methodology foundation

## Release status

Draft configuration and scoring preview only. Do not present this as the completed
enterprise methodology rollout. Activation returns 409 until risk persistence,
intelligence, forms, treatment forecasts, and reporting consume pinned versions.
The frontend explicitly explains this limitation. No production deployment or
database migration was performed in this implementation pass.

## Existing assumptions found before implementation

- routes/risks.ts: 1-5 validation, multiplication, fixed 6/12/20 severity bands.
- repositories/risksRepo.ts: fixed severity calculation; existing axis columns.
- services/riskIntelligenceService.ts: scoring and tolerance rules separate from
  the legacy risk route. These must not be replaced with one threshold blindly.
- frontend types/risk.ts: fixed bands and display helpers.
- frontend components/RiskModal.tsx: fixed scale options and computed scores.
- treatment validation: expected residual constrained to the existing score range.
- RiskMatrix.tsx: separate sample matrices and summary records, not live analytics.
- Target likelihood/impact already exist in the dirty risk model; do not add
  competing targetScore storage without reconciling it with those fields.
- Pending treatmentControlRepo and TreatmentControlPicker reuse the real controls
  table and already enforce role validation and duplicate prevention. This pass
  leaves those pending files untouched rather than creating a second library.

## Migration

Apply the adjacent SQL with the deployment's normal migration account, first to a
disposable PostgreSQL database containing the existing workspaces table, then to
staging after review. The script is transactional and repeatable. It creates only
methodology and methodology-event tables plus a partial unique active index.

It does not alter, delete, attach inferred methodology versions to, or rescore any
existing risks. No sample configuration is inserted automatically: GET /template
returns an explicitly labelled legacy compatibility template for an administrator
to review and save as a draft. That template is not an active organisation policy.

Rollback: disable the route/page first. Retain the new tables for audit history;
there is no reason to drop or modify risk records. Do not delete saved audit events.

## Safety properties

- Authentication plus Risks module permission and matching session/workspace.
- Only workspace owners/admins may write or preview configuration via POST.
- All repository statements scope by workspace; only Draft records can be edited.
- Workspace row lock serializes version allocation; optimistic updatedAt check
  prevents overwriting a changed draft.
- Partial unique index permits at most one Active methodology per workspace.
- Audit snapshot writes share the draft transaction: audit failure rolls it back.
- Unknown/additive/custom scoring methods are rejected rather than evaluated.
- Rectangular/custom matrices support 2-10 sequential levels per axis.
- Gaps, overlap, invalid colours, duplicate labels, invalid targets fail validation.
- Preview scores are not risk counts. No residual score is persisted by preview.

## Remaining integration gates

1. Add nullable methodology reference/version to risks with workspace-safe foreign
   keys and concurrency-safe pinning on create. Preserve all legacy stored scores.
2. Audit database 1-5 constraints and generated score columns before widening them.
3. Update ALL API/store/import/seed/intelligence writers and readers for pinned
   methodology, not only the create modal. Define legacy unknown-version handling.
4. Integrate dynamic risk form labels, target outcome, score path, and JSON exports.
5. Build live heatmaps grouped by methodology; disclose unmappable axis records.
6. Integrate treatment-specific expected residual validation without changing actual
   residual; validate and migrate pending control linking against PostgreSQL.
7. Enable activation only with transactionally serialized retirement/activation,
   explicit confirmation, and atomic audit event. Never rescore historical risks.
8. Add PostgreSQL integration tests for permissions, isolation, concurrent drafts,
   stale writes, one-active constraint, and failed-audit rollback.
9. Browser checks at 1600x900 and 1366x768 remain pending tool access.

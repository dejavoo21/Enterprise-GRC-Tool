# Tenant and Workspace Authorisation: Phase 0A

Date: 2026-11-21

## Enforced invariant

Every protected workspace-scoped request derives its workspace exclusively from the authenticated principal. Client workspace selectors are compatibility inputs only: matching values are accepted and mismatches are rejected before route handlers run. The authenticated session must still match an active user membership, role, and non-archived workspace.

## Route coverage

| Route family | Classification | Notes |
| --- | --- | --- |
| Risks, Risk Library, Methodology, Treatment, Operations | Consistently protected | Shared auth, workspace, and module permission middleware; repositories are workspace scoped. |
| Controls, Evidence, Assets | Consistently protected | Shared middleware; confirmed cross-module link writes now validate both endpoints. |
| Audits, Findings, CAP / Remediation | Consistently protected | Covered by audit-readiness and issue/action route mounts; resource queries remain workspace scoped. |
| Frameworks | Consistently protected | Shared middleware and workspace-scoped repositories; disposable database integration suite remains unexecuted locally. |
| Policies, Training | Consistently protected | Shared middleware; control/document/training relationships constrain both endpoints, while global training templates remain intentionally readable. |
| Incidents | Partially protected | Shared mount protection applies through current operational modules; a dedicated end-to-end cross-tenant incident mutation suite is still required. |
| Vendors / TPRM | Consistently protected | Internal TPRM auth now includes the shared workspace guard; questionnaire child reads and writes validate the parent workspace. |
| Privacy | Partially protected | Shared middleware and DPIA linked risk/control/asset/AI/vendor validation are enforced. Other privacy sub-record relationships need dedicated negative integration coverage. |
| AI Governance | Partially protected | Shared middleware and AI-system linked risk/control/evidence/vendor/incident validation are enforced. Other AI child relations need dedicated negative integration coverage. |
| Workflows | Partially protected | Review/task routes use shared middleware; dedicated cross-tenant workflow transition tests remain outstanding. |
| Reports | Partially protected | Shared middleware and workspace-scoped report queries are present; dedicated cross-tenant search/export/archive tests remain outstanding. |
| Regulatory | Partially protected | Shared middleware and requirement/obligation link validation are enforced. Change-log affected-record arrays still require the same validation. |
| Administration | Consistently protected | Shared workspace guard plus administration access governance; membership and role are revalidated on every request. |
| Authentication | Not workspace-scoped by design | Public login/session bootstrap routes issue the authenticated workspace context. |

## Confirmed fixes

- Removed header/query precedence from workspace resolution.
- Revalidated active session, workspace membership, role, and workspace state on protected requests.
- Applied one shared workspace guard to all protected API mounts.
- Added workspace-qualified control, document, training, asset, control-mapping, and TPRM child operations.
- Added allowlisted linked-record validation for AI systems, DPIAs, and regulatory requirements/obligations.
- Added allowlisted validation for regulatory change affected-record arrays and regulatory task source change logs.
- Made review-task creation atomically dependent on a governance document in the same workspace.
- Used generic unavailable errors so foreign record existence is not disclosed.

## Extended static and mocked coverage

The following additional high-risk paths were reviewed without starting the application or using a database:

- **Filtering and search:** review-task status, assignee and document filters; Risk Operations status, priority and overdue filters. Workspace is the leading query predicate and aggregate inputs derive from scoped lists. The reviewed queries do not implement backend pagination, so pagination isolation is not claimed.
- **Reporting:** templates, generated report lists/details/status, schedules, distributions and attestations. Report detail and status queries use `workspace_id`; distribution and attestation services first retrieve the report through a workspace-scoped lookup. Route mounts enforce `Reports` permissions by HTTP method.
- **Workflow and actions:** review-task reads, updates, completion and deletion; Risk Operations action reads and updates. Foreign IDs resolve to no record before mutation. Review-task creation now validates the linked document atomically.
- **Relationship arrays:** AI system, Privacy DPIA, regulatory requirement/obligation, regulatory change affected-record arrays, and regulatory task source links reject the entire operation when any target is missing or foreign.
- **RBAC:** direct mocked middleware tests verify missing authentication returns `401` without repository access and insufficient `Reports.export` permission returns `403` without invoking the handler.

Server-free mocked/unit result on 2026-11-21: **20 passed, 0 failed, 0 skipped** across permission enforcement, tenant-scoped queries, relationship validation, TPRM children, control links, and treatment controls.

## Final secondary-route review

The final static and mocked pass covered Business Continuity, Continuous Assurance, incident paths, report archives/exports, secondary AI and Privacy links, assets, and remaining high-risk JSON relationships.

- **Business Continuity / resilience:** BIA linked risk/control/evidence/vendor/asset/finding arrays now use the shared validator. Recovery-plan references on critical services/exercises, critical-service references on scenarios, and typed process/asset/vendor/recovery-plan dependency endpoints are validated before writes. Free-text supporting asset/vendor/application labels remain labels and are not treated as record IDs.
- **Continuous Assurance:** removed the residual client-header workspace fallback. Control-monitor and assurance-exception external control/risk IDs are validated. Remediation targets must exist in the current workspace state. Update payloads can no longer overwrite immutable record `id` or `workspaceId` fields.
- **Incidents:** TPRM incidents remain repository-scoped by workspace. AI incidents now validate their referenced AI system. BCM crisis events contain no linked-record identifiers. No separate generic incident repository was found in the reviewed backend.
- **Reports and exports:** report archive lists, counts, details, workflow transitions and downloads use workspace-scoped repository operations. Archived downloads already require `Risks.export`. CSV report routes and board-export routes now require explicit `Reports.export` permission rather than ordinary view/create permission. No object-storage report download implementation exists in the reviewed backend.
- **Secondary AI / Privacy:** AI models, assessments and incidents now validate their AI-system reference. Privacy risks now validate the linked enterprise risk. Existing AI system arrays and DPIA arrays remain protected by the shared validator.
- **Assets:** asset create/update now validate embedded risk/control/evidence ID arrays; the dedicated relationship endpoint continues to validate both endpoints.

Final server-free authorization suite on 2026-11-21: **25 passed, 0 failed, 0 skipped**. This includes the prior 20 tests plus mocked BCM array rejection, Continuous Assurance external/internal link rejection, immutable workspace identity, secondary AI system-link rejection, and report archive pagination/detail scoping.

## Residual Phase 0B coverage

- Review newly introduced relationship fields as part of future feature work; the currently identified high-risk static paths are covered.
- Perform runtime/database verification only in a future explicitly authorised, no-additional-cost environment.
- Confirm runtime and PostgreSQL behaviour only in a future explicitly authorised, no-additional-cost environment. This phase did not deploy, start application services, or inspect production data.

## Validation classification and limitation

1. **Verified through static analysis:** protected route mounts, authenticated workspace resolution, membership revalidation, repository workspace predicates, and linked-record validation paths.
2. **Verified through mocked/unit tests:** authorised workspace resolution, forged selectors, missing authentication, insufficient report permission, workspace-scoped filtering, foreign report/action/archive rejection, BCM and asset relationship rejection, Continuous Assurance link and identity protection, secondary AI relationships, TPRM child scoping, review-task document ownership, evidence guards, and treatment/control regressions.
3. **Verified through database integration tests:** none in this phase.
4. **Not verified:** real PostgreSQL transaction and constraint behaviour, end-to-end HTTP route composition under a running application, complete secondary-module cross-tenant coverage, and deployed runtime parity.

No frontend/backend application server, preview server, PostgreSQL instance, Docker database, Railway test environment, temporary deployment, or production database was used. The authorization unit suite used only an ephemeral in-process Express test harness with mocked identities and repository access. No additional testing infrastructure should be provisioned for this phase.

**Phase 0A final development status:**

- **A. Static/unit security development:** accepted for the identified high-risk route families.
- **B. Runtime/database verification:** outstanding and not represented by the static/mocked results.
- **C. Production security acceptance:** not granted.

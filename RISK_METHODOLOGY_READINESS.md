# Risk Methodology Readiness

Status: NOT READY FOR DEPLOYMENT. Local changes and disposable validation only; no push, production migration, deployment, or production activation.

## Implemented in this backend pass

- Additive methodology/version references, nullable persisted score/rating fields, workspace/version foreign key and indexes.
- Database write trigger pins creation to the active methodology under the workspace activation lock. No policy rejects creation. Client scores are ignored.
- Risk updates retain provenance; unchanged axes preserve historical scores, including null legacy values. Changed legacy axes use explicit legacy compatibility.
- Risk create writes lifecycle and target inputs atomically, rather than a second update.
- API errors expose scoring validation but not arbitrary database errors. Risk routes enforce session workspace scope.
- Draft activation validates configuration, requires explicit confirmation, retires the previous policy, preserves existing risks, and writes an atomic audit event.
- Activation stays disabled unless RISK_METHODOLOGY_ACTIVATION_ENABLED is explicitly true. This pass did not change any environment variable.
- Fixed-scale demo seeds use an explicit transaction-local legacy mode and skip risk fixtures when a policy is already active.
- Treatment forecast guard validates the linked risk/workspace and derives expected residual rating from its pinned configuration. Completion never writes current residual.
- Intelligence carries methodology metadata and persisted scores/ratings/targets. Dynamic signals normalize against configured dimensions; pinned appetite uses the persisted policy result.
- Compatibility heatmaps use real coordinates, are legacy-only and disclose scope; target no longer copies residual; forecasts without coordinates are not plotted.
- Risk create/edit form loads active/pinned scales and supports nullable target inputs. Missing configuration blocks saving.
- Treatment preview and register rating/filter use methodology context instead of unconditional 5x5 bands.

## Risk-writing inventory (audited before edits)

| Path | Writes | Handling |
| --- | --- | --- |
| risksRepo create/update via risks route | Axes, targets, lifecycle, treatment/acceptance/review metadata | Database scoring/pinning guard; repository whitelist |
| seed-core-grc.ts, two INSERT sites | Seed risk axes/status/CIA | Explicit legacyRiskSeedQuery |
| workspaceSeedingService.ts, three INSERT sites | Workspace demo risks | Explicit legacyRiskSeedQuery |
| riskIntelligenceRepo schema/bootstrap | CIA normalization/backfill only | Non-scoring trigger preserves provenance/scores |
| riskTreatmentRepo | Treatment forecasts/status/control links | Treatment guard; no UPDATE risks |
| riskIntelligenceService | Forecast/snapshot tables | Does not persist computed values into risks |
| Static store | Seed input data | Not an independent mutable risk store |
| Acceptance/transfer/escalation | Main risk update metadata or operational views | No separate direct risk scoring writer found |
| Audit readiness | Risk reads/integration | No direct risk score writer found |

## Migration and test setup

Apply existing core risk and treatment-plan schema, CIA/lifecycle migrations, then
20260923-risk-methodologies.sql and 20260923-risk-version-pinning.sql.
The new migration intentionally does NOT activate a policy or update historical rows.
Do not start the updated backend against an unmigrated schema: read queries require the new columns/table.

Disposable validation command from repository root:

    npx tsx --test backend/src/tests/riskMethodologyPostgres.test.ts

Set TEST_DATABASE_URL externally to a disposable LOCAL PostgreSQL database with
"test" in its name. Before importing real repositories, each test process forces DATABASE_URL to its isolated local test schema. No application database connection is used.
It creates a randomly named schema and drops only that schema in finally.
The current harness tests an existing legacy record plus idempotent migration,
new pinned rows, invalid values, version retention, uniqueness, immutable config,
and treatment isolation. A second suite uses the actual core risk schema, treatment bootstrap, real repositories and methodology HTTP router. Full application startup and session-authenticated browser checks remain required.

## Validation

- Backend TypeScript build: passed.
- Frontend TypeScript/Vite: passed; initial JS 354.83 kB, no size warning in that run.
- Frontend ESLint: passed.
- Backend targeted tests: 14 passed, zero failures/skips, including two live PostgreSQL 18 suites.
- Frontend methodology tests: 5 passed.
- Operations component/navigation check: passed.
- PostgreSQL validation ran on a separate localhost-only temporary cluster on port 55483. Production was not used. No browser success is claimed.

## Remaining blockers / known limitations

1. Disposable PostgreSQL tests now pass. PostgreSQL 18 was found outside PATH. Full application startup/migration/seed rehearsal remains necessary; core-schema tests explicitly supply intelligence-bootstrap prerequisite columns.
2. Concurrent activation/creation, activation audit rollback, and methodology router 401/403/409/200 checks now pass. HTTP checks inject test identities; real session authentication, outer module-permission middleware and risk-write activity delivery still need end-to-end verification.
3. Production rollout must coordinate migrations, backend and policy configuration. Creation now rejects no-active-policy workspaces; activation must not be enabled before validation sign-off.
4. Existing axis constraints support 1-5. Activation rejects axes larger than five; larger custom matrices need a separately reviewed constraint migration. 4x4/5x5 database checks pass; 3x3 unit checks pass. Browser validation remains outstanding.
5. Compatibility intelligence heatmap consumers need browser verification of legacy-only scope and unavailable forecast coordinates. Existing category capacity/KRI forecasts remain separate from methodology appetite and need product sign-off on mixed-scope reporting.
6. Treatment schema bootstrap and repository integration now pass on PostgreSQL. End-to-end linked-control UI flows remain unverified; historical forecasts are not backfilled.
7. In-app visual/interaction checks at 1600x900 and 1366x768 remain unperformed. User requested waiting for in-app browser access rather than a Playwright substitute.
8. Validate all query-filter, target clearing, treatment completion and unknown-methodology error paths in the authenticated app.
9. Risk create/update activity logging still occurs after the risk write; audit-delivery failure/retry behavior is a pre-existing follow-up. Activation audit is transactional.

## Exact next step

Rehearse full application startup/migrations/seeds on disposable infrastructure, then run real-session API checks. Remediate failures, then perform in-app
checks for /workspaces/risk, /risks, /risks?status=open, /risks?appetite=outside,
/risks?tab=treatment-plans, /risk-matrix (4x4 and 5x5), /issues and /issues?type=treatment.
Do not deploy or enable production activation until these gates pass.

## Files changed in this pass

- backend/sql/migrations/20260923-risk-version-pinning.sql
- backend/src/repositories/riskMethodologyRepo.ts
- backend/src/routes/riskMethodologies.ts
- backend/src/repositories/risksRepo.ts
- backend/src/routes/risks.ts
- backend/src/types/models.ts
- backend/src/services/legacyRiskSeed.ts
- backend/src/scripts/seed-core-grc.ts
- backend/src/services/workspaceSeedingService.ts
- backend/src/repositories/riskTreatmentRepo.ts
- backend/src/routes/riskTreatments.ts
- backend/src/services/riskTreatmentValidation.ts
- backend/src/types/riskTreatment.ts
- backend/src/repositories/riskIntelligenceRepo.ts
- backend/src/services/riskIntelligenceService.ts
- backend/src/types/riskIntelligence.ts
- backend/src/services/riskMethodologyRules.ts
- backend/src/tests/riskMethodologyRules.test.ts
- backend/src/tests/treatmentControls.test.ts
- backend/src/tests/riskMethodologyPostgres.test.ts
- frontend/src/types/riskIntelligence.ts
- frontend/src/types/risk.ts
- frontend/src/components/RiskModal.tsx
- frontend/src/components/RiskTreatmentModal.tsx
- frontend/src/lib/riskScoreProfile.ts
- frontend/src/pages/Risks.tsx
- frontend/src/pages/RiskRegisterView.tsx
- frontend/tests/risk-methodology.test.mjs
- RISK_METHODOLOGY_READINESS.md

Other existing dirty files were not staged, reverted, or included in a deployment.
Scoped git whitespace check passed. Heuristic scan of the scoped files for common
private-key, token and database credential patterns found no matches; this is not a full security audit.

## Follow-up validation pass

- Added real repository/core-schema and methodology route integration tests.
- Added concurrent activation/create, SQL/TypeScript scoring parity, invalid/required target, 4x4 limits, historical version retention and activation audit rollback checks.
- Treatment writes now fail closed when their methodology trigger is missing or disabled.
- Changed in this follow-up: riskTreatmentRepo.ts, riskMethodologyPostgres.test.ts, new riskMethodologyRepositories.test.ts, and this report.
- Frontend was not edited in this follow-up; bundle measurement above is from the preceding build.

## Startup blocker remediation (2026-09-23)

- Disposable database: laflo_methodology_rehearsal, PostgreSQL 18 on 127.0.0.1:55483. Synthetic data only; no Railway database used.
- Fixed document/course link declarations to reference the parents' TEXT identifiers. Optional training links now skip a missing ws-001 demo workspace. The full linking script passes on the disposable database.
- Added migrate-risk.ts and wired it before seeding/server startup in npm start. It serializes replicas with an advisory lock, bootstraps risk prerequisites, applies six ordered SQL migrations with transactional ledger entries, and aborts startup on failure. A second execution skips applied migrations successfully.
- This is a risk upgrade runner, not a full empty-database provisioner: base workspace/auth/core/control schemas must exist first. Existing UUID-based installations are not automatically converted by CREATE TABLE IF NOT EXISTS; inspect deployed parent/child types before rollout.
- Backend TypeScript passed. Fourteen backend tests passed, including both PostgreSQL suites, zero skipped. Five frontend methodology tests passed. Scoped tracked-file whitespace check passed.
- Real synthetic login succeeded. Initial API requests correctly returned 403 because the user was added after access-governance bootstrap. Running the existing bootstrap with that membership initialized normal enterprise permissions; no auth bypass was added.
- With the real session: risks, active methodology, intelligence state and treatment summary returned 200; draft creation returned 201; activation returned 409 VALIDATION_GATE. Unauthenticated risks returned 401. Foreign-workspace access returned 403 before role initialization; repeat the latter with initialized permissions before final sign-off.
- No activation was enabled, no policy was silently assigned, no production data was touched, and nothing was pushed/deployed.
- Remaining: full clean provisioning rerun, real-session activation and risk/treatment mutation checks, browser checks, and a reviewed per-workspace policy activation rollout. New risk creation intentionally requires an active methodology; turning off this guard is not an acceptable deployment workaround.
- Deployment recommendation remains NOT READY until those checks and policy rollout are complete.

## Authenticated rehearsal continuation (2026-09-23)

- Actual npm start succeeded on the disposable database with PORT=3308 and activation enabled only in that child process. It ran migrations, core seeds, and backend startup in sequence. This validates upgrade startup, not a second full empty-database provisioning run.
- Real login/session passed through normal permissions. HTTP tests passed: draft creation, mandatory activation confirmation, activation, persisted methodology/version and 25/20/6 scores, metadata-only score preservation, clearing target to null, rejecting expected residual 26 on a 5x5 policy, treatment completion with actual residual unchanged.
- Activated a disposable 4x4 draft. Verified one active version, historical 5x5 risk accepts its original axis range on update, new 4x4 risk rejects axis 5, and foreign workspace request returns 403. Matrix response is four rows/16 cells; initial test mistakenly asserted the row count was 16 and was corrected to flatten cells.
- In-app browser real login succeeded against localhost preview. Inspected 4x4 analytics at 1366x768 and Operations at 1600x900; matrix and filtered register had no document horizontal overflow at the measured sizes. Outside-appetite register loaded its selected filter, score path and Target risk Not set. Treatment Plans and edit modal loaded, preserving expected residual 1-25 for the historically pinned risk. Overview loaded its Risk Actions and real KPI buttons. No errors captured by the browser console tool during these checks.
- Browser coverage is partial: all routes at both sizes, 5x5 visual switching, export, and complete form submissions remain unverified. At laptop size the right rail was not visible in the matrix screenshot. Treatment UI requires a description although API validation permits an empty description; the invalid-forecast UI attempt hit that earlier requirement, so forecast validation is verified via API only.
- Frontend production build/TypeScript passed, initial JavaScript 354.72 kB. Windows cannot execute the Unix sh-based preview script; direct npx vite preview served the same production build on loopback port 4177.
- No production activation, GitHub push, or Railway deployment. Production policy selection/activation rollout still needs explicit review; never silently activate the test template.

## Selected release policy - 2026-09-24

Selection confirmed for release preparation ONLY. Formal policy approval remains
outstanding; no formal approval record has been supplied. This selection grants
neither deployment permission nor production activation permission.

Selected Enterprise Risk Methodology: 5x5 multiplication matrix.

| Rating | Inclusive score range |
| --- | --- |
| Low | 1-5 |
| Medium | 6-11 |
| High | 12-19 |
| Critical | 20-25 |

Appetite threshold: **11**. Scores 1-11 are within appetite. Scores 12-25 are
outside appetite and require treatment, escalation, review, or management
attention according to configured rules. A breach does not itself automatically
trigger every workflow action.

Historical preservation: retain existing methodologyId/methodologyVersion and
original scoring basis, including existing null legacy provenance. Activation
must not mutate or silently recalculate historical records. Any future re-score
must be explicit, controlled, audited, and approved. This selection authorizes no
historical version overwrite or re-score.

The existing compatibility template and SQL legacy configuration already match
these bands and threshold. No seed/default configuration change is needed. No
saved policy or production environment variable was changed. Matching this
selection does not make the compatibility template formally approved.

Deployment remains BLOCKED until outstanding validation is closed and formal
approval is recorded, including approver, date, exact policy/version and scope.
Activation gates remain unchanged. Prior disposable migration/activation tests do
not represent production migration or activation. The report's initial status
statement refers to production; disposable execution is documented below it.

Validation expectations: 5=Low, 6=Medium, 11=Medium, 12=High, 19=High,
20=Critical, 25=Critical; appetite breach starts at 12. Dedicated boundary tests
also check appetite results across every attainable 5x5 score.

Policy-recording validation: six backend scoring tests passed, five frontend
methodology tests passed, backend TypeScript build passed. Scoped untracked-file
diff/whitespace checks passed; heuristic secret scan found no matching credential
patterns. PostgreSQL integration suites were inspected for historical-preservation
coverage but were not rerun for this documentation/test-only change.

## Deployment-readiness closure pass - 2026-09-24

### Formal approval record (Pending)

| Field | Recorded value |
| --- | --- |
| Methodology name | Enterprise Risk Methodology - selected release policy |
| Matrix | 5x5, likelihood multiplied by impact |
| Bands | Low 1-5; Medium 6-11; High 12-19; Critical 20-25 |
| Appetite threshold | 11; outside appetite begins at 12 |
| Historical preservation | Retain pinned methodologyId/version and original scoring basis |
| Historical re-scoring | No automatic recalculation; future re-score requires explicit, controlled, audited approval |
| Approver name | Pending - not supplied |
| Approver role | Pending - authorized policy approver required |
| Approval date | Pending |
| Approved persisted version / workspace scope | Pending identification and sign-off |
| Approval evidence/reference | Pending - no approval has been fabricated |
| Deployment status | BLOCKED until formal approval and remaining validation are complete |

This is a documentary pending approval record, not an application approval or an
activation audit event. Existing methodology audit events do not constitute a
formal policy approval workflow. No approval infrastructure or production record
was modified.

### Fixes and checks

- MainLayout: for Risk Management below 1480px, Personalized Home is accessible in
  a native collapsible panel above page content, with a 60vh internal scroll area.
  Desktop rail and other modules remain unchanged. Mouse and Enter-key operation
  verified at 1366x768. Collapsed view preserves main content width.
- Treatment form: description now explicitly optional, matching the existing API
  contract. Required title/owner/due date unchanged. Added integer progress and
  valid due/review date checks; backend constraints were not weakened. Linked
  methodology forecast range, acceptance rationale and completion rules remain.
- Browser: real synthetic login on localhost:4177 with backend localhost:3308 and
  disposable laflo_methodology_rehearsal database. Production not accessed.
- At both 1600x900 and 1366x768, basic route smoke checks passed for Overview,
  Register, status=open, appetite=outside, treatment-plans, Matrix, Operations,
  type=treatment and /risk-methodology. No document horizontal overflow, observed
  error boundary, blank route or captured console/dynamic-import error.
- Loaded 4x4 matrix and active version/scope disclosure visually verified at laptop
  width. Configuration page internal containers checked without overflow.
- Treatment modal opened and displayed optional description. Invalid forecast 26
  for its pinned 5x5 policy and progress 0.5 both displayed correct validation
  feedback; cancelled without saving. Route presence is not exhaustive interaction
  coverage: all Operations tab interactions, full visual review at both sizes,
  5x5 visual switching and a valid form save after the fix remain unverified.
- Existing configuration banner still describes scoring integration as incomplete;
  this copy needs review against implemented backend behavior. No activation gate
  was changed to work around that message.

### Validation and decision

- 14 backend scoring/treatment unit tests passed; two PostgreSQL integration tests
  passed separately (16 total), including pinning and treatment guards.
- Five frontend methodology tests passed. Frontend TypeScript/Vite production
  build and ESLint passed. Scoped whitespace checks passed.
- Initial JS: 355.20 kB (previous 354.72 kB, +0.48 kB); below 500 kB.
- React review: native details/summary supplies keyboard disclosure behavior;
  no new dependencies, effects, or network calls added for the compact panel.
- Recommendation: NOT READY FOR DEPLOYMENT. Formal approval is Pending and the
  remaining detailed browser coverage above is still open. Basic route coverage
  and laptop rail discoverability are improved, not a substitute for full sign-off.
- No push, deployment, production activation or scoring-policy changes occurred.

## Production deployment authorization - 2026-09-24

The requesting user explicitly authorized production deployment in this task
("can you deploy to prod now approved"). This supersedes the previous no-deploy
instruction, but does not waive failed technical checks or authorize applying a
policy indiscriminately to all workspaces. The selected 5x5 policy remains as
recorded above. Named approver/role has not been independently verified.

Production activation scope: Sochrist Ventures only, explicitly confirmed by the
requesting user. Read-only production preflight resolved this to workspace
`sochrist-ventures-onboarding-dd3b1d81` (Sochrist Ventures Onboarding).
No cross-workspace activation is authorized by inference. No deployment or
production activation has occurred in this release attempt.

Railway preflight identified an ordering defect: backend/railway.toml ran
seed:core before npm start, bypassing migration-first startup on its first seed
pass. Changed the release command to npm run start, whose script runs risk
migrations, then core seed, then the server. This must be included in the focused
release and verified against Railway's resolved configuration.

### Tenant-scoped rollout blocker

Read-only production preflight found five workspaces. The selected workspace has
85 risks. The other four workspaces also contain risks; neither the methodology
table nor the risk migration ledger exists in production yet. No production
database writes were performed during this check.

The pending global risk_methodology_pin trigger rejects new risks without an
active methodology. Deploying it while activating only Sochrist Ventures would
therefore block risk creation in the four other workspaces. Deployment remains
technically blocked until a tested tenant-scoped rollout preserves their existing
behavior without approving new policies for them or weakening pinning for enrolled
workspaces. Do not resolve this by activating policies across all workspaces.

Historical risk scores and methodology identities must remain unchanged. User
deployment approval is recorded, but does not waive this compatibility blocker.

## Isolated 3x3 / 4x4 validation - 2026-09-24

Decision: B - Not ready for deployment. No push, deployment, production activation,
Railway access, customer data or changes to the approved 5x5 policy in this pass.

### Isolation and policies

A fresh initdb PostgreSQL cluster was created in the local temporary directory,
bound to 127.0.0.1:55484. Database: laflo_methodology_validation_test.
Tests create random risk_repository_test_* and risk_test_* schemas and drop them
in finally blocks. Workspace: disposable-methodology-validation. All records are
synthetic and disposable; no production/staging/shared data was copied. The
cluster can safely be reset. Test route identity is synthetic, not a full login.

- 4x4 TEST ONLY: Low 1-4, Medium 5-8, High 9-12, Critical 13-16;
  appetite 8, treatment from 9, escalation from 13. Approval pending.
- 3x3 TEST ONLY: Low 1-3, Medium 4-6, High 7-9; appetite 6,
  treatment from 7, escalation from 9. No Critical band. Approval pending.
- Both use multiplication, optional target, and separate draft/confirmed activation
  in disposable storage. Neither policy is production approved or active.
- 5x5 remains approved for Sochrist Ventures only, not deployed.

### Evidence

16 relevant backend tests passed, zero skips, including both PostgreSQL suites.
Expanded repository test exercises all 16 and 9 axis combinations, persisted
scores/ratings/appetite/pins, null and populated targets, invalid axes and forecast
ranges, confirmation and activation audit events. All integer rating values in
1-16 and 1-9 are compared with the SQL rating function, including boundaries not
reachable by integer multiplication (e.g. 7 in 3x3). Treatment/escalation thresholds
are configuration-validated, not proof that operational workflows are triggered.

4x4 to 3x3 activation preserves historical fields, scores, ratings and version;
the referenced policy status legitimately changes to Retired. Subsequent scoring
updates to historical risks use the pinned 4x4 policy. Completed treatments leave
actual residual and target unchanged. Foreign-workspace reads return null; another
synthetic workspace's risk remains unchanged. Existing concurrency, activation
rollback and guard tests pass. This does not resolve the no-active-policy rollout
blocker for other production workspaces.

Six frontend helper tests pass: matrix dimensions, labels/colours by band, populated
and empty counts, historical exclusion and missing-target display helpers. These
are computational checks, NOT rendered browser/visual acceptance. No safe full
application authenticated session was established for this newly created database;
1600x900 and 1366x768 form/rail/heatmap checks remain outstanding. Production's
logged-in browser was deliberately not used for isolated policy testing.

Backend TypeScript build passed. Scoped new-test whitespace checks passed; heuristic
secret pattern scan found no matches. Broad diff check identified a pre-existing
extra EOF blank line in unrelated EnterpriseOperatingSystem.tsx, left untouched.
Only test code and this report were changed during this validation pass.

### Remaining blockers

- Tenant-scoped rollout must preserve risk creation in workspaces without an active
  policy; global guard still blocks those writes.
- Full authenticated browser checks for both candidates at both required sizes.
- Operational treatment-threshold behavior and full authenticated risk HTTP paths
  need explicit end-to-end coverage beyond repository/DB and synthetic route tests.
- Separate business approval needed before any production 3x3/4x4 activation.

Next: close the tenant-scoped compatibility blocker, then provision a synthetic
full-app login against disposable data and finish browser acceptance. Do not deploy.

## Tenant-scoped rollout compatibility - 2026-09-24

Decision: A - Ready for authenticated browser validation, NOT deployment.
No push, deployment, production connection, activation or customer data used.

### Implementation

Added 20260924-risk-tenant-rollout.sql and registered it after version pinning.
No reusable workspace settings mechanism was found in inspected schemas/repos.
workspaces.risk_methodology_mode defaults to legacy for existing/new workspaces.
The migration changes no historical risks and activates no policies.

- Active workspace policy: new risks always use and pin that policy, even if the
  workspace mode is legacy. Mode controls the fallback when no active policy exists.
- Legacy/no active (including draft-only): server-scored compatibility writes are
  allowed with null methodology ID/version, never a fabricated active policy.
- Enforced/no active (including draft-only): new risks fail with the configured
  methodology-required validation message. Legacy seed flags cannot bypass this.
- Pinned updates keep their original scoring config, regardless of workspace mode.
- Unpinned historical risks in enforced mode permit non-scoring updates only;
  changed axes/targets require an explicit migration workflow, not yet implemented.
- Mode changes use a workspace row lock and transactional audit records through
  setWorkspaceMode. No public mode mutation endpoint or production toggle added.
  Activation/new-risk creation share the workspace lock. Audited mode changes must
  use this controlled repository operation, not direct administrative SQL.

GET risk-methodologies/state returns mode, active identity/version, compatibility
and warning. Risk records expose legacyCompatibility and treatmentRequired /
escalationRequired booleans from their pinned config; missing config yields null,
not guessed thresholds. Preview scoring also exposes threshold flags.

RiskModal now permits legacy creation using the compatibility template and warns
that pinning is not active; enforced/no-policy remains blocked. Legacy edit warning
explains enforced non-scoring-only updates. Configuration page reports workspace
mode and replaces stale 'integration incomplete' copy. Existing Matrix scope and
Score Profile already disclose legacy vs pinned methodology; preserved unchanged.

### Tests and evidence

Disposable localhost PostgreSQL: laflo_methodology_validation_test at port 55484;
random per-suite schemas, synthetic workspaces only, schemas removed afterward.
16 backend tests passed, zero skips, including PostgreSQL/concurrent activation.
Added default legacy creation, enforced missing/draft policy rejection, legacy
with draft creation, mode audit count, legacy score-edit restrictions, and pinned
threshold assertions for all candidate 4x4/3x3 axis combinations. 5x5 unit checks
verify appetite >=12, treatment >=12 and escalation >=20 for all 25 combinations.
These latter thresholds were already configured, not newly approved business rules.
4x4 test thresholds remain 8/9/13; 3x3 remain 6/7/9. Both are unapproved test policies.
Threshold flags do NOT automatically create treatments, escalation tasks or approvals.

Six frontend helper tests passed. Backend TypeScript and frontend production build
passed; frontend ESLint passed. Initial JS 355.20 kB, unchanged at reported precision.
Scoped whitespace checks passed (line-ending warnings only); heuristic secret scan
of focused migration/repository/test files found no matches. React review retained
workspace-dependent effects, stale-response guards, disabled loading/error submission,
and text status messages; no new dependency or global shell change.

### Browser preparation / remaining gate

No full-app authenticated fixture exists in this newly created disposable database;
the integration server uses synthetic test identity and is not a browser-login app.
Do not use the available production browser as a substitute. Prepare local full-app
fixtures A=enforced+active, B=legacy/no active, C=enforced/no active. At 1600x900 and
1366x768 check /workspaces/risk, /risks, /risk-matrix, treatment-plans and configuration;
verify creation, historical edits, mode warnings, navigation/rail usability, console,
overflow and tenant isolation. This authenticated visual gate remains OPEN.

Approval unchanged: 5x5 Sochrist Ventures only, not deployed; 3x3/4x4 pending.
Next: complete authenticated disposable browser validation and release review.

## Authenticated disposable browser validation - 2026-09-24

Decision: B - Not ready; meaningful browser coverage completed, full checklist open.
No push/deploy/production activation or production data/credentials used.

Reused synthetic local laflo_methodology_rehearsal database at 127.0.0.1:55483;
prior documented disposable cluster contains only generated fixtures. Added
validation-enforced (Disposable Enforced Validation) and validation-legacy
(Disposable Legacy Validation), with rehearsal@example.invalid owner membership.
Enforced active Disposable Validation 5x5 v1 uses approved bands/appetite; legacy
has no active policy. This is test activation, not business approval. Environment
is resettable. Local backend 3310, frontend 4179; actual UI password login/session,
not injected browser auth. Production tab left untouched.

Found and fixed:
- Risks.tsx create/edit used plain fetch without authorization/workspace headers;
  UI save failed 'No token provided'. Replaced with existing apiCall.
- Register retained prior workspace rows on selector switch. Added workspace-driven
  reload/reset and request-sequence protection against stale results.
- Score profile lacked threshold text. Added indicators derived from pinned config
  and explicit disclaimer that no workflow tasks are automatically created.

Verified through browser:
- Real login; select enforced/legacy and return. Configuration clears active policy
  in legacy, returns configured v1 in enforced. Selector labels all use the same
  synthetic organisation name; selected by observed option values during testing.
- Created Browser legacy validation and Browser enforced validation via UI. Local DB
  confirms null legacy pin vs enforced v1, score 9, CIA Integrity normalized.
- Enforced title-only edit persisted and retained v1 and scores 25/20/2.
- Appetite query excludes within-appetite fixture. Missing target shown Not set.
- 5x5 heatmap loaded with 3 scoped records; legacy matrix explicitly disclaims active
  policy and shows 2 records. No other workspace risks visible after switch fix.
- Desktop 1600x900 matrix screenshot, laptop expanded rail screenshot and laptop
  filtered register/score screenshot captured inline in task; not committed/saved
  as a test-results screenshot pack.
- 1366x768 native Personalized Home disclosure opens and provides internal scroll.
- Basic route/heading/overflow smoke at both sizes for enforced Overview, Register,
  status=open, appetite=outside, treatment-plans, Matrix, Issues, type=treatment,
  configuration. Legacy Overview/Register/Matrix/configuration also checked both.
  Heading smoke is NOT exhaustive content or interactive verification.
- No document horizontal overflow or observed app error boundary. Captured browser
  console error list empty at final check. HTTP auth failure was visible in form;
  an empty console list does not imply no failed requests occurred.

Validation: frontend production build passed, initial JS 355.20 kB. Scoped whitespace
checks passed with CRLF warnings only. No backend source/config changed in this pass.

Open: scoring edit via browser, treatment invalid forecast/completion via browser,
JSON export, every Operations tab, Evidence/Audit routes, full Executive lazy-route
regression, unauthorised HTTP checks and stronger automated browser assertions.
The default executive landing loaded after login, but not full dashboard coverage.
Release review remains blocked until these checks are closed. 3x3/4x4 remain pending
approval. Backend integration evidence from prior pass is not a substitute for
these remaining browser checks.
Six frontend tests passed. Final frontend lint/build rerun after request-ref cleanup; local browser tab closed and viewport reset.

## Remaining validation closure - 2026-09-24

The previously listed local release-validation checks are now closed for the
focused Risk Methodology candidate. This supersedes the preceding partial-browser
checklist, not the production rollout/activation gates. No push, deployment or
production activation was performed in this validation pass.

### Defects remediated

- JSON risk report requests and downloaded metadata now identify JSON, not PDF.
- A delayed 401 for a superseded token no longer clears a newer session. Current
  invalid-session 401 handling remains enforced; automated regression added.
- Evidence load/save now use the configured authenticated, workspace-aware API.
  Workspace switches clear selection and protect against stale fetch results.
- Evidence API rejects a workspace header/query override that differs from the
  authenticated session. Verified 401 without authentication, 403 mismatch and
  200 for the authenticated workspace; GET/POST guard regression added.
- Existing legacy risk records are now skipped by startup fixture seeding, as
  active-policy workspaces already were. PostgreSQL regression added.
- status=open drill-down now matches the KPI: excludes closed/cancelled, rather
  than only matching the literal Open lifecycle. Explicit filter label and test.
- Methodology activation copy describes controlled release approval accurately;
  activation remains disabled in the UI and server activation gate is retained.
- Empty Evidence table reports 0-0, not 1-0.
- Report forecast/dynamic numbers are labelled as 0-100 intelligence indices,
  distinct from methodology scores. No scoring formula changed.

### Authenticated in-app evidence

Used only disposable localhost data, PostgreSQL port 55485 after the old port
could not bind; frontend 4179, backend 3310. Normal UI sign-in, no injected token.

- Explicit scoring edit changed residual 20/Critical to 16/High. Inherent 25,
  target 2, methodology ID/version v1 and CIA Integrity remained intact.
- Expected residual 26 rejected by browser range validation (maximum 25).
- Saved expected residual 4 and Completed/100% treatment through the UI. Re-read
  database confirms actual residual still 16, target 2 and methodology v1.
- JSON report downloaded to the local Downloads folder and parsed successfully;
  format=json, three populated sections. Browser download-event instrumentation
  timed out, but the actual file and UI success were independently verified.
- All five Operations tabs rendered non-empty content at 1600x900 and 1366x768.
  Treatment query truthfully remains a route-ready notice, not a fake filter.
- Evidence and Audit Command Center loaded; all six Executive Dashboard internal
  panels rendered non-empty content after lazy route navigation.
- Route/overflow smoke passed at both sizes for Overview, register open/outside
  filters, treatment plans, matrix, Operations, Evidence and Audit.
- Stronger record assertions verified outside-appetite excludes the within risk;
  open drill-down shows all three eligible fixtures; browser back restores the
  outside-appetite URL and its one-record result, then forward restores open.
- Loaded 5x5 matrix has 25 accessible cells, no zero-count badges; laptop visual
  captured inline. Existing heatmap visual results from the preceding pass apply.
- Final clean-tab Matrix, Evidence and Operations pass captured no console errors.
  Earlier development hot-reload/context and superseded-session errors occurred
  during edits/restarts; these are not represented as a clean entire-session log.

### Isolated release review

RISK_METHODOLOGY_RELEASE_FILES.txt is the explicit source/test allowlist.
Built an independent HEAD snapshot plus these files only, excluding unrelated
AI, governance, training, regulatory, TopBar, ShellContext and global CSS edits.
The candidate compiles with the installed Vite 7 toolchain; no new dependency.
Earlier candidate run accidentally resolved ancestor Vite 4; it was rerun with
frontend's own dependencies, and only Vite 7 results are release evidence.

Ran candidate migrations and startup seed against a separate clone of the
synthetic rehearsal database. Seed exited 0; JSON comparison confirmed all 92
pre-existing risk rows unchanged, including historical methodology/scoring fields.
Seed can still insert new demo fixtures under its existing legacy behavior; this
is not permission to seed production or expand the production activation scope.

Backend TypeScript and 17 tests (including PostgreSQL) passed, zero skipped.
Frontend TypeScript/production build, lint and eight tests passed.
Scoped whitespace check and heuristic credential-pattern scan passed.
The allowlist contains no databases, dumps, downloaded reports or credentials.

### Release boundary

Ready for controlled release preparation, not a claim of live Railway success.
Before production changes: capture rollback/backup evidence, review the exact
allowlisted diff, confirm Railway service/commit targeting, then perform live
post-deployment smoke checks. Do not publish the entire dirty worktree.
Only the approved Sochrist Ventures 5x5 policy may be activated. 3x3/4x4 remain
unapproved isolated test policies. Historical re-scoring remains explicit,
controlled and audited; activation must not mutate historical risk records.

Final isolated Vite 7 candidate initial JS: 354.08 kB (no size warning).
Final allowlist: 68 source/test files; zero credential-pattern matches and zero trailing-whitespace lines. Documentation accompanies the allowlist separately.

## Production-copy release gate - 2026-09-24

User authorized proceeding with the controlled GitHub/Railway release. Policy
activation scope remains Sochrist Ventures only, approved 5x5 bands and appetite
11; no 3x3/4x4 production activation is authorized.

Captured a restricted local custom-format production backup and verified its
archive directory. Recorded pre-release frontend deployment
94dd026d-9d58-4440-9dbe-d49598751613 and backend deployment
a40283c4-8708-41e8-91c0-6dafa4dac08d, both commit 146fd19.

Restored the backup to a disposable local database and rehearsed migration plus
startup seeding. This exposed category-derived CIA backfill on 344 historical
records whose CIA values were unset. Removed that inference from migration and
bootstrap; empty CIA arrays remain valid and visibly unset. Explicit CIA values
retain validation/normalization. Added a PostgreSQL regression assertion.

Repeated from a fresh backup restore: migration and seed exit 0, 344 records
before and after, zero changes to any pre-existing risk field. Added schema
columns are excluded from this comparison. Backend build and all 17 tests pass.
The earlier unrelated EnterpriseOperatingSystem whitespace issue is outside
this release; scoped diff checking is required rather than staging its change.

Rollback: retain the restricted backup and captured deployment metadata outside
Git. If release smoke fails, stop further activation and assess compatibility
before reverting application versions. Database restore is a separate controlled
operation requiring a write freeze and reconciliation of any post-backup writes;
do not automatically restore over live data or run the old seeder against a new
active methodology. No destructive rollback is authorized by this runbook.

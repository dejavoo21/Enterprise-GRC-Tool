# Consolidated Risk Management local acceptance

This record supersedes stale pending notes in earlier checkpoints. Evidence is
in design-evidence-index.md and acceptance-ledger.md; screenshots are in
screenshots/. This is local implementation acceptance, not production approval.

## 1. Summary
All 11 Risk Management interfaces were rebuilt and audited against the supplied
ZIP and written brief. Audit defects were corrected and rechecked. Values come
from scoped sources; missing capabilities remain explicit rather than simulated.

## 2. Files inspected
Inspected the supplied redesign and committee-report briefs, ZIP images, Risk
page/components/styles, query helpers, methodology/profile helpers, repositories,
report generation/export/email services, migrations, and focused tests.

## 3. Files changed
The isolated candidate contains 76 scoped source/test/document files. All matched
the worktree at the final source checkpoint. Unrelated dirty files were excluded.
Primary UI files are RiskWorkspaceLanding, RiskRegisterView, RiskScoreProfile,
RiskIntelligenceWorkspace, RiskMatrix, RiskMethodology, RiskTreatmentWorkspace,
RiskReportsWorkspace, RiskReportPreview, Issues and RiskOperations components.
Supporting changes cover stable references, CIA propagation, report exports,
source-error handling, activity semantics and regression tests.

## 4. Overview
Compact hero, methodology/status disclosure, six actionable KPIs, operational
health, three action cards and an accountable watchlist are present. The written
Review/Evidence Health and watchlist requirements supersede decorative mockup
widgets. Paired overview-reconciled captures and watchlist keyboard evidence
verify layout, exact-reference navigation and source failure truthfulness.

## 5. Register
Hero, six summaries, labelled primary/secondary filters, browser-local saved view,
separate score chips, stable references and internally scrolling table are
implemented. No large empty detail panel appears before selection. Selected
profile, treatment failure/Retry, query/history and both viewport checks passed.
See register-target-final-1600/1366 and register-selected evidence.

## 6. Risk references
Database-generated immutable references are persisted independently of list
position. Repository tests cover preservation. References appear in register,
selected details, treatments, operational drill-downs, activity and report data.
The reference migration was exercised locally, not applied to production.

## 7. Score profile
Inherent/current residual/target are distinct, with pinned methodology basis,
recorded ratings and movement where calculable. Missing targets show Not set.
Expected treatment residual is a forecast, never substituted for actual residual.
Missing pinned configuration does not trigger legacy inference.

## 8. Intelligence
Executive interpretation, forecast, KRI filters/pagination, appetite/tolerance,
capacity, loss, near-miss and emerging sources are grouped into readable cards.
Category normalization removes duplicate filter choices without altering records.
Register-only retained filters are labelled to avoid implying dashboard filtering.
No mockup historical trend series were invented.

## 9. Matrix / Methodology
Dynamic axes, cells, rating colours and legends use configuration. Populated 3x3
and 5x5 and empty version-scoped 4x4 were checked. Explicit target coordinates are
required; scalar forecasts are separate. Workspace mode, active version, legacy
exclusions and scoring guide remain visible. Restricted configuration writes and
invalid drafts are rejected; production activation was not performed.

## 10. Treatments
Dedicated summary/table/selected-plan layout includes references, progress,
accountability, expected outcome and linked controls. Local saved progress and
completion retained actual residual scores and selection continuity. Evidence
linking is explicitly unavailable, not a fabricated attachment count.

## 11. Reports
Structured committee pack includes metadata, executive summary, decisions,
appetite, risk table, score movement, treatments, overdue items, forecasts,
capacity, KRIs, sign-off and appendices. PDF is real; CSV and JSON preserve data.
Generated preview tables were inspected at both sizes with keyboard scrolling.
Email consent/reset/error and browser-to-loopback-SMTP PDF receipt were verified.
No external email was sent. Scope guidance is a keyboard-accessible disclosure.

## 12. Operations
Overview has real distribution, escalation queue, focus actions, workflow health
and activity. Issue Queue has filters, pagination, selection and source linkage.
Escalations has grouping/mix/guidance; Overdue has age/remediation context; Reports
has source/priority/status summaries and an honest unavailable export state.
CIA classifications now survive the derived-risk issue mapping. Activity-ledger
navigation was verified to load its actual event table.

## 13. Tenant / methodology preservation
38 backend tests include PostgreSQL pinning, write rejection, workspace isolation,
control ownership and unchanged actual residual on treatment updates. Browser
late-response tests cover workspace changes. No policies were activated and no
historical records were automatically rescored.

## 14. Accessibility
Labelled filters, native controls/disclosures, table headers, text badges and
visible focus are implemented. Keyboard tabs, scroll regions, selected actions,
preview disclosures and return focus were exercised. This is not a formal
screen-reader or WCAG certification.

## 15. Responsive behavior
Paired 1600x900 and 1366x768 evidence covers all named interfaces. Tables scroll
internally and selected panels remain contained. The unchanged shell collapses
Personalized Home to an accessible disclosure at laptop width. This deliberate
shell behavior differs from mockups with a permanently expanded rail.

## 16. Page-by-page design audit
| Page | Evidence and result |
| --- | --- |
| Overview | overview-reconciled pair; watchlist-focus-1366; hierarchy and actions verified |
| Register | register-target-final pair; selected-profile checks; contained table/detail |
| Intelligence | intelligence-reconciled pair; lower-compact-1366; real-data hierarchy |
| Matrix/Methodology | matrix 3x3/5x5 pairs; target-focus-1600; 4x4 preview and guards |
| Treatments | treatment-selected-reconciled pair; progress-polished-1366; controls/outcome |
| Reports | reports-target-final pair; compact-scope pair; preview-treatment pair |
| Operations Overview | operations-overview-compact pair; lower-contained pair |
| Issue Queue | issue-queue-compact pair; issue-cia-preserved-1366; filters/details |
| Escalations | escalations-lower pair; source-keyboard-1366; grouping/drill-down |
| Overdue | overdue-current pair; age tests; truthful unknown blockers |
| Operations Reports | operations-reports-final pair; totals and export explanation |

No dedicated ZIP target exists for the final two tabs; written requirements and
shared visual styles define their acceptance. Matching means hierarchy and
interaction alignment, not copying illustrative values or pixel equivalence.

## 17. Issues found
Audit found missing-value score typography, duplicate category filters, misleading
retained query chips, lost issue CIA, stretched activity/health layout, oversized
Operations metrics, and unnecessarily prominent report-format prose.

## 18. Corrections
Scoped typography, category normalization, filter-scope labels, canonical CIA
mapping, compact Operations metrics, bounded named activity region, native progress
styling and accessible report-scope disclosure corrected those findings.

## 19. Validation
Latest frontend production build/TypeScript passed; full ESLint and 24 focused
frontend tests passed, zero skips. Latest backend suite: 38 passed, zero skips,
including disposable PostgreSQL, exports and loopback SMTP. Backend build passed
at the post-CIA source checkpoint; no backend source changed afterward. Scoped
whitespace passed. Targeted private-key/GitHub/AWS pattern scan found zero matches;
this is not a comprehensive security audit. Expected rejected-write database logs
are negative test evidence, not test failures.

## 20. Bundle
Initial JavaScript: 354.33 kB (gzip 97.48 kB). Lazy Risks chunk: 100.19 kB.
No Vite 500 kB initial-chunk warning. Latest change stayed outside initial JS.

## 21. Intentionally unchanged
Global shell, route names, production configuration/data, historical score pins,
scoring policy and unrelated dirty files. Unsupported trends, approval/history,
verified evidence counts and workflows were not invented to match screenshots.

## 22. Limitations
Formal approval/signatures, persisted report archives, historical reporting,
scheduling, verified linked-evidence counts and Word/PPT are not implemented;
the UI discloses them. External inbox delivery is not certified by loopback tests.
Local screenshots are not production smoke-test evidence.

## 23. Deployment recommendation
Do not push or deploy under this goal. Production release requires a separately
authorized scoped review, migration rehearsal and authenticated Railway smoke test.
No commit, GitHub push, Railway deploy or production activation was performed.

## 24. Next step
Review this local acceptance and its documented limitations before authorizing a
separate release. Preserve the isolated candidate and evidence for that review.

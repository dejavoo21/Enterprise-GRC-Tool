# Risk Management redesign audit

Status: IN PROGRESS. Local candidate only. No GitHub push, Railway deployment,
production activation, or production data changes are authorized by this task.

## Evidence so far

### Latest checkpoint: 24 September, final local audit pass

This checkpoint supersedes earlier validation counts below. Deployment is still
not authorized. Export delivery is NOT signed off.

- Frontend TypeScript/Vite production build and full ESLint passed with no lint
  warnings. Ten frontend methodology/session tests passed. Backend build and
  22 affected regression tests passed; three new activity-classification tests
  also passed (25 executed backend tests total).
- Clean-shell candidate initial JS: 354.21 kB / 97.41 kB gzip. Dirty worktree:
  355.38 kB / 97.80 kB gzip. Neither produced a Vite 500 kB warning.
- Report generation now retains a session-only download link and an expandable
  preview of the actual JSON. Verified report type, generated timestamp and
  persisted Risk Refs in the preview. Workspace switches clear the prepared
  report and invalidate outstanding report requests. This is not report history.
- Automatic click, explicit link click and browser file-download action did not
  expose a download event or produce an observable new file in Downloads. User
  confirmation remains pending. Do not describe delivery as passed.
- Register Save view / clear / restore, High-plus-CIA empty state, page 2 and
  page-size reset passed. Saved-view controls did not leak into the next workspace.
- Overview workspace switching replaced default counts with enforced-scope counts.
- Added a separate disposable LOCAL TEST ONLY 3x3 fixture. Existing policies and
  historical records were not changed. Read-only fixture access was configured;
  the initial missing-role error was test setup, not bypassed in application code.
  Both matrix groups rendered nine cells; recorded scores were 9 / 4 / 1, with
  explicit target coordinates, one record in scope and zero foreign records.
  This is rendering evidence, not a production activation or approval test.
- Treatment, Intelligence lower panels, Operations Overview and Overdue layouts
  were checked at the required widths. Page width matched viewport width.
  Queue tables retain internal scrolling. Long internal issue IDs are visually
  truncated with full text retained in the DOM and title, not replaced by fake IDs.
- New treatment activity and immediate escalation rows display persisted Risk
  Refs. Browser testing found an existing action-label defect: editing notes on a
  completed plan emitted another completion event. Completion now requires a
  status transition; regression tests and a repeated local browser save verified
  the corrected `risk treatment updated` entry for RSK-0087.
- Console contains earlier local restart/session and fixture-role errors. The
  final corrected treatment save showed no new error. Existing React Router
  future-flag warnings are not claimed to have been removed.
- Global shell and unrelated dirty files remain untouched. No commit, push,
  Railway deployment, production migration or production activation occurred.

Latest regression checkpoint:
- 22 affected backend tests passed: methodology rules/PostgreSQL/repositories,
  evidence workspace guard, default KRI concurrency, treatment validation, and
  treatment-control links. No skips in these executed tests.
- Focused 42-file scan found zero trailing-whitespace lines and zero matches for
  the scanned AWS/GitHub/OpenAI/private-key secret patterns. This is a scoped
  pattern scan, not a guarantee against every possible secret format.
- Isolated clean-shell candidate production build passed: initial JS 354.21 kB,
  gzip 97.39 kB. The dirty worktree build is 355.38 kB; do not attribute unrelated
  shell changes to this redesign.
- Target comparison identified missing visible Operational Health grouping on
  Overview; added its heading and explanatory copy without inventing percentages.

- Frontend TypeScript/Vite build passed; initial JavaScript 355.38 kB in the
  working tree (which also contains pre-existing, unrelated shell changes).
- Nine methodology frontend tests passed, including dynamic matrix dimensions,
  target-coordinate truthfulness, historical scoping, and risk score profiles.
- Seventeen affected backend tests passed before the latest issue-reference and
  optional risk-detail metadata additions. Re-run after those additions.
- Scoped ESLint passed for the new workspaces, Overview, Register, Matrix, Issues,
  and operational queue components before the final metadata additions.
- Reference migration tested on disposable PostgreSQL only: stable backfill,
  repeat execution, immutable references, concurrent creation, and preservation
  of historical scoring/pinning/CIA/timestamps.

## Browser audit observations

Overview final-layout checkpoint: inspected the updated page at 1600x900 and
1366x768. Document width equalled viewport width. At laptop size the six KPI
cards formed two rows of three equal 321px columns. Operational Health grouping,
three action cards, real two-record watchlist (refs RSK-0004 and RSK-0087), and
explicit missing review dates were visible. The existing laptop rail disclosure
was preserved. Unlike the reference mockup, no unsupported donut percentages
were displayed and the watchlist keeps full width for readable references.

/issues?type=treatment displayed the explicit route-ready notice explaining that
the Issue Queue remains unfiltered. This is intentional and not a working
record-level treatment filter. Added keyed activity state per workspace to
prevent briefly displaying a previous workspace's entries during transitions.

All observations below used the isolated local candidate on port 4181, with
synthetic data and a separate local backend. They are not production evidence.

| Interface | Verified | Remaining |
| --- | --- | --- |
| Overview | Both sizes, 3x2 KPI grid, health heading, watchlist refs, methodology label | Workspace switch verified: default 86 open / 2 outside to enforced 3 open / 1 outside |
| Register | Both sizes, refs/category/score profile, keyboard close/focus restoration, query back navigation, accessible full detail/new-risk dialogs | High filter save/clear/restore and combined CIA empty state passed; pagination 1-10 to 11-20 and page-size reset passed |
| Intelligence | Both-size top layout, local near miss/loss/KRI/emerging persistence, repaired array insert | Lower panels checked at both sizes; pre-existing duplicate KRIs remain for controlled data review |
| Matrix | 4x4 legacy scope; populated 5x5 both sizes; explicit target/forecast separation; 3x3 unsaved config preview; unit tests all sizes | Actual isolated 3x3 matrix and explicit target rendered at both sizes; no production policy change |
| Treatment Plans | Saved local control role/note, pinned scores unchanged, Escape focus restore, refs/progress/forecast | Final desktop list and laptop selected-plan layouts checked |
| Reports | Both-size structure, Board selection, module navigation to treatments, honest unsupported exports/history | JSON preview and Risk Refs verified; actual download delivery remains unconfirmed |
| Operations Overview | Desktop no overflow, live domain/queue/focus/workflow/activity sections | Both-size final comparison completed; references visible in immediate queue and new activity |
| Issue Queue | RSK search and detail reference; Enter selection with solid focus; filtered laptop layout | Populated desktop and pagination to page 2 passed; long IDs now visually truncated |
| Escalations | Laptop and desktop structure; RSK-0088 visible; keyboard tab navigation | Final consolidated sign-off |
| Overdue Items | Search reduces to correct item; age totals and truthful blocker-unavailable state; drill-down works | Both-size populated layout and pagination to page 2 passed |
| Operations Reports | Desktop/laptop three aligned summaries and full-width readiness section; no overflow; export disabled | Final consolidated sign-off |

Console inspection so far found existing React Router v7 future-flag warnings.
No application error was observed in that sampled log review; a final error-only
check remains required.

## Audit-driven corrections

### Methodology and query-state audit

- Refined configuration hero, axis field layout, rating labels, and unique
  accessible names. Removed nested main and the misleading vnull status.
- Saved local 4x4 policy validates and previews 16 cells without activation.
- Unsaved test-only 3x3 configuration (bands 1-2/3-4/5-6/7-9) validates and
  previews nine cells. No draft save or activation was performed.
- Activation button remained disabled. No page horizontal overflow was measured
  at 1600 or 1366 widths. Final screenshots at stable paint remain to be recorded.
- /risks?status=open displayed 86 of 87 local records with the correct chip;
  /risks?appetite=outside displayed two records with the Outside appetite chip.
  Browser Back restored the open filter and 86-record result.
- Added the explicitly required Category table column rather than relying on
  title subtext alone.
- Build and scoped methodology/Register lint passed before the final Category
  column addition; rerun as part of final validation.

### Treatment and report interaction audit

- Saved a control link on the disposable treatment through the real browser form.
  Reopened the selected plan and confirmed the control ID/title, Detective role,
  implementation note, and unchanged expected residual of 4.
- Reopened the editor: current residual remained 20, inherent 25, target Not set,
  pinned Enterprise Risk Matrix v2. Treatment edits did not rescore the risk.
- Added opt-in accessible dialog semantics/focus handling to the shared modal,
  enabled for the treatment editor. Added Risk Ref to linked-risk heading.
- Found autofocus interfering with focus restoration; removed that competing
  autofocus. Re-test confirmed Escape closes the editor and focus returns to
  the Edit Treatment / Link Controls button.
- Removed nested main landmark from the Register page.
- Report generation returned success feedback but the in-app download event was
  not observed. Corrected immediate blob revocation and misleading downloaded
  wording; re-test still did not produce a captured download event in 15 seconds.
  Actual browser file delivery remains UNVERIFIED, not a passed export check.

### Additional Intelligence audit

- Removed silent four/six-record truncation; all records remain accessible through
  scrollable lists and the forecast data disclosure.
- Successfully submitted a synthetic near miss through the local browser and
  confirmed the exact entered description appeared after refresh.
- Found pre-existing repeated KRI seeding with random IDs on each read. Default
  KRI inserts now check existing names and use workspace-specific deterministic
  IDs for concurrent safety. Existing definitions are never overwritten/deleted.
- Removed automatic example emerging-risk creation from read-time seeding.
  Existing records are preserved; historical example/duplicate cleanup is not
  performed implicitly and requires a separately reviewed data-cleanup plan.
- New disposable PostgreSQL test passes for repeated/concurrent default KRI
  seeding, preservation of existing values, and workspace isolation.
- Backend rebuilt and isolated candidate restarted on port 3311; local login
  renewed. No production backend was contacted.

- Removed automatic empty selected-risk panel.
- Replaced fake Intelligence quick-create values with explicit input forms.
- Removed the alternate hardcoded matrix path.
- Added persisted reference migration and mapped references into key views.
- Kept target and expected residual outcomes distinct from current residual.
- Tightened summary card padding and Register subtitle weight.
- Added methodology-aware score-chip colour with text labels.
- Tightened the matrix scope notice and removed nested main landmarks from
  Matrix and Operations.
- Added persisted risk references to derived issue response types and queue UI;
  candidate backend restart and browser recheck are still pending.
- Added optional business-unit/last-updated metadata to selected risk details.

## Intentional deviations from mockups

### Continued functional audit, 24 September

- Loss Event and manual KRI forms saved explicitly synthetic inputs through the
  authenticated local in-app browser; refreshed records were visible.
- Emerging Risk initially failed with a PostgreSQL text/text[] mismatch. Added
  an explicit text[] cast to the insert, tested populated/empty trigger arrays
  and workspace isolation, rebuilt the local backend and repeated the browser
  submission successfully. The failed request is a known pre-fix console error.
- Issue Queue now uses a native button for row selection, with pressed state.
  Enter selection and a solid keyboard focus outline were confirmed at 1366x768.
  Searching RSK-0004 returned one row and matching reference in Issue Detail.
- Arrow-key navigation selected Escalations and Overdue Items; End selected
  Reports. Source/priority/status summaries rendered and unsupported export
  remained disabled.
- Scoped focus rules override the shared Button's inline outline reset. Risk
  creation/editing now opts into accessible dialog semantics. Full risk details
  use the same accessible modal and score profile as the selected panel.
- Full details showed pinned 5x5 v1 scores 25 / 16 / 2 with 36% reduction. Escape
  closed the dialog and restored focus to View full details. Treatment forecasts
  and linked-control labels were added to this formerly inconsistent surface.
- Overview and Operations reset their component state on workspace changes;
  operational activity is also keyed to workspace. Removed Overview's nested
  main landmark. No global shell layout was changed.
- Report module source navigation opened Treatment Plans. Board report selection
  changed report type/audience correctly. Actual JSON download delivery remains
  unverified; user confirmation was requested, not assumed.
- Intelligence desktop and laptop screenshots and DOM measurements showed no
  horizontal page overflow. Existing duplicate KRI records remain visible and
  require controlled cleanup rather than silent deletion.
- Switched the matrix from default 4x4/legacy scope to the enforced disposable
  5x5 workspace: three records, 25 cells per matrix, and no foreign-scope records.
  Desktop width was 1600/1600. Laptop target view plotted only one explicit target
  and disclosed two missing targets. Forecast view showed RSK-0088's expected
  residual of 4 separately from current residual data.
- New treatment activity titles include the linked persisted Risk Ref when
  available. This latest activity-label adjustment still needs a browser recheck
  after rebuilding/restarting the disposable candidate backend.
- Latest backend suite: 22 passed, zero skipped. Frontend build and full ESLint
  passed before the final full-detail control section and landmark adjustment;
  rerun final validation. Nine methodology tests and one session-isolation test
  passed. Initial worktree JS: 355.38 kB, no 500 kB warning.
- Scoped diff/known secret-pattern scan passed. Whole-worktree whitespace check
  reports a pre-existing unrelated EnterpriseOperatingSystem.tsx EOF blank line;
  that file was deliberately not modified.

### Migration and release sequencing (not permission to deploy)

The persisted reference migration is registered by migrate-risk and must run
before the corresponding API/UI release. It backfills references without
changing historical score/pinning columns, creates an immutable unique reference
for future records, and is idempotent in the disposable PostgreSQL tests. Review
the sequence/trigger permissions and rehearse against a backup before any future
approved release. No production migration, policy activation, push or deployment
was performed in this task.

- Mockup metrics, trends, treatment plans and activity are not copied as data.
- Word/PPT, evidence attachment and persisted report-history features remain
  explicitly unavailable instead of simulated. PDF, CSV and JSON exports were
  subsequently implemented; browser download receipt remains unverified.
- Global shell widths and its existing laptop Personalized Home disclosure are
  preserved, so main-content proportions differ from the mockup shell.
- Unversioned/historically pinned risks are not forced into the active matrix.
- Scalar forecasts are not reverse-engineered into likelihood/impact cells.

## Release blockers

Complete every remaining audit above, run final builds/tests/scoped lint,
whitespace and secret checks, document the new migration, and review all focused
diffs. Do not treat this checkpoint as sign-off or deployment approval.

### 25 September continuation

#### Consolidated automated regression checkpoint

#### Local Operations follow-up

- Added the target's status filter and rows-per-page control to the shared
  Escalations/Overdue queue, preserving the parent queue membership rules.
  Every filter and page-size change resets pagination; Clear filters includes
  status. Labels are exposed on native select controls.
- Local in-app verification at 1366x768: Escalations at five rows produced
  53 pages for 265 records, Next reached page 2, Resolved yielded page 1/1 with
  an explicit empty state, and Clear filters restored page 1/53. Overdue Items
  changed from 28 pages at ten rows to 11 pages at 25 rows for 274 records.
  In Progress yielded an explicit empty result. Document width stayed 1366px.
- TypeScript and scoped ESLint passed after the queue-control changes.

- Compared the supplied ZIP's `07_risk_operations_escalations.png` with the
  current page. The source-only list did not provide the target's interactive
  Escalation Mix. Added a live-data distribution ring and text legend with
  priority/source/owner grouping controls. Owner is used instead of Office
  because the issue model provides an owner, not a separate office field.
- Keyboard Enter selected source and owner breakdowns in the local browser.
  Counts reconciled to 265: priority 252 High + 13 Critical; source 221 Evidence
  + 44 Risk. Owner breakdown contained 15 owners. Non-zero shares below 1% are
  labelled <1%, not 0%. No mockup trend/SLA numbers were introduced.
- Desktop rendering was inspected at 1600x900; laptop document width remained
  1366px at a 1366px viewport. Full target fidelity remains open: the available
  shell content width requires more wrapping than the supplied target.

- Rechecked Escalations in the authenticated disposable in-app browser at
  1366x768. Searching RSK-0004 and pressing Enter on the matching issue opened
  Issue Queue with the same reference and selected issue detail.
- Found that the drill-down exposed an internal issue identifier in search.
  Overview/Escalations/Overdue drill-down handlers now prefer the persisted
  linked Risk Ref for visible search, retaining the issue ID for selection and
  as a fallback when no Risk Ref exists. Browser recheck showed RSK-0004 in
  search and aria-pressed=true on the matching issue button.
- Operations Reports rendered source, priority and status summaries at
  1366x768 and 1600x900. Document scroll width matched each viewport width.
  Unsupported issue-report export remained disabled with an explanation.
  Personalized Home was collapsible at laptop width and visible at desktop.
- These checks are current runtime evidence, not full ZIP-target visual
  sign-off. Escalations pagination, desktop selected state and final target
  comparison remain to be consolidated. Production was not accessed.

#### Automated results

- Re-ran the eleven focused backend test files against the disposable local
  `laflo_release_test` PostgreSQL database: 35 passed, zero failed or skipped.
  Coverage includes methodology rules/migrations/repositories, tenant guards,
  default KRI uniqueness, treatment validation/control links/activity, committee
  report generation, export formats and mocked email delivery. Expected rejected
  database writes logged errors during negative tests; the suite passed.
- Backend TypeScript build passed. Frontend `tsc -b` and Vite production build,
  full ESLint, and both frontend test files passed (10 tests, zero skipped).
- Worktree initial JavaScript is 355.27 kB (gzip 97.77 kB), without a Vite size
  warning. This build includes existing unrelated worktree edits and is not a
  clean release-candidate sign-off.
- This checkpoint does not prove the remaining consolidated visual audit,
  browser download receipt, live SMTP delivery, or final scoped release review.
  Earlier audit entries below are historical observations, not current blockers
  where explicitly superseded by this checkpoint or the report delivery notes.
- No push, deployment, production migration or production mutation performed.

- Re-read the original brief and checked the Matrix and Treatment requirements.
- Added an expandable scoring guide using the loaded methodology appetite,
  treatment and escalation thresholds. Browser check on the local 4x4 scope
  showed thresholds 8 / 9 / 13, not hardcoded production 5x5 values.
- Treatment filter labels now use readable text while keeping stored option
  values unchanged.
- Frontend build, full ESLint and ten frontend tests passed after these changes.
  Worktree initial JS remains 355.38 kB. Scoped diff check passed.
- Renewed the expired disposable session and generated a fresh report. The
  prepared-report section appeared. Explicit Download click again produced no
  observable new report in Downloads. Delivery remains unverified, not passed.
- Asked the user whether the embedded browser saves the file or shows a prompt.
  Further download diagnosis needs that observation or access to a supported
  download-capable browser. No production changes or deployment performed.

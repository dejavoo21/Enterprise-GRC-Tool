# Risk Management design evidence index

Local acceptance index, not completion or deployment approval. The execution
ledger is authoritative for what each capture/test actually covered. Existing
captures listed here are from this ongoing local goal; this index does not
re-certify unseen states or claim pixel equality with target images.

## Findings still requiring closure

1. Browser-to-local-SMTP PDF delivery is now verified as one chain; see
   current-acceptance.md for receiver, attachment and UI evidence. External
   inbox delivery remains outside this local audit.
2. Final comparison sign-off must cover all11 interfaces, not only the updated
   Overview and Reports captures. Screenshots alone do not prove all controls.
3. Final24-section report must disclose unsupported governance/history/evidence
   sources rather than copy mockup values or claim nonexistent workflows.

## Evidence by interface

| Interface | Capture pair under screenshots/ | Behavior evidence in acceptance-ledger.md |
| --- | --- | --- |
| Overview | overview-final-1600.png / overview-final-1366.png | Six KPI routes, source failure/recovery, methodology status, watchlist references |
| Register | register-target-1600.png / register-target-1366.png | Query/history, selected profile, treatment read Retry, strict delayed workspace response |
| Intelligence | intelligence-controls-1600.png / intelligence-controls-1366.png | Category/status filter, empty/reset, KRI pagination and source disclosure |
| Matrix / Methodology | matrix-3x3-1600.png / matrix-3x3-1366.png; matrix-5x5 pairs | Coordinates/version scope, target exclusion, scalar forecast separation, strict delayed workspace response, controlled draft preview |
| Treatments | treatment-dense-1600.png / treatment-dense-1366.png | Saved progress/completion, unchanged residual, selection continuity, pagination, linked controls |
| Committee Reports | reports-final-readiness-1600.png / reports-final-readiness-1366.png | Draft readiness, export tests, consent resets, preview/sign-off; delivery gap above |
| Operations Overview | operations-overview-bounded-1600.png / operations-overview-bounded-1366.png | Real source distribution, bounded escalation queue, recorded activity |
| Issue Queue | issue-queue-compact-1600.png / issue-queue-compact-1366.png | Owner/sort/page size, linked detail, empty queue, service Retry |
| Escalations | escalations-lower-1600.png / escalations-lower-1366.png | Grouping/filter recovery, keyboard tabs and scrolling |
| Overdue | overdue-current-1600.png / overdue-current-1366.png | Age boundary tests, source actions, empty state, unavailable blocker explanation |
| Operations Reports | operations-reports-final-1600.png / operations-reports-final-1366.png | Reconciled source/priority/status totals, honest disabled export |

## Target interpretation

- ZIP02 filename says register but displays Risk Intelligence. Use the actual
  Register reference (extra-3.png), not ZIP02, for the table/detail split.
- Keep actual scoped values. Target metrics, trends and events are illustrative.
- Separate inherent/current/target chips follow the later written requirement.
- Unknown target/evidence/approval/history values remain explicitly unavailable.
- Global shell is preserved. Personalized Home becomes a disclosure at laptop
  width; this is an existing shell behavior, not a Risk module redesign.
- No dedicated ZIP view was identified for Overdue or Operations Reports; their
  written requirements and shared visual system are the comparison basis.

## Review sequence

1. Compare each named capture with its actual target at equivalent state/scale.
2. Confirm visible differences are either corrected or justified by real data,
   accessibility, methodology safeguards or the explicit no-shell-change rule.
3. Check the remaining lower-page/keyboard states, not only the first viewport.
4. Verify browser-to-mail delivery with a loopback-only receiver and synthetic
   recipient. Do not enable external delivery or change production settings.
5. Perform final build/hygiene checks and produce the 24-section result.

## Overview reconciliation checkpoint

Fresh local captures: screenshots/overview-reconciled-1600.png and
screenshots/overview-reconciled-1366.png. Both were captured and visually
inspected after recovering the stopped disposable application environment.
DOM viewport measurements confirmed 1600x900 and 1366x768 respectively,
with no document-level horizontal overflow. The four-signal strip and six
KPIs remain readable in a three-column, two-row grid.

Compared directly with the supplied overview.png target: the compact hero,
blue/white palette, icon treatment and KPI grouping follow the target. The
current hero is approximately 230 CSS pixels high at desktop, and Operational
Health adds a section heading. This is not a claim of pixel equivalence.
The written brief explicitly requires methodology status, Operational Health
(Review / Evidence Health, Treatment Flow, Operating Status), and a watchlist;
those requirements take precedence over the target's illustrative Risk Areas
card and unsupported health percentage. Current values remain local data.
The unchanged shell uses a Personalized Home disclosure at laptop width.
Lower-page keyboard checkpoint: Tab from Open Operations reaches the named
Priority risks scroll region, then its first risk link. Both display a visible
blue focus outline. Enter on RSK-0004 navigated to /risks?riskRef=RSK-0004,
where the register rendered exactly that one risk. The accepted capture
screenshots/overview-watchlist-focus-1366.png shows all watchlist headers and
both lower action cards without document-level horizontal overflow. This
proves reference filtering, not automatic opening of a selected-risk panel.

## Register selected-profile checkpoint

Selecting the filtered risk opens the named Selected risk detail panel with
owner, CIA, appetite, lifecycle, treatment plans and the separate Risk Score
Profile. Legacy methodology absence and missing target are explicitly labelled.
The desktop capture exposed a presentation defect: missing-target text wrapped
at numeric-score size and score baselines differed. RiskScoreProfile now uses
compact nonwrapping missing-value typography and a shared two-line label height.
No scoring or data rules changed. TypeScript, focused ESLint and all 10
methodology/profile tests passed after the fix. At 1366x768, Tab from Record
Treatment reaches Open Treatment Plans with a visible outline and no document
horizontal overflow. Full Register target reconciliation remains open.

## Intelligence category-filter checkpoint

The live local DOM exposed two visually identical Operational options backed by
Operational and operational. Filter choices now trim and lowercase category
keys, and KRI matching uses the same normalization. Stored records and risk
scoring are unchanged. Browser verification found exactly one Operational
option; selecting it included the manual Disposable audit KRI and automated
Training Completion records together. TypeScript, focused ESLint and scoped
whitespace checks passed. Final production build must be repeated after this
source edit. Full Intelligence target reconciliation remains open.

## Intelligence visual reconciliation checkpoint

Compared the supplied register.png (which depicts Intelligence) directly with
fresh intelligence-reconciled-1600.png and intelligence-reconciled-1366.png.
The page preserves the compact hero/tab/summary/two-column narrative-and-chart
hierarchy. It deliberately does not fabricate the target's month-on-month
percentages, sparkline histories or category forecast series. The current
single modelled series is labelled as an intelligence index rather than a
methodology score. Main content has no horizontal document overflow at laptop
width. Lower-section visual reconciliation is still required.

The comparison revealed a misleading retained risk-reference chip above
workspace-wide Intelligence metrics. Non-register tabs now explicitly label
retained reference/status/appetite filters as Register only. Query state remains
available on return to Register; no filtering or scoring behavior changed.
Browser verification confirmed the new label. Post-fix production build,
TypeScript, full frontend ESLint and 13 reference/methodology tests passed.
Initial JavaScript: 354.33 kB; lazy Risks: 100.08 kB. No size warning.

## Intelligence lower-section checkpoint

Fresh laptop captures intelligence-lower-reconciled-1366.png and
intelligence-lower-compact-1366.png were inspected. KRI status pills had stretched
like progress bars; scoped CSS now keeps them compact. Capacity names and
percentages share a row above their real progress bars, improving scan density.
The source-count disclosure opens with Enter and has visible focus. Record
Loss Event opens with Enter; Tab reaches labelled eventType with a visible
outline. No form was submitted. Document horizontal overflow remained false.
This verifies these lower controls, not screen-reader certification or every
recording form. CSS changes preserve data and bounded scrolling.

## Treatment selected-panel checkpoint

The local application was re-opened in a fresh in-app browser tab after the old
audit tab became unavailable. Existing frontend, backend and PostgreSQL listeners
were verified live; no services or database were reset.
Selecting Disposable treatment exposes the selected-plan panel and its Overview,
Controls and Evidence sections. Overview reports expected residual 4 / Low on
the linked risk's pinned Enterprise Risk Matrix version 2 and explicitly states
that completion does not replace the current residual assessment. Controls shows
the existing single linked control and recorded link rationale. Evidence states
that no summary is recorded and file linking is unavailable; it does not claim a
verified attachment. No browser console errors were captured in these checks.
No records were changed. This is functional panel evidence only; target-image
comparison and both required viewport captures remain open for this checkpoint.

## Treatment target and progress styling checkpoint

Compared treatments.png with fresh selected-plan captures at 1600x900 and
1366x768. The table/detail split, selection highlight, filters, progress and
plan sections are present. The laptop document has no horizontal overflow;
additional table columns remain accessible through internal scrolling. The
existing shell collapses Personalized Home to its disclosure at laptop width.
No shell changes were made. Screenshot evidence: treatment-selected-reconciled-
1600.png, treatment-selected-reconciled-1366.png and treatment-progress-polished-
1366.png (filenames have no line breaks).

Rounded progress tracks replace thin browser-default rendering, scoped only to
Treatment Plans. Values and native accessible progress semantics are unchanged.
Two treatment sorting/pagination tests and scoped whitespace checks passed.
The target's sample trend percentages, evidence counts and approval/activity
content are not fabricated. This checkpoint does not certify the entire module.

## Operations keyboard and CIA linkage checkpoint

Escalations: Tab reaches By source with a visible blue focus outline; Enter
changes the mix to Evidence 221 / Risk 44 (265 total). Saved and inspected
escalations-source-keyboard-1366.png; document horizontal overflow is false.
Keyboard activation of RSK-0004 opens Issue Queue filtered to that reference
with its selected detail. No mutation is performed by this action.

This exposed a real defect: issuesRepo discarded existing risk CIA impacts.
The derived risk issue mapper now preserves valid canonical CIA classifications,
removes duplicates and leaves absent data empty. A focused regression test and
backend TypeScript build pass. A read-only call against disposable rehearsal
PostgreSQL returned Confidentiality, Integrity and Availability for RSK-0004.
The running backend still needs to load the rebuilt code before the corrected
browser detail can be re-verified. No production data or scoring changed.
Scoped release manifest now includes riskIssueCia.test.ts (76 files).

## CIA linkage browser re-verification

Reloaded the compiled backend on local port 3311 with the same disposable
rehearsal database, mail disabled and review scheduling disabled. Signed in
normally with the synthetic local account. Opening RSK-0004 from Operations
now shows Confidentiality, Integrity, Availability in Issue Detail. Inspected
and saved issue-cia-preserved-1366.png. Document horizontal overflow is false.
This closes the preceding CIA defect browser check. No production changes.

## Report readiness keyboard checkpoint

At 1366x768, Tab from Download PDF skips unavailable email controls and reaches
Committee review readiness with a visible focus outline. Enter expands its
sign-off, distribution and scheduling limitations. Captured and inspected
report-readiness-keyboard-1366.png. CSV format selection changes the enabled
primary action to Download CSV; email remains disabled when delivery is off.
Document horizontal overflow is false. No report was generated or emailed in
this checkpoint. Historical periods, scheduling, formal approval and persisted
report history remain explicitly unavailable, not represented as implemented.

## Matrix view keyboard checkpoint

At 1600x900 Tab reaches Future Target Risk with a visible outline; Enter selects
current-residual/target comparison. Captured and inspected matrix-target-focus-
1600.png. The active disposable 4x4 version has zero matching records, explicitly
excludes 87 differently scoped records and displays 16 empty cells per matrix.
Axes and four legend bands match that test methodology. Tab/Enter then opens
Forecast View, which shows its separate treatment-outcome table and honest empty
state. No historical records were rescored or borrowed from other versions.

## Consolidated post-CIA validation

Current isolated candidate: all 24 focused frontend tests and full frontend
ESLint passed. All 38 backend tests passed against disposable PostgreSQL with
zero skips, including methodology boundaries, version pinning, tenant guards,
treatment/control validation, report exports, loopback SMTP and CIA mapping.
Database rejection logs are expected assertions for invalid methodology writes,
not failed tests. Scoped whitespace and targeted private-key/GitHub/AWS secret
patterns passed over the 76-file manifest. These checks do not substitute for
remaining final design reconciliation or constitute deployment approval.

## Operations Overview target density correction

Compared ZIP 04_risk_operations_overview.png with the current 1600x900 page.
The summary row was unnecessarily tall because 42px icons squeezed descriptive
text. Scoped Operations KPI icons are now 32px with tighter padding/gaps. Data,
click handlers, shell and other cards are unchanged. Inspected saved
operations-overview-compact-1600.png and operations-overview-compact-1366.png;
labels remain readable and laptop document overflow is false. Original before
capture is operations-overview-reconciled-1600.png. Remaining lower-section
comparison is not certified by these first-screen captures.

## Operations lower-section density fix

The lower target comparison exposed Workflow Health stretching to the entire
height of the activity list, leaving a large blank card. The lower grid now
aligns cards at their natural height. Activity entries use a named, focusable
240px scroll region; all five records remain available. Inspected
operations-lower-contained-1600.png against before capture
operations-lower-reconciled-1600.png. Tab reaches the activity region with a
visible outline and End scrolls its content. Laptop recheck remains pending for
this latest lower-section change; no record or source workflow changed.

## Operations lower-section and ledger acceptance follow-up

The laptop check is now closed by the inspected
operations-lower-contained-1366.png capture: Workflow Health retains its natural
height, the activity region has a visible keyboard focus outline, and the page
has no horizontal document overflow. This supersedes the pending laptop note
above. Keyboard Enter on View activity ledger navigated to /activity-log.
The destination was subsequently verified to render Enterprise Activity Ledger,
its Activity Table, and actual disposable report-email and treatment-update
events. This verifies a loaded destination, not merely a URL change. No records
were changed and no production service was accessed by this check.

## Register and Reports final target comparison checkpoint

Compared supplied extra-3.png (Register) and extra-1.png (Reports) with freshly
captured register-target-final-1600/1366.png and reports-target-final-1600/1366.png.
Register preserves the hero, six metrics, filters, score columns and internal
wide-table scrolling. Its larger text and unchanged shell mean fewer rows are
visible than the mockup; no laptop document overflow was observed. Missing target
scores correctly remain Not set, not the illustrative mockup numbers.

Reports preserves summary, controls, committee/board split, modules and history
structure. Mockup trends, readiness percentage and historical reporting are not
fabricated. Export scope prose now uses a native disclosure to reduce toolbar
height without removing limitations. Tab from Download PDF focuses the disclosure;
Enter opens its text and Enter closes it. Focus outline inspected in
reports-compact-scope-1366.png and reports-compact-scope-1600.png. Email consent,
mail availability, current snapshot and Draft status remain visible. Console error
query returned no errors. Production build/TypeScript passed: initial JS 354.33 kB,
lazy Risks 100.19 kB. Scoped whitespace check passed. Generated-pack preview
comparison and full final requirements reconciliation remain separate gates.

## Generated committee-pack preview acceptance

Generated a PDF through the local authenticated Reports UI on the disposable
workspace; the prepared-report link and structured preview appeared. Expanded
sections using Enter. Verified the preview's organisation, timestamp, prepared-by,
classification, template version and Draft - not approved label. Top risks contain
reference, owner, all three risk scores, appetite, treatment/review status,
intelligence index and action fields. Missing targets remain Not set. Score
movement explicitly separates expected treatment residual from actual residual
and retains legacy/unversioned or pinned version labels.

Treatment progress includes all 12 disposable plans, owners, strategies, due dates,
status, progress, linked-control counts, explicit unavailable evidence counts,
overdue and approval fields. Committee decisions show no recorded decisions,
not invented approvals. Sign-off lists unrecorded reviewer, approver and date.
Capacity includes usage, limit, percentage, status, unavailable trend and action.
The empty overdue section explicitly warns that evidence/escalation sources are
unavailable rather than claiming zero overdue evidence.

Inspected report-preview-treatment-1366.png and report-preview-treatment-1600.png.
The named table region has a visible focus outline and internal scrollbars.
Keyboard End moved scrollTop to 504 in a 1005px scrollHeight/500px clientHeight
region. Laptop document overflow was false. These captures verify wide-table
containment, not pixel-equivalence of the exported PDF. PDF artifact validation
remains covered by the previously recorded export/SMTP artifact checks. No email
was sent in this check; only disposable local report generation was invoked.

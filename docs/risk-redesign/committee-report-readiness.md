# Risk Committee Report - review preparation

Implemented locally. Not committed, pushed or deployed. No external email sent.

## Structure

Template 2.0 includes organisation/workspace, authenticated preparer, generation timestamp, current-snapshot period, confidentiality and an explicit Draft - not approved status. Sections cover executive interpretation, committee decisions, appetite, top risks, score movement, dedicated treatment plans, overdue reviews/actions, forecast intelligence, emerging risks, capacity, KRIs, sign-off and three appendices.

Top risks retain the existing intelligence-priority ordering. Their formal inherent/current residual/target scores and recorded ratings occupy separate columns from the intelligence index. Missing targets remain Not set. Historical methodology versions are preserved; generating a report does not re-score risks.

Forecasts show the ten highest 90-day intelligence indices. KRIs show twenty priority records (red, amber, green) with complete status counts and explicit scope limits. The full risk register, capacity extract and methodology metadata remain in appendices.

## Files inspected

- backend/src/types/riskIntelligence.ts
- backend/src/types/riskTreatment.ts
- backend/src/types/treatmentControl.ts
- backend/src/services/riskIntelligenceService.ts
- backend/src/services/riskMethodologyRules.ts
- backend/src/services/riskReportExport.ts
- backend/src/repositories/riskTreatmentRepo.ts
- backend/src/routes/riskIntelligence.ts
- frontend/src/types/riskIntelligence.ts
- frontend/src/pages/RiskReportsWorkspace.tsx
- frontend/src/pages/RiskDecisionWorkspace.css

## Files changed in this pass

- backend/src/types/riskIntelligence.ts
- backend/src/services/riskIntelligenceService.ts
- backend/src/services/riskCommitteeReport.ts (new)
- backend/src/services/riskReportExport.ts
- backend/src/routes/riskIntelligence.ts
- backend/src/tests/riskCommitteeReport.test.ts (new)
- frontend/src/types/riskIntelligence.ts
- frontend/src/pages/RiskReportsWorkspace.tsx
- frontend/src/pages/RiskReportPreview.tsx (new)
- frontend/src/pages/RiskDecisionWorkspace.css
- docs/risk-redesign/report-delivery.md
- docs/risk-redesign/committee-report-readiness.md (new)

## Export and preview

PDF uses landscape tables with keyed column groups, repeated table headers, continuation labels and draft/confidential page footers. JSON preserves structured rows. CSV is a long-form section/record/field/value extract, including metadata and appendices. The legacy GET report endpoint is explicitly JSON-only; PDF/CSV use the existing delivery endpoint. Word and PowerPoint remain unimplemented.

The in-app preview uses native keyboard-operable disclosures, captioned tables, column headers, focus outlines and internally scrollable table regions. Report readiness, scheduling and distribution limitations are visible.

## Validation

- Backend TypeScript build; frontend TypeScript/Vite build; frontend ESLint passed.
- Ten report/export/email tests and ten existing methodology/session tests passed.
- Synthetic PDF rendered and visually reviewed. A full disposable 87-risk pack was also rendered; text-bound checks found no text outside page margins.
- Local authenticated in-app PDF/JSON generation and preview verified. Preview keyboard expansion and table focus verified.
- No horizontal page overflow at 1366x768 or 1600x900 with the wide risk table expanded; the table scrolls internally.
- Browser logs contain expected expired-token failures during test-server secret rotation. No new report errors were observed after reauthentication.
- Scoped diff/whitespace and targeted secret-pattern checks passed.
- Initial frontend JS remains 355.27 kB, below Vite's 500 kB threshold.

## Remaining governance and data gaps

- No committee decision register or formal report approval/signature workflow is connected. Pending treatment approvals are not fabricated as committee decisions. Report status cannot be promoted to Pending review or Approved by this implementation.
- Evidence linkage counts, overdue evidence accountability, escalation decision status, KRI linkage/trend and historical appetite/capacity trends are unavailable from the connected sources, and are labeled accordingly.
- Current snapshot only; no period-based history, persisted report archive or scheduler.
- SMTP/provider delivery and actual inbox receipt remain unverified. Download-to-disk completion is not observable through the embedded browser tooling; generated files and prepared links were validated separately.
- Full-register appendices can make large packs lengthy. Unicode font coverage and formal PDF accessibility tagging require a separate multilingual/accessibility pass.
- No shell, scoring policy, risk record, backend schema or production configuration was changed.

## Recommended next step

Review the draft pack with the Risk Committee owner, then define a persisted review/sign-off and report-version workflow before representing any report as approved.

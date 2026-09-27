# Risk Overview and Register V2 Design QA

Date: 27 September 2026

## Source targets

- `01_risk_management_overview.png`
- `ChatGPT Image Sep 24, 2026, 03_27_27 PM (1).png`
- `ChatGPT Image Sep 24, 2026, 03_52_57 PM.png`

## Current-run browser evidence

Authenticated local production build at `http://127.0.0.1:4184`, reading the
existing Sochrist Ventures workspace without writing production data.

### Overview

- 1600x900: 3x2 KPI layout, 308px equal columns, no document overflow.
- 1366x768: 3x2 KPI layout, 320.8px equal columns, no document overflow.
- Compact hero includes live posture, alerts, monitoring, operating status and
  methodology mode/version.
- Operational Health avoids unsupported percentage charts.
- Top Priorities uses persisted Risk Ref IDs and pinned score labels.
- Register, Assessments, Operations and Reports are reachable from main content.

### Register

- Initial state has no selected-risk panel or empty placeholder.
- Table exposes Risk Ref ID, category, owner, CIA, inherent risk, current
  residual risk, target risk, rating, appetite, lifecycle, treatment and review.
- Selected state uses a contained table/detail split without document overflow.
- Selected risk exposes persisted Risk Ref ID, methodology/version disclosure,
  score profile, context, review, treatment, controls and truthful evidence state.
- Link Control routes through treatment; Link Evidence is disabled and labelled
  Coming soon.
- Closing the panel restores focus to the selected row control.

### Functional checks

- `/risks?status=open`: filter applied and persisted through browser Back.
- `/risks?appetite=outside`: filter applied and persisted through Forward.
- `/risks?tab=treatment-plans`: Treatment Plans selected with live records.
- Treatment editor opened and closed without saving or mutating data.
- Console errors/warnings: none.

## Intentional deviations

- The Overview does not reproduce mockup donut percentages because the loaded
  sources do not provide defensible health percentages.
- Evidence links remain explicitly unavailable rather than fabricated.
- The enterprise register retains bounded internal horizontal table scrolling so
  the complete data model remains readable inside the existing global shell.

## Result

Final result: passed.

No P0, P1 or P2 design issues remain in the requested scope. The global shell
and Personalized Home responsive behavior were intentionally preserved.

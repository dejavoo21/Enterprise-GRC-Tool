# LAFLO UI/UX Standard

**Status:** Mandatory for new and materially changed frontend work
**Visual baseline:** Approved Risk Intelligence and Risk Operations redesigns
**Default direction:** Light enterprise SaaS, information-dense without clutter

## 1. Completion Model

A module is not fully complete merely because it compiles or its backend works. Track these states separately:

1. **Implemented:** required code paths exist.
2. **Offline validated:** TypeScript/build, ESLint, focused tests, whitespace and relevant security checks pass.
3. **Visually verified:** authorised browser rendering has been checked at the required viewports with no material design, accessibility or overflow defect.
4. **Runtime verified:** authenticated workflows, persistence, RBAC and integrations have been exercised against an authorised runtime.
5. **Production accepted:** the exact deployed candidate has stakeholder acceptance evidence.

Never infer a later state from an earlier one. Static source inspection is not visual verification.

## 2. Visual Language

- Use the existing light theme as the primary enterprise presentation.
- Use `--color-primary` and related blue/indigo tokens for selected navigation and primary actions.
- Use white or tokenised surface cards, subtle borders, restrained shadows and consistent rounded corners.
- Prefer compact icon-led KPI cards with a label, value and one short explanatory line.
- Keep page titles, section headings, body copy and metadata visually distinct.
- Use semantic success, warning, danger and information tokens consistently; badges must include text and never rely on colour alone.
- Preserve the accepted Risk dashboards. Do not redesign them without a confirmed defect and scoped approval.

Avoid decorative gradients, oversized empty panels, arbitrary colours, inconsistent card heights, raw spreadsheet presentation, excessive whitespace and visual controls without behaviour.

## 3. Existing Foundations

Reuse and improve these foundations before introducing alternatives:

- Tokens and global focus/motion rules: `frontend/src/index.css` and `frontend/src/theme.ts`.
- Page composition: `PageHeader`, `PageToolbar`, `SummaryMetricStrip`, `PageSectionCard`, `DataTableShell`, `ActivityFeed`, `EmptyStatePanel`.
- Primitives: `Button`, `Card`, `Badge`, `Modal`, `DataTable` and shared icons.
- Established module patterns: selection-led detail panels, compact tab navigation, responsive metric grids and internally scrollable tables.

Hard-coded colours, spacing and shadows in module CSS should be replaced with existing tokens when that module is modernised. Do not perform unrelated mass restyling.

## 4. Layout And Hierarchy

Each operational page should use this order where applicable:

1. Breadcrumb and compact page header with one clear primary action.
2. Module navigation or tabs with an unambiguous active state.
3. KPI/summary strip containing actionable, truthful measures.
4. Search and filter toolbar with a visible reset path.
5. Primary table, dashboard or work queue.
6. Selection-led detail drawer/panel that is absent until a record is selected.
7. Related records, approval history, activity and audit context.

Keep desktop layouts dense enough for enterprise work. Constrain page-level width correctly, allow tables to scroll internally when necessary, and avoid nested vertical scroll regions unless the region has a clear operational purpose.

## 5. Components And Interaction

- **Headers and breadcrumbs:** identify module and page purpose; primary action uses a specific verb.
- **KPI cards:** must filter, navigate or explain their scope when interactive. Do not use fake links.
- **Filters:** labels remain accessible; state is visible; clear/reset restores the documented default.
- **Tables:** semantic headers, keyboard-reachable row actions, meaningful empty/error states, real pagination only when implemented.
- **Detail panels:** open after selection, provide a close action, preserve context, and expose only authorised actions.
- **Forms:** use visible labels, required indicators, inline validation, safe defaults, submit progress, error recovery and cancel.
- **Approvals:** show current state, actor provenance, separation-of-duties restrictions, decision rationale and immutable history where available.
- **Related records:** show real identifiers and navigation; never fabricate links, counts or names.
- **Dialogs:** labelled title, focus containment/restoration, keyboard dismissal where safe, and explicit destructive confirmation.
- **Charts:** include accessible labels or equivalent data, truthful axes/legends and an empty state rather than invented series.
- **Loading/error/unavailable:** distinguish each state. Do not render missing data as zero or success.

## 6. Responsive Requirements

Design and verify for:

- Large desktop: 1920 x 1080.
- Standard desktop: 1600 x 900 and 1440 x 900.
- Laptop: 1366 x 768.
- Tablet: representative widths around 768-1024 px.
- Mobile: representative widths around 360-430 px.

Expected behaviour:

- KPI grids reduce columns without clipping.
- Toolbars wrap into logical groups.
- Tables retain usable identifiers/actions through internal horizontal scrolling or a deliberate compact representation.
- Detail rails move below content or become an accessible drawer.
- Forms become one column where necessary.
- No page-level horizontal overflow.
- Touch targets remain usable and important actions do not disappear.

## 7. Accessibility Baseline

- Use semantic headings, tables, buttons, links and form labels.
- All functionality must be keyboard operable with visible focus.
- Preserve adequate text and control contrast using theme tokens.
- Provide accessible names for icon-only controls.
- Announce material validation and asynchronous errors appropriately.
- Respect `prefers-reduced-motion` and avoid motion that carries essential meaning.
- Status and risk severity require text, not colour alone.
- Dialogs and drawers require logical focus order and focus restoration.

## 8. Module Acceptance Checklist

For every redesigned module, record evidence for:

- Required workflows remain functional and persisted.
- Workspace isolation and RBAC are unchanged or strengthened.
- Navigation, search, filters, actions and related-record links work.
- Loading, empty, error and unavailable states are truthful.
- Responsive layouts are verified at required viewports.
- Keyboard, focus, labels, dialog and table semantics are checked.
- Frontend TypeScript/production build and ESLint pass.
- Focused frontend/backend tests pass; backend build and migration validation pass when affected.
- Whitespace and focused secret checks pass.
- Browser visual comparison is clearly labelled verified or outstanding.

## 9. Modernisation Order

1. Governance & Compliance: RACI, SoA, Frameworks and Control Register.
2. Supplier & Contract Management.
3. Control & Evidence Management.
4. Audit & Corrective Actions.
5. Asset Management.
6. Privacy Management.
7. AI Governance.
8. Business Continuity.
9. Regulatory Compliance.
10. Training & Awareness.
11. Incident & Vulnerability Management.
12. Reporting & Analytics.
13. Administration.

Do not mark a module visually complete until browser-level evidence exists. Modernisation must preserve the module's functional lifecycle and must not replace real data with presentation fixtures.

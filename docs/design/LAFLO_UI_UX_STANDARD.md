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

## 10. Reference-Derived Enterprise Patterns

The nine stakeholder-provided Cyberhaven screenshots dated 25 November 2026 are structural references only. They do not authorise copying Cyberhaven branding, dark styling, terminology, proprietary data, or product claims. LAFLO retains its approved blue-and-white visual language, existing navigation shell, design tokens, permissions, and domain model.

Reference inventory:

- `Sample Risk Theme Setup.png` and `Sample Risk Theme Setup 2.png`: dense user/case register with risk-group facets and a selection-led detail rail.
- `Sample Risk Theme Setup 3.png` and `Sample Risk Theme Setup 7.png`: source/destination facets, persistent filter context, event register, and expandable lineage.
- `Sample Risk Theme Setup 4.png`: composable analytics filters with chart/table parity.
- `Sample Risk Theme Setup 5.png`: incident status summary, queue segmentation, selected-record actions, and chronological investigation history.
- `Sample Risk Theme Setup 6.png`: governed data-object definition with conditions and an evidence-backed performance panel.
- `Sample Risk Theme Setup 8.png`: policy/rule builder with match/exclude logic, explicit response selection, and save/discard controls.
- `Sample Risk Theme Setup 9.png`: AI/data-protection posture grouped by apps and data, with bounded time filters and transparent risk profiles.

Adopt these patterns where the underlying LAFLO records and permissions support them:

- Use a **register + facets + selected detail** composition for high-volume investigation work. Keep the selected panel closed until a row is chosen and preserve the current query when opening or closing details.
- Use **compact status segments** above operational queues when each segment applies a real filter and exposes its scope. Counts must come from the same filtered dataset as the queue.
- Show **chronological investigation history** from immutable activity, comment, assignment, decision, evidence, and status records. Distinguish actor-entered statements from system-derived or provider-supplied observations.
- Use **progressive disclosure** for event lineage, rule conditions, rationale, evidence, and raw metadata. Expanded content must remain keyboard operable and must not imply unavailable telemetry.
- Provide **composable filter context** with visible chips or concise summaries, individually removable criteria, clear-all, and a documented default time range. Filters must affect every dependent metric, chart and table consistently.
- Pair visualisations with **equivalent accessible data**, clear units, bounded time ranges, source timestamps, and honest unavailable/empty states. Never render a loading illustration as evidence that data exists.
- Build policy and classification configuration as **reviewable rules**, separating match, exclude, scope, severity and response. Show a readable summary before persistence and retain server-side validation errors in context.
- Keep primary and destructive actions explicit. Save, discard, approve, close, archive, export and response-mode changes must use the existing governed dialog, RBAC, rationale, and audit-history patterns.

## 11. Domain-Specific Application

### AI Governance And Data Protection

- Group recorded AI systems, approved applications, assessments, incidents, data classes and providers without inventing usage telemetry.
- Show app usage, user counts, sensitive-data movement or trend charts only when a configured integration supplies timestamped records with provenance.
- Separate registered inventory posture from observed activity. Label manual assessments, imported evidence and provider observations distinctly.
- Reuse Privacy/Data Governance records, classifications, Evidence, Controls, Risks, RACI/SoA and Workflow approvals rather than creating a parallel AI-data register.

### Incident Management And Investigation

- Provide a filterable incident queue, meaningful lifecycle segments, selected-incident summary, assignment, comments, evidence links, decisions and immutable timeline.
- Reuse Risk Operations actions, Evidence, Controls, Risks and enterprise relationships. Do not duplicate corrective actions or source-managed action status.
- AI-generated summaries or severity suggestions must be labelled as proposals and require user review; absent providers must produce a truthful unavailable state.

### Policy, Rule And Classification Management

- Reuse Governance Documents, Controls, SoA, Framework mappings, Data Inventory and Records Governance.
- Rule builders must support only persisted condition operators and response modes implemented by the backend. Unsupported endpoint enforcement, warning or blocking options must be omitted or disabled with an explanation.
- Classification records require a stable ID, sensitivity, owner, scope, rationale, lifecycle, policy/control relationships, evidence and history where available.
- Match/exclude groups need readable Boolean structure, validation, keyboard ordering and a plain-language review summary.

### Insider Risk

- Represent insider-risk work as governed cases and recorded indicators, not employee surveillance. Reuse users, incidents, risks, assets, evidence, investigations, actions and approvals.
- Show risk groups, trends or data-flow observations only from authorised recorded sources with provenance and retention controls.
- Restrict personally sensitive case details through existing workspace RBAC, separation of duties, audit logging and minimised disclosure.

### Risk Intelligence And Enterprise Analytics

- Extend existing Risk Intelligence and Reporting components rather than adding a second dashboard system.
- Support source/destination, category, severity, owner, status and time filters only where canonical records expose those fields.
- Every KPI or chart selection must navigate, filter or explain its calculation. Expanded event lineage must point to real source records and stable identifiers.
- Saved views, exports and reports require existing permission, approval, attestation and truthful delivery controls.

## 12. Integration Truthfulness Gates

Never claim or visually imply live AI monitoring, DLP enforcement, endpoint sensors, user-behaviour telemetry, automated blocking, screenshots, cloud-app discovery or data-flow lineage unless an authorised connector is configured and the displayed records include provider provenance and observation timestamps.

When an integration is unavailable:

- Show the registered/manual records that do exist.
- State exactly which observed capability is unavailable.
- Offer a route to existing Integration or Administration configuration only when that route is functional and authorised.
- Do not generate sample events, fake trends, simulated user scores, placeholder policy violations or synthetic provider success states.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitteeReport } from '../services/riskCommitteeReport.js';
import { exportRiskReport } from '../services/riskReportExport.js';
import type { RiskIntelligenceState, RiskIntelligenceRiskSummary } from '../types/riskIntelligence.js';
import type { RiskTreatmentPlan } from '../types/riskTreatment.js';

const risk = { id: 'r1', riskRef: 'RSK-0001', title: 'Supplier outage', category: 'vendor', owner: 'Risk Owner', inherentScore: 16, residualScore: 9, targetScore: null, inherentRating: 'Critical', residualRating: 'High', methodologyId: 'matrix4', methodologyVersion: 2, dynamicScore: 77, appetiteStatus: 'outside_tolerance', reviewStatus: 'overdue', nextReviewDate: '2026-01-01', treatmentStatus: 'in_progress' } as RiskIntelligenceRiskSummary;
const state = { risks: [risk], dashboard: { topRiskDrivers: [{ label: 'Vendor', score: 77 }], executiveSummary: ['Vendor exposure requires review.'], committeeView: { topRisks: [risk] } }, capacities: [{ id: 'c1', capacityType: 'vendor', currentExposure: 12, capacityLimit: 10, utilizationPercent: 120, updatedAt: '2026-09-25' }, { id: 'c2', capacityType: 'financial', currentExposure: 0, capacityLimit: 0, utilizationPercent: 0, updatedAt: '2026-09-25' }], forecasts: [], emergingRisks: [], kris: [] } as unknown as RiskIntelligenceState;
const plan = { id: 'p1', workspaceId: 'w1', riskId: 'r1', title: 'Add resilience', description: 'Synthetic test treatment', createdAt: '2026-01-01', updatedAt: '2026-09-25', owner: 'Plan Owner', strategy: 'mitigate', status: 'in_progress', progressPercent: 40, dueDate: '2026-01-02', approvalStatus: 'pending_approval', priority: 'high', expectedResidualScore: 4, expectedResidualRating: 'Low', linkedControls: [] } as RiskTreatmentPlan;
export const committeeFixture = () => buildCommitteeReport(state, { workspaceId: 'w1', workspace: 'Synthetic organisation', preparedBy: 'owner@example.invalid', treatmentPlans: [plan, { ...plan, id: 'foreign', workspaceId: 'w2' }] }, '2026-09-25T12:00:00Z');

test('Committee pack preserves score pins, missing targets and formal draft state', () => {
  const before = JSON.stringify(state);
  const report = committeeFixture();
  assert.equal(report.metadata?.status, 'Draft');
  assert.equal(report.metadata?.workspace, 'Synthetic organisation');
  const top = report.sections.find(section => section.heading === '4. Top Enterprise Risks')!.table!;
  assert.equal(top.columns.length, 12);
  assert.equal(top.rows[0][4], '16 (Critical)');
  assert.equal(top.rows[0][5], '9 (High)');
  assert.equal(top.rows[0][6], 'Not set');
  assert.equal(top.rows[0][10], '77');
  const movement = report.sections.find(section => section.heading.includes('5. Risk Score'))!.table!.rows[0];
  assert.equal(movement[2], 'Target not set');
  assert.equal(movement[5], 'matrix4 v2');
  assert.equal(JSON.stringify(state), before);
  assert.ok(report.sections.find(section => section.heading.includes('Decisions'))!.bullets.includes('No committee decisions are currently recorded.'));
});

test('Treatment accountability uses scoped dedicated plans; unknown evidence is not zero', () => {
  const report = committeeFixture();
  const table = report.sections.find(section => section.heading.includes('6. Treatment'))!.table!;
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0][0], 'p1');
  assert.equal(table.rows[0][8], '0');
  assert.equal(table.rows[0][9], 'Not available');
  assert.equal(table.rows[0][10], 'Yes');
  assert.equal(table.rows[0][11], 'pending approval');
  assert.equal(report.sections.find(section => section.heading.includes('7. Overdue'))!.table!.rows.length, 2);
});

test('Capacity limits are interpreted without invented warning thresholds', () => {
  const rows = committeeFixture().sections.find(section => section.heading === '9. Capacity Utilization')!.table!.rows;
  assert.equal(rows[0][4], 'Above limit');
  assert.equal(rows[1][4], 'Not assessable');
});

test('Committee sign-off never promotes a generated snapshot to approval', () => {
  const report = committeeFixture();
  const section = report.sections.find(item => item.heading === '11. Approval and Sign-off')!;
  const fields = Object.fromEntries(section.table!.rows);
  assert.equal(fields['Report status'], 'Draft - not approved');
  assert.equal(fields['Prepared by'], 'owner@example.invalid');
  assert.equal(fields['Reviewed by'], 'Not recorded');
  assert.equal(fields['Approved by'], 'Not recorded');
  assert.equal(fields['Approval date'], 'Not recorded');
  assert.equal(fields['Comments'], 'No sign-off comments recorded');
  assert.equal(fields['Report template version'], '2.0');
  assert.ok(section.bullets.some(text => text.includes('No approval workflow or signatures')));
});

test('Structured JSON and CSV retain tables and appendix; PDF is real', async () => {
  const pack = committeeFixture();
  const json = JSON.parse((await exportRiskReport(pack, 'json')).content.toString());
  assert.equal(json.sections.filter((section: { appendix?: boolean }) => section.appendix).length, 3);
  const csv = (await exportRiskReport(pack, 'csv')).content.toString();
  assert.ok(csv.includes('"Current residual risk","9 (High)"'));
  assert.ok(csv.includes('Appendix A. Full Risk List'));
  assert.equal((await exportRiskReport(pack, 'pdf')).content.subarray(0, 5).toString(), '%PDF-');
});

test('Empty and unavailable sources are explicit without fabricated decisions', () => {
  const empty = { ...state, risks: [], capacities: [], dashboard: { ...state.dashboard, executiveSummary: [], topRiskDrivers: [], committeeView: { ...state.dashboard.committeeView, topRisks: [] } } };
  const report = buildCommitteeReport(empty);
  assert.ok(report.sections[0].bullets[0].includes('unavailable'));
  assert.equal(report.sections.find(section => section.heading.includes('6. Treatment'))!.table!.rows.length, 0);
  assert.equal(report.metadata?.preparedBy, 'Not available');
});

test('Large indicator and forecast sources use explicit priority summaries', () => {
  const large = { ...state, kris: Array.from({ length: 25 }, (_, i) => ({ name: `Indicator ${i}`, category: 'vendor', currentValue: i, measurementUnit: '%', greenThreshold: 1, amberThreshold: 2, redThreshold: 3, status: i === 24 ? 'red' : 'green' })), forecasts: Array.from({ length: 15 }, (_, i) => ({ scopeLabel: `Risk ${i}`, currentScore: i, predicted30DayScore: i, predicted90DayScore: i, predicted180DayScore: i, trend: 'stable' })) } as unknown as RiskIntelligenceState;
  const report = buildCommitteeReport(large);
  const kri = report.sections.find(section => section.heading.startsWith('10.'))!;
  assert.equal(kri.table!.rows.length, 20);
  assert.equal(kri.table!.rows[0][0], 'Indicator 24');
  assert.ok(kri.bullets[0].includes('20 of 25'));
  const forecasts = report.sections.find(section => section.heading.startsWith('8.'))!;
  assert.equal(forecasts.table!.rows.length, 10);
  assert.equal(forecasts.table!.rows[0][0], 'Risk 14');
});

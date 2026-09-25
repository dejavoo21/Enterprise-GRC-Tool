import type { RiskIntelligenceState, RiskIntelligenceRiskSummary, RiskReportPack } from '../types/riskIntelligence.js';
import type { RiskTreatmentPlan } from '../types/riskTreatment.js';

export interface CommitteeReportContext {
  workspaceId: string;
  workspace: string;
  preparedBy: string;
  treatmentPlans: RiskTreatmentPlan[];
}
const label = (value?: string | null) => value ? value.replaceAll('_', ' ') : 'Not set';
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not set';
const score = (value: unknown, rating?: string | null) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${value} (${rating || 'Rating not set'})` : 'Not set';
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : 'Not set';
const closed = new Set(['completed', 'accepted', 'cancelled']);
const overdue = (plan: RiskTreatmentPlan, now: number) => !closed.has(plan.status) && Number.isFinite(Date.parse(plan.dueDate)) && Date.parse(plan.dueDate) < now;
const ref = (risk: RiskIntelligenceRiskSummary) => risk.riskRef || risk.id;
const action = (risk: RiskIntelligenceRiskSummary) => [risk.reviewStatus === 'overdue' ? 'Overdue review' : '', risk.treatmentStatus === 'overdue' ? 'Overdue treatment' : '', risk.appetiteStatus !== 'within_appetite' ? 'Appetite breach: management review' : ''].filter(Boolean).join('; ') || 'No action recorded';

export function buildCommitteeReport(state: RiskIntelligenceState, context?: CommitteeReportContext, generatedAt = new Date().toISOString()): RiskReportPack {
  const risks = state.risks;
  const topRisks = state.dashboard.committeeView.topRisks.filter(r => risks.some(item => item.id === r.id)).slice(0, 10);
  const forecasts = [...state.forecasts].sort((a, b) => b.predicted90DayScore - a.predicted90DayScore).slice(0, 10);
  const priorities = { red: 0, amber: 1, green: 2 };
  const indicators = [...state.kris].sort((a, b) => priorities[a.status] - priorities[b.status] || a.name.localeCompare(b.name)).slice(0, 20);
  const plans = context?.treatmentPlans.filter(plan => plan.workspaceId === context.workspaceId && risks.some(risk => risk.id === plan.riskId)) || [];
  const outside = risks.filter(risk => risk.appetiteStatus !== 'within_appetite').length;
  const beyond = risks.filter(risk => risk.appetiteStatus === 'beyond_capacity').length;
  const now = Date.parse(generatedAt);
  const sections: RiskReportPack['sections'] = [];
  const add = (heading: string, bullets: string[], columns?: string[], rows?: string[][], appendix = false) => sections.push({ heading, bullets, ...(columns ? { table: { columns, rows: rows || [] } } : {}), ...(appendix ? { appendix: true } : {}) });
  const riskColumns = ['Risk Ref ID', 'Risk title', 'Category', 'Owner', 'Inherent risk', 'Current residual risk', 'Target risk', 'Appetite state', 'Treatment status', 'Review status', 'Intelligence index /100', 'Action required'];
  const riskRows = (items: RiskIntelligenceRiskSummary[]) => items.map(risk => [ref(risk), risk.title, label(risk.category), risk.owner || 'Not set', score(risk.inherentScore, risk.inherentRating), score(risk.residualScore, risk.residualRating), score(risk.targetScore, risk.targetRating), label(risk.appetiteStatus), label(risk.treatmentStatus), label(risk.reviewStatus), number(risk.dynamicScore), action(risk)]);
  add('1. Executive Summary', [
    risks.length ? `${outside} of ${risks.length} risks are outside appetite; ${beyond} have a recorded beyond-capacity state.` : 'Enterprise posture unavailable: no risks in this workspace snapshot.',
    `Strongest risk driver: ${state.dashboard.topRiskDrivers[0]?.label || 'Not available'}.`,
    forecasts[0] ? `Key forecast signal: ${forecasts[0].scopeLabel}, 90-day intelligence index ${number(forecasts[0].predicted90DayScore)}/100; trend ${label(forecasts[0].trend)}.` : 'Key forecast signal: not available.',
    ...state.dashboard.executiveSummary,
    outside ? 'Management interpretation: prioritize owner-led review of appetite breaches and overdue commitments. This is a rule-based reading of the snapshot, not a committee decision.' : 'Management interpretation: no appetite breach is present in this snapshot. This does not certify completeness or control effectiveness.',
    'Intelligence and forecast indices are normalized exposure signals, not methodology risk scores. They must not replace pinned score/rating decisions.',
  ]);
  add('2. Committee Decisions Required', ['No committee decisions are currently recorded.', 'Committee decision routing, risk acceptance approvals, extension requests and escalation decisions are not connected to this report. Pending treatment approvals appear below; they are not assumed to require committee approval.']);
  add('3. Risk Appetite Position', [
    'Pinned records retain their recorded methodology/version and score basis. Legacy records retain the existing intelligence appetite classification. Mixed methodology scores are not summed or averaged.',
    'Critical and High counts below use recorded residual rating labels only. Missing ratings are not inferred from intelligence indices.',
    'Appetite breach trend: not available; this is a current snapshot, not a historical period report.',
  ], ['Total risks', 'Within appetite', 'Outside appetite', 'Critical', 'High', 'Residual rating not set'], [[String(risks.length), String(risks.length - outside), String(outside), String(risks.filter(r => r.residualRating?.toLowerCase() === 'critical').length), String(risks.filter(r => r.residualRating?.toLowerCase() === 'high').length), String(risks.filter(r => !r.residualRating).length)]]);
  add('4. Top Enterprise Risks', ['Top ten follow the existing intelligence-priority order, not a comparison of raw methodology scores across versions. Actions are recorded statuses or labeled management-review suggestions, not decisions.'], riskColumns, riskRows(topRisks));
  add('5. Risk Score Movement', [
    'Inherent risk: before controls. Current residual risk: current recorded position after existing controls. Target risk: desired recorded outcome. Journey: Inherent -> Current residual -> Target.',
    'Top-ten risk journeys are shown here. Full register scores appear in Appendix A. Expected residual after treatment is a plan forecast, not current residual. No scores are recalculated or overwritten by generating this report.',
  ], ['Risk Ref ID', 'Inherent -> Residual -> Target', 'Movement', 'Treatment plan', 'Expected residual after treatment', 'Methodology basis'], topRisks.map(risk => {
    const valid = [risk.inherentScore, risk.residualScore, risk.targetScore].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const movement = risk.targetScore == null ? 'Target not set' : !valid ? 'Not available' : risk.residualScore <= risk.targetScore ? 'Target achieved' : risk.residualScore < risk.inherentScore ? 'Improving toward target' : 'No reduction yet';
    const linked = plans.filter(plan => plan.riskId === risk.id);
    return [ref(risk), `${score(risk.inherentScore, risk.inherentRating)} -> ${score(risk.residualScore, risk.residualRating)} -> ${score(risk.targetScore, risk.targetRating)}`, movement, linked.map(plan => plan.id).join('\n') || 'Not set', linked.map(plan => `${plan.id}: ${score(plan.expectedResidualScore, plan.expectedResidualRating)}`).join('\n') || 'Not set', risk.methodologyId ? `${risk.methodologyId} v${risk.methodologyVersion ?? 'Not set'}` : 'Legacy / unversioned'];
  }));
  add('6. Treatment Plan Progress', [context ? 'Dedicated treatment-plan records in this workspace. Evidence summary text is not a verified evidence-link count.' : 'Treatment-plan source not loaded; counts and progress unavailable.'], ['Plan ID', 'Risk Ref ID', 'Treatment title', 'Owner', 'Strategy', 'Progress', 'Due date', 'Status', 'Controls linked', 'Evidence linked', 'Overdue', 'Approval status'], plans.map(plan => [plan.id, plan.riskRef || ref(risks.find(r => r.id === plan.riskId)!), plan.title, plan.owner || 'Not set', label(plan.strategy), `${number(plan.progressPercent)}%`, date(plan.dueDate), label(plan.status), plan.linkedControls ? String(plan.linkedControls.length) : 'Not available', 'Not available', overdue(plan, now) ? 'Yes' : 'No', label(plan.approvalStatus)]));
  add('7. Overdue Reviews and Actions', ['Overdue evidence and escalation workflow status are not available from the connected report sources. No zero counts are implied.'], ['Reference', 'Action', 'Owner', 'Due date', 'Severity', 'Escalation status'], [
    ...plans.filter(plan => overdue(plan, now)).map(plan => [plan.id, `Treatment: ${plan.title}`, plan.owner || 'Not set', date(plan.dueDate), label(plan.priority), 'Not recorded']),
    ...risks.filter(risk => risk.reviewStatus === 'overdue').map(risk => [ref(risk), 'Risk review', risk.reviewOwner || risk.owner || 'Not set', date(risk.nextReviewDate), risk.residualRating || 'Not set', 'Not recorded']),
  ]);
  add('8. Emerging Risks / Forecast Intelligence', [`Showing ${forecasts.length} of ${state.forecasts.length} forecast records, ordered by highest 90-day intelligence index. Forecast indices are not methodology scores. Horizons are model projections, not approved target scores.`], ['Scope / driver', 'Current index /100', '30-day index /100', '90-day index /100', '180-day index /100', 'Trend'], forecasts.map(forecast => [forecast.scopeLabel, number(forecast.currentScore), number(forecast.predicted30DayScore), number(forecast.predicted90DayScore), number(forecast.predicted180DayScore), label(forecast.trend)]));
  add('Emerging risk watchlist', [], ['Risk', 'Category', 'Monitoring status', 'Trigger events'], state.emergingRisks.map(risk => [risk.title, label(risk.category), label(risk.monitoringStatus), risk.triggerEvents.join('; ') || 'Not recorded']));
  const capacityRows = state.capacities.map(capacity => {
    const valid = Number.isFinite(capacity.capacityLimit) && capacity.capacityLimit > 0 && Number.isFinite(capacity.currentExposure) && Number.isFinite(capacity.utilizationPercent);
    const exceeded = valid && capacity.currentExposure > capacity.capacityLimit;
    return [label(capacity.capacityType), number(capacity.currentExposure), number(capacity.capacityLimit), valid ? `${capacity.utilizationPercent}%` : 'Not available', !valid ? 'Not assessable' : exceeded ? 'Above limit' : capacity.currentExposure === capacity.capacityLimit ? 'At limit' : 'Below limit', 'Not available', !valid ? 'Validate configured limit / exposure' : exceeded ? 'Management review of capacity breach' : capacity.currentExposure === capacity.capacityLimit ? 'Review available headroom' : 'Monitor against configured limit'];
  });
  add('9. Capacity Utilization', ['Capacity is the configured domain exposure limit in the existing model, not a methodology score, financial balance or certified resource capacity. Usage above the limit (100%) indicates a breach; at the limit indicates no headroom. No unconfigured warning threshold is invented. Trend history is not available.'], ['Domain', 'Current usage', 'Capacity limit', 'Utilization %', 'Status', 'Trend', 'Action required'], capacityRows);
  add('10. KRI / Indicator Summary', [`Showing ${indicators.length} of ${state.kris.length} indicator records, red then amber then green. Full counts: ${state.kris.filter(k => k.status === 'red').length} red, ${state.kris.filter(k => k.status === 'amber').length} amber, ${state.kris.filter(k => k.status === 'green').length} green. This is a priority summary, not a full KRI extract.`, 'Threshold values and status are taken from the existing indicator configuration. Trend and direct risk linkage are not available from this source.'], ['KRI name', 'Category', 'Current value', 'Configured thresholds', 'Status', 'Trend', 'Linked risk'], indicators.map(kri => [kri.name, label(kri.category), `${number(kri.currentValue)} ${kri.measurementUnit}`, `Green ${number(kri.greenThreshold)}; amber ${number(kri.amberThreshold)}; red ${number(kri.redThreshold)}`, label(kri.status), 'Not available', 'Not available']));
  add('11. Approval and Sign-off', ['Draft - not approved. This report is suitable for review preparation, not evidence of committee approval. No approval workflow or signatures are captured by this export.'], ['Field', 'Value'], [['Report status', 'Draft - not approved'], ['Prepared by', context?.preparedBy || 'Not available'], ['Reviewed by', 'Not recorded'], ['Approved by', 'Not recorded'], ['Approval date', 'Not recorded'], ['Comments', 'No sign-off comments recorded'], ['Report template version', '2.0']]);
  add('Appendix A. Full Risk List', ['Full current workspace register extract; not filtered by the table page or a historical period.'], riskColumns, riskRows(risks), true);
  add('Appendix B. Capacity Extract', ['Underlying current capacity records.'], ['ID', 'Domain', 'Usage', 'Limit', 'Utilization %', 'Updated'], state.capacities.map(c => [c.id, label(c.capacityType), number(c.currentExposure), number(c.capacityLimit), number(c.utilizationPercent), c.updatedAt]), true);
  const versions = new Map<string, RiskIntelligenceRiskSummary>();
  risks.forEach(risk => versions.set(risk.methodologyId ? `${risk.methodologyId} v${risk.methodologyVersion ?? 'Not set'}` : 'Legacy / unversioned', risk));
  add('Appendix C. Methodology and Export Metadata', [`Generated ${generatedAt}; current snapshot; template 2.0; workspace ${context?.workspaceId || 'Not available'}.`, 'Historical scoring is preserved. This report neither activates methodology versions nor re-scores records.'], ['Methodology / version', 'Configuration', 'Rating bands', 'Appetite max'], [...versions].map(([key, risk]) => [key, risk.methodology?.config.name || 'Configuration not available', risk.methodology?.config.ratingBands.map(band => `${band.label}: ${band.minScore}-${band.maxScore}`).join('; ') || 'Not available', number(risk.methodology?.config.appetiteMaxScore)]), true);
  return { reportType: 'risk_committee_report', title: 'Risk Committee Report', generatedAt, format: 'json', metadata: { workspace: context?.workspace || 'Not available', workspaceId: context?.workspaceId || 'Not available', period: 'Current snapshot', preparedBy: context?.preparedBy || 'Not available', classification: 'Confidential', status: 'Draft', version: '2.0' }, sections };
}

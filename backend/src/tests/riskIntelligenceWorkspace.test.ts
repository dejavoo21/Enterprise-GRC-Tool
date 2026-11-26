import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('risk intelligence provides canonical facets and selection-led signal detail', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/RiskIntelligenceWorkspace.tsx'), 'utf8');
  assert.match(page, /All owners/);
  assert.match(page, /All sources/);
  assert.match(page, /All frequencies/);
  assert.match(page, /Recorded signal detail/);
  assert.match(page, /Open linked risk/);
  assert.match(page, /props\.onSelectRisk\(risk\)/);
  assert.match(page, /persisted record fields only/);
  assert.match(page, /does not infer event lineage, telemetry or causal relationships/);
  assert.doesNotMatch(page, /sampleLineage|mockTelemetry|fabricatedEvent/);
});

test('risk intelligence signal entry rejects duplicate writes and freezes reviewed values', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/RiskIntelligenceWorkspace.tsx'), 'utf8');
  assert.match(page, /const requestLock = useRef\(false\)/);
  assert.match(page, /if\(requestLock\.current\) return/);
  assert.match(page, /requestLock\.current = true/);
  assert.match(page, /finally \{requestLock\.current = false;setBusy\(false\);\}/);
  assert.match(page, /<form onSubmit=\{submit\} aria-busy=\{busy\}>/);
  assert.equal((page.match(/required disabled=\{busy\}/g) || []).length, 2);
  assert.match(page, /required defaultValue="" disabled=\{busy\}/);
});

test('risk intelligence KPI cards open canonical filtered destinations', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/RiskIntelligenceWorkspace.tsx'), 'utf8');
  const risks = await readFile(path.join(root, 'frontend/src/pages/Risks.tsx'), 'utf8');
  assert.match(page, /if\(title === 'Risks in model'\) props\.onOpenRegisterQuery\('all'\)/);
  assert.match(page, /else if\(title === 'Appetite breaches'\) props\.onOpenRegisterQuery\('outside'\)/);
  assert.match(page, /else if\(title === 'Red KRIs'\) \{setKriStatus\('red'\);setKriPage\(1\);focusSection\(kriRef\);\}/);
  assert.match(page, /else if\(title === 'Deteriorating'\) props\.onOpenRegisterQuery\('all','increasing'\)/);
  assert.match(page, /else if\(title === 'Emerging risks'\) focusSection\(emergingRef\)/);
  assert.match(page, /<button type="button" key=\{title\} className=\{`riKpiCard/);
  assert.match(page, /aria-label=\{`\$\{title\}: \$\{value\}\. \$\{note\}`\}/);
  assert.doesNotMatch(page, /<article key=\{title\} className=\{`riKpiCard/);
  assert.match(risks, /onOpenRegisterQuery=\{\(appetite, trend = 'all'\) => \{/);
  assert.match(risks, /appetite: appetite === 'outside' \? 'outside' : null/);
  assert.match(risks, /trend: trend === 'all' \? null : trend/);
  assert.match(risks, /selectedTrend !== 'all' && risk\.trend !== selectedTrend/);
  assert.match(risks, /next\.delete\('tab'\)/);
  assert.match(risks, /trend: null, riskRef: null, planStatus: null/);
});

test('risk register KPI cards open canonical queues instead of static summaries', async () => {
  const register = await readFile(path.join(root, 'frontend/src/pages/RiskRegisterView.tsx'), 'utf8');
  const views = await readFile(path.join(root, 'frontend/src/pages/RiskWorkspaceViews.tsx'), 'utf8');
  const risks = await readFile(path.join(root, 'frontend/src/pages/Risks.tsx'), 'utf8');
  assert.match(views, /export type RiskRegisterKpiIntent = 'all' \| 'open' \| 'outside-appetite' \| 'critical' \| 'treatments' \| 'overdue-review'/);
  assert.match(register, /<button type="button" className=\{`rrKpi/);
  assert.match(register, /onClick=\{\(\)=>onSelect\(item\.intent as RiskRegisterKpiIntent\)\}/);
  assert.doesNotMatch(register, /summaries\.map\(item => <div className=\{`rrKpi/);
  assert.match(risks, /setSelectedRating\(intent === 'critical' \? 'critical' : 'all'\)/);
  assert.match(risks, /setSelectedReviewStatus\(intent === 'overdue-review' \? 'overdue' : 'all'\)/);
  assert.match(risks, /status: intent === 'open' \? 'open' : null/);
  assert.match(risks, /appetite: intent === 'outside-appetite' \? 'outside' : null/);
  assert.match(risks, /if\(intent === 'treatments'\) \{setActiveTab\('treatments'\);return;\}/);
});

test('treatment KPI cards apply exact aggregate filters', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/RiskTreatmentWorkspace.tsx'), 'utf8');
  assert.match(page, /status === 'open' \? !\['completed','accepted','cancelled'\]\.includes\(plan\.status\)/);
  assert.match(page, /priority === 'high_or_critical' \? \['high','critical'\]\.includes\(plan\.priority\)/);
  assert.match(page, /<section className="rdMetrics rdMetrics--actions"/);
  assert.match(page, /onClick=\{\(\)=>openSummary\(String\(intent\)\)\}/);
  assert.match(page, /setStatus\(intent === 'open' \? 'open' : intent === 'overdue' \? 'overdue' : 'all'\)/);
  assert.match(page, /setPriority\(intent === 'priority' \? 'high_or_critical' : 'all'\)/);
  assert.match(page, /setSort\(intent === 'progress' \? 'progress' : 'due'\)/);
  assert.match(page, /<option value="open">Open \(not completed, accepted or cancelled\)<\/option>/);
  assert.match(page, /<option value="high_or_critical">High or critical<\/option>/);
});

test('report KPI cards open canonical records and readiness context', async () => {
  const reports = await readFile(path.join(root, 'frontend/src/pages/RiskReportsWorkspace.tsx'), 'utf8');
  const risks = await readFile(path.join(root, 'frontend/src/pages/Risks.tsx'), 'utf8');
  const treatments = await readFile(path.join(root, 'frontend/src/pages/RiskTreatmentWorkspace.tsx'), 'utf8');
  assert.match(reports, /rdMetrics--six rdMetrics--actions/);
  assert.match(reports, /props\.onOpenRegisterMetric\('outside-appetite'\)/);
  assert.match(reports, /props\.onOpenRegisterMetric\('critical'\)/);
  assert.match(reports, /props\.onOpenRegisterMetric\('overdue-review'\)/);
  assert.match(reports, /props\.onOpenTreatmentQuery\('open'\)/);
  assert.match(reports, /historyRef\.current\?\.scrollIntoView/);
  assert.match(reports, /readinessRef\.current\.open=true/);
  assert.match(risks, /planStatus: status === 'open' \? 'open' : null/);
  assert.match(risks, /next\.set\('tab','treatment-plans'\)/);
  assert.match(treatments, /searchParams\.get\('planStatus'\) === 'open' \? 'open' : 'all'/);
  assert.match(risks, /key=\{`\$\{workspaceId\}:\$\{activeTab\}:\$\{activeTab === 'treatments' \? `\$\{searchParams\.get\('planStatus'\) \|\| ''\}:\$\{searchParams\.get\('plan'\) \|\| ''\}` : ''\}`\}/);
  assert.match(risks, /if \(routeSearch !== routeSearchRef\.current\) \{\s*routeSearchRef\.current = routeSearch;\s*setSearchQuery\(routeSearch\)/);
});

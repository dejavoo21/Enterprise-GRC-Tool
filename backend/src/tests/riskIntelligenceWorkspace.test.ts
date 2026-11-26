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
});

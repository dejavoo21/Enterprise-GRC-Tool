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

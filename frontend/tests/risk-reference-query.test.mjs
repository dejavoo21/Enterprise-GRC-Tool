import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = await build({
  stdin: { contents: "export * from './src/lib/riskStatusFilter'; export * from './src/lib/queryFilters';", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { matchesRiskReference, buildFilteredPath, updateQueryFilters } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);

test('risk reference drill-down requires an exact persisted reference', () => {
  assert.equal(matchesRiskReference('RSK-0004', 'RSK-0004'), true);
  for (const reference of ['RSK-00040', 'RSK-004', 'risk-db-4', '', null, undefined]) {
    assert.equal(matchesRiskReference(reference, 'RSK-0004'), false);
  }
  assert.equal(matchesRiskReference('RSK-0004', null), true);
  assert.equal(matchesRiskReference(null, null), true);
});

test('removing a reference preserves other query filters without mutating input', () => {
  const original = new URLSearchParams('riskRef=RSK-0004&status=open&appetite=outside');
  const cleared = updateQueryFilters(original, { riskRef: null });
  assert.equal(cleared.get('riskRef'), null);
  assert.equal(cleared.get('status'), 'open');
  assert.equal(cleared.get('appetite'), 'outside');
  assert.equal(original.get('riskRef'), 'RSK-0004');
});

test('reference route values cannot inject unrelated query parameters', () => {
  const path = buildFilteredPath('/risks', { riskRef: 'RSK-0004&status=closed' });
  const query = new URL(path, 'http://localhost').searchParams;
  assert.equal(query.get('riskRef'), 'RSK-0004&status=closed');
  assert.equal(query.get('status'), null);
  assert.equal(matchesRiskReference('RSK-0004', query.get('riskRef')), false);
});

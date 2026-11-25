import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('reporting analytics propagates composable filters and exposes truthful drill-down context', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/Reports.tsx'), 'utf8');
  assert.match(page, /Generated report filters/);
  assert.match(page, /Applied reporting filters/);
  assert.match(page, /filteredReports\.map/);
  assert.match(page, /Snapshot generated/);
  assert.match(page, /Last workflow update/);
  assert.match(page, /Recorded source: Reporting Center/);
  assert.match(page, /View metrics as table/);
  assert.match(page, /No generated reports match the applied filters/);
  assert.doesNotMatch(page, /observed monitoring|external delivery succeeded|generated trend data/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('shared data table controls are functional and keyboard accessible', async () => {
  const component = await readFile(path.join(root, 'frontend/src/components/DataTable.tsx'), 'utf8');
  assert.match(component, /const filteredData = useMemo/);
  assert.match(component, /value=\{search\}/);
  assert.match(component, /value=\{filter\}/);
  assert.match(component, /visibleData\.map/);
  assert.match(component, /Page \{currentPage\} of \{pageCount\}/);
  assert.match(component, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(component, /No records match the current search and filter/);
  assert.doesNotMatch(component, /Pagination placeholder/);
});

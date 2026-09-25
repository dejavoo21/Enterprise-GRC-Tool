import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const output = await build({entryPoints:[fileURLToPath(new URL('../src/lib/issueSort.ts', import.meta.url))],bundle:true,write:false,platform:'node',format:'esm'});
const {sortIssues} = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
test('issue sorting keeps missing dates last, respects priority and preserves source records', () => {
  const rows = [{title:'Missing',priority:'Unknown'}, {title:'Later',priority:'Low',dueDate:'2026-12-01'}, {title:'Earlier',priority:'Critical',dueDate:'2026-01-01'}, {title:'Invalid',priority:'High',dueDate:'invalid'}];
  const original = structuredClone(rows);
  assert.deepEqual(sortIssues(rows,'due').map(r=>r.title),['Earlier','Later','Missing','Invalid']);
  assert.deepEqual(sortIssues(rows,'priority').map(r=>r.priority),['Critical','High','Low','Unknown']);
  assert.deepEqual(sortIssues(rows,'title').map(r=>r.title),['Earlier','Invalid','Later','Missing']);
  assert.deepEqual(sortIssues(rows,'source'),original);
  assert.deepEqual(rows,original);
});

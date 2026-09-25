import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const output = await build({entryPoints:[fileURLToPath(new URL('../src/lib/overdueAge.ts', import.meta.url))],bundle:true,write:false,platform:'node',format:'esm'});
const {overdueDays, overdueAgeBands} = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
const asOf = Date.parse('2026-09-25T12:00:00Z');

test('overdue age groups cover every boundary exactly once', () => {
  for (const [days, expected] of [[0,0],[6,0],[7,1],[30,1],[31,2],[90,2],[91,3],[365,3]]) {
    const age = overdueDays(new Date(asOf - days * 86400000).toISOString(), asOf);
    assert.equal(age, days);
    assert.deepEqual(overdueAgeBands.flatMap((band, index) => age >= band.min && age <= band.max ? [index] : []), [expected]);
  }
});

test('missing dates stay unavailable and elapsed days retain existing rounding', () => {
  assert.equal(overdueDays(undefined, asOf), null);
  assert.equal(overdueDays('', asOf), null);
  assert.equal(overdueDays('invalid', asOf), null);
  assert.equal(overdueDays(new Date(asOf + 86400000).toISOString(), asOf), 0);
  assert.equal(overdueDays(new Date(asOf - 6.9 * 86400000).toISOString(), asOf), 6);
});

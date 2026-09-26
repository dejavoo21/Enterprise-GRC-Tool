import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const output = await build({ entryPoints: [fileURLToPath(new URL('../src/pages/admin/AdminEventCharts.tsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic' });
const { AdminEventDistribution, AdminEventTrend } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);

test('admin charts show honest empty states without invalid coordinates', () => {
  for (const component of [AdminEventDistribution, AdminEventTrend]) {
    const html = renderToStaticMarkup(createElement(component, { values: [] }));
    assert.match(html, /No (events|recorded dates)/);
    assert.doesNotMatch(html, /NaN|Infinity|<svg/);
  }
});

test('admin event charts preserve exact data and support a single recorded date', () => {
  const values = [['auth', 3], ['risk', 2]];
  const html = renderToStaticMarkup(createElement(AdminEventDistribution, { values }));
  assert.match(html, /5 loaded events/);
  assert.match(html, /<strong>3<\/strong>/);
  assert.match(html, /<strong>2<\/strong>/);
  assert.deepEqual(values, [['auth', 3], ['risk', 2]]);
  const trend = renderToStaticMarkup(createElement(AdminEventTrend, { values: [['2026-09-26', 0]] }));
  assert.match(trend, /2026-09-26/);
  assert.match(trend, /cx="160"/);
  assert.doesNotMatch(trend, /NaN|Infinity/);
});

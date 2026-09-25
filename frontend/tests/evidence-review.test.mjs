import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = await build({ stdin: { contents: "export * from './src/lib/evidenceReview';", resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { isEvidenceOutsideReviewTolerance: expired } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
const now = Date.parse('2026-09-25T12:00:00Z');
const daysAgo = days => new Date(now - days * 86400000).toISOString();

test('review expiry preserves the existing strict 120-day boundary', () => {
  assert.equal(expired({collectedAt: daysAgo(120)}, now), false);
  assert.equal(expired({collectedAt: daysAgo(120.001)}, now), true);
  assert.equal(expired({collectedAt: daysAgo(90)}, now), false);
  assert.equal(expired({collectedAt: daysAgo(-1)}, now), false);
});
test('last review takes precedence and missing/invalid dates retain the existing policy', () => {
  assert.equal(expired({collectedAt: daysAgo(300), lastReviewedAt: daysAgo(1)}, now), false);
  assert.equal(expired({collectedAt: daysAgo(1), lastReviewedAt: daysAgo(121)}, now), true);
  assert.equal(expired({}, now), true);
  assert.equal(expired({collectedAt:'bad date'}, now), true);
  assert.equal(expired({collectedAt:daysAgo(1),lastReviewedAt:'bad date'}, now), true);
});

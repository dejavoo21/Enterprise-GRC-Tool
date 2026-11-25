import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('RACI and SoA details use accessible non-modal drawers', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceApplicability.tsx'), 'utf8');

  assert.match(page, /ref=\{raciDrawerRef\}[\s\S]*role="dialog"[\s\S]*aria-modal="false"[\s\S]*aria-labelledby="raci-detail-title"/);
  assert.match(page, /ref=\{drawerRef\}[\s\S]*role="dialog"[\s\S]*aria-modal="false"[\s\S]*aria-labelledby="soa-detail-title"/);
  assert.match(page, /event\.key==='Escape'&&!busy/);
  assert.match(page, /requestAnimationFrame\(\(\)=>selectedTriggerRef\.current\?\.focus\(\)\)/);
  assert.match(page, /event\.key==='Enter'\|\|event\.key===' '/);
});

test('governance detail mutations lock captured input and reject duplicate actions', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceApplicability.tsx'), 'utf8');

  assert.match(page, /if\(governanceAction\)return/);
  assert.match(page, /if\(busy\)return;const form=event\.currentTarget/);
  assert.match(page, /<fieldset disabled=\{busy\}>/);
  assert.match(page, /disabled=\{Boolean\(governanceAction\)\}/);
  assert.match(page, /aria-busy=\{busy\}/);
});

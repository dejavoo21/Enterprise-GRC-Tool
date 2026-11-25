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

  assert.match(page, /const governanceActionLock=useRef\(false\)/);
  assert.match(page, /if\(governanceActionLock\.current\)return/);
  assert.match(page, /operationLock=\{governanceActionLock\}/);
  assert.match(page, /operationLock:\{current:boolean\}/);
  assert.equal((page.match(/governanceActionLock\.current=true/g) ?? []).length, 1);
  assert.equal((page.match(/governanceActionLock\.current=false/g) ?? []).length, 1);
  assert.equal((page.match(/operationLock\.current=true/g) ?? []).length, 3);
  assert.equal((page.match(/operationLock\.current=false/g) ?? []).length, 3);
  assert.match(page, /const requestClose=\(\)=>\{if\(!busy&&!operationLock\.current\)close\(\);\}/);
  assert.match(page, /onClick=\{requestClose\}/);
  assert.match(page, /<fieldset disabled=\{busy\}>/);
  assert.match(page, /disabled=\{Boolean\(governanceAction\)\}/);
  assert.match(page, /aria-busy=\{busy\}/);
});

test('governance entry and import workflows lock reviewed payloads during persistence', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceApplicability.tsx'), 'utf8');

  assert.match(page, /const entryActionLock=useRef\(false\)/);
  assert.equal((page.match(/if\(entryActionLock\.current\)return/g) ?? []).length, 4);
  assert.equal((page.match(/entryActionLock\.current=true/g) ?? []).length, 4);
  assert.equal((page.match(/entryActionLock\.current=false/g) ?? []).length, 4);
  assert.equal((page.match(/<fieldset disabled=\{Boolean\(entryAction\)\}>/g) ?? []).length, 3);
  assert.match(page, /disabled=\{Boolean\(entryAction\)\}[\s\S]*Applying\.\.\./);
});

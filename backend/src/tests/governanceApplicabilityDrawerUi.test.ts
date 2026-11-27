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
  assert.match(page, /operationSequence=\{governanceSequence\}/);
  assert.match(page, /operationLock:\{current:boolean\}/);
  assert.match(page, /operationSequence:\{current:number\}/);
  assert.equal((page.match(/governanceActionLock\.current=true/g) ?? []).length, 1);
  assert.equal((page.match(/governanceActionLock\.current=false/g) ?? []).length, 2);
  assert.equal((page.match(/operationLock\.current=true/g) ?? []).length, 1);
  assert.equal((page.match(/operationLock\.current=false/g) ?? []).length, 1);
  assert.match(page, /const runOperation=async<T,>/);
  assert.match(page, /const sequence=\+\+operationSequence\.current,itemId=item\.id/);
  assert.match(page, /sequence!==operationSequence\.current\|\|itemId!==itemIdRef\.current/);
  assert.match(page, /if\(sequence===operationSequence\.current\)\{operationLock\.current=false;setOperation\(null\);\}/);
  assert.match(page, /const filename=`\$\{item\.soa_ref\}-v\$\{item\.document_version\}\.json`/);
  assert.match(page, /controlId=String\(f\.get\('controlId'\)\|\|''\),payload=/);
  assert.match(page, /const requestClose=\(\)=>\{if\(!busy&&!operationLock\.current\)close\(\);\}/);
  assert.match(page, /onClick=\{requestClose\}/);
  assert.match(page, /<fieldset disabled=\{busy\}>/);
  assert.match(page, /disabled=\{Boolean\(governanceAction\)\}/);
  assert.match(page, /aria-busy=\{busy\}/);
});

test('governance entry and import workflows lock reviewed payloads during persistence', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceApplicability.tsx'), 'utf8');

  assert.match(page, /const entryActionLock=useRef\(false\)/);
  assert.equal((page.match(/if\(entryActionLock\.current\)return/g) ?? []).length, 2);
  assert.equal((page.match(/entryActionLock\.current=true/g) ?? []).length, 2);
  assert.equal((page.match(/entryActionLock\.current=false/g) ?? []).length, 3);
  assert.match(page, /const payload=\{controlId:/);
  assert.match(page, /const payload=\{frameworkCode:/);
  assert.match(page, /const payload=\{kind:f\.get\('kind'\),sourceName:f\.get\('sourceName'\),rows\}/);
  assert.equal((page.match(/<fieldset disabled=\{Boolean\(entryAction\)\}>/g) ?? []).length, 3);
  assert.match(page, /disabled=\{Boolean\(entryAction\)\}[\s\S]*Applying\.\.\./);
});

test('governance parent reads and actions reject stale workspace context', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceApplicability.tsx'), 'utf8');
  for (const sequence of ['loadSequence', 'selectionSequence', 'governanceSequence', 'entrySequence']) {
    assert.match(page, new RegExp(`${sequence}=useRef\\(0\\)`));
  }
  assert.match(page, /workspaceIdRef=useRef\(currentWorkspace\.id\)/);
  assert.match(page, /request!==loadSequence\.current\|\|workspaceId!==workspaceIdRef\.current/);
  assert.match(page, /request===selectionSequence\.current&&workspaceId===workspaceIdRef\.current/);
  assert.match(page, /operation!==governanceSequence\.current\|\|workspaceId!==workspaceIdRef\.current/);
  assert.match(page, /operation!==entrySequence\.current\|\|workspaceId!==workspaceIdRef\.current/);
  assert.match(page, /if\(operation===governanceSequence\.current\)\{governanceActionLock\.current=false/);
  assert.match(page, /if\(operation===entrySequence\.current\)\{entryActionLock\.current=false/);
});

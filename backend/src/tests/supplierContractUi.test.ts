import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('supplier and contract entry uses the guarded accessible modal contract', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.tsx'), 'utf8');
  const styles = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.css'), 'utf8');

  assert.match(page, /<Modal accessibleDialog isOpen onClose=\{requestClose\}/);
  assert.match(page, /const submitLock = useRef\(false\);/);
  assert.match(page, /const requestClose = \(\) => \{ if \(!busy && !submitLock\.current\) onClose\(\); \};/);
  assert.match(page, /if \(submitLock\.current\) return;/);
  assert.match(page, /submitLock\.current = true;/);
  assert.match(page, /submitLock\.current = false;/);
  assert.match(page, /<form className="supplierForm" onSubmit=\{save\} aria-busy=\{busy\}>/);
  assert.match(page, /<fieldset disabled=\{busy\}>/);
  assert.match(page, /<label htmlFor=\{id\}>[\s\S]*<input id=\{id\} name=\{name\}/);
  assert.match(page, /htmlFor=\{`supplier-record-\$\{mode\}-vendorId`\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /disabled=\{busy\}>\{busy \? 'Saving\.\.\.' : 'Save record'\}/);
  assert.doesNotMatch(page, /className="supplierModal"/);
  assert.match(styles, /\.supplierForm fieldset\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:720px\)[\s\S]*\.supplierForm fieldset\{grid-template-columns:1fr\}/);
});

test('supplier register details are keyboard accessible and lock lifecycle actions', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.tsx'), 'utf8');
  const styles = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.css'), 'utf8');

  assert.match(page, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(page, /ref=\{detailRef\}[\s\S]*role="dialog"[\s\S]*aria-modal="false"[\s\S]*aria-labelledby="supplier-detail-title"/);
  assert.match(page, /event\.key==='Escape'&&!busy/);
  assert.match(page, /requestAnimationFrame\(\(\)=>selectedTriggerRef\.current\?\.focus\(\)\)/);
  assert.match(page, /className="supplierButton" disabled=\{busy\} onClick=\{onEdit\}/);
  assert.match(page, /const lifecycleLock=useRef\(false\)/);
  assert.match(page, /if\(!selected\|\|lifecycleLock\.current\)return/);
  assert.match(page, /lifecycleLock\.current=true/);
  assert.match(page, /lifecycleLock\.current=false/);
  assert.match(page, /if\(busy\|\|lifecycleLock\.current\)return/);
  assert.match(styles, /\.supplierDetail:focus-visible\{outline:2px solid #2855d7/);
});

test('supplier and contract reads and mutations reject stale workspace context', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.tsx'), 'utf8');
  assert.match(page, /const \{workspaceId\}=useWorkspace\(\)/);
  for (const sequence of ['loadSequence', 'historySequence', 'lifecycleSequence']) {
    assert.match(page, new RegExp(`const ${sequence}=useRef\\(0\\)`));
  }
  assert.match(page, /if\(request!==loadSequence\.current\)return/);
  assert.match(page, /if\(request===historySequence\.current\)setHistory/);
  assert.match(page, /const operation=\+\+lifecycleSequence\.current/);
  assert.match(page, /const reviewedMode=mode;const reviewedId=selected\.id/);
  assert.match(page, /if\(operation===lifecycleSequence\.current\)\{lifecycleLock\.current=false;setBusy\(false\);\}/);
  assert.match(page, /const submitSequence = useRef\(0\);/);
  assert.match(page, /if \(submission !== submitSequence\.current\) return;/);
  assert.match(page, /if \(submission === submitSequence\.current\) \{\s+submitLock\.current = false/);
});

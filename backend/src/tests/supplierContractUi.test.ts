import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('supplier and contract entry uses the guarded accessible modal contract', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.tsx'), 'utf8');
  const styles = await readFile(path.join(root, 'frontend/src/pages/SupplierContractManagement.css'), 'utf8');

  assert.match(page, /<Modal accessibleDialog isOpen onClose=\{requestClose\}/);
  assert.match(page, /const requestClose = \(\) => \{ if \(!busy\) onClose\(\); \};/);
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

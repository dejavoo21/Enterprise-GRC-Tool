import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), 'src', relativePath), 'utf8');

test('supplier creation and lifecycle decisions retain explicit permission gates', () => {
  const vendorsRoute = source('routes/vendors.ts');
  const tprmRoute = source('routes/tprm.ts');
  assert.match(vendorsRoute, /router\.post\('\/', requirePermission\('Vendors', 'create'\)/);
  assert.match(tprmRoute, /requirePermission\('Vendors', 'approve'\)/);
});

test('assessment and contract histories are scoped by workspace and parent record', () => {
  const repository = source('repositories/tprmRepo.ts');
  assert.match(repository, /supplier_assessment_review_history[\s\S]*WHERE workspace_id=\$1 AND assessment_id=\$2/);
  assert.match(repository, /supplier_contract_lifecycle_history[\s\S]*WHERE workspace_id=\$1 AND contract_id=\$2/);
});

test('contracts persist their creator and enforce independent approval', () => {
  const repository = source('repositories/tprmRepo.ts');
  assert.match(repository, /exit_requirements, created_by/);
  assert.match(repository, /assertIndependentDecision\(current\.createdBy, actorId, nextStatus\)/);
});

test('vendor creation uses a responsive accessible dialog with retained failures', () => {
  const page = readFileSync(path.resolve(process.cwd(), '../frontend/src/pages/Vendors.tsx'), 'utf8');
  assert.match(page, /<Modal accessibleDialog/);
  assert.match(page, /title="Create New Vendor"/);
  assert.match(page, /htmlFor="vendor-name"/);
  assert.match(page, /htmlFor="vendor-data-types"/);
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 200px\), 1fr\)\)/);
  assert.match(page, /setSubmitError\(cause instanceof Error/);
  assert.match(page, /role="alert"/);
  assert.match(page, /const submitLock = useRef\(false\)/);
  assert.match(page, /if \(submitLock\.current\) return;/);
  assert.match(page, /submitLock\.current = false/);
  assert.match(page, /onClose=\{requestClose\}/);
  assert.match(page, /onClick=\{requestClose\} disabled=\{isSubmitting\}/);
  assert.match(page, /<fieldset[\s\S]*disabled=\{isSubmitting\}[\s\S]*aria-busy=\{isSubmitting\}/);
  assert.doesNotMatch(page, /position: 'fixed'/);
});

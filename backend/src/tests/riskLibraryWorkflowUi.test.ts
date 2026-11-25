import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RiskLibrary.tsx'), 'utf8');

test('risk library mutations share one synchronous operation lock', () => {
  assert.match(page, /const mutationLock=useRef\(false\)/);
  assert.match(page, /const beginMutation=.*if\(mutationLock\.current\)return false/);
  assert.match(page, /mutationLock\.current=true/);
  assert.match(page, /const finishMutation=.*mutationLock\.current=false/);
  assert.equal((page.match(/beginMutation\('(?:template|edit|archive|risk)'\)/g) || []).length, 4);
  assert.match(page, /onClose=\{closeCreate\}/);
  assert.match(page, /onClose=\{closeEdit\}/);
  assert.match(page, /onClose=\{closeRisk\}/);
  assert.equal((page.match(/<fieldset className="riskLibraryCreate" disabled=/g) || []).length, 2);
});

test('create-risk partial success cannot produce a duplicate live risk', () => {
  assert.match(page, /payload=JSON\.stringify\(riskDraft\)/);
  assert.match(page, /setSource\(null\);setRiskDraft\(null\);try\{await recordRiskLibraryUse/);
  assert.match(page, /was created, but the Risk Library usage count could not be updated/);
  assert.match(page, /catch\(e\)\{setMutationError\(e instanceof Error\?e\.message:'Unable to create the reviewed risk\.'/);
});

test('template writes snapshot reviewed input and retain failed editors', () => {
  assert.equal((page.match(/JSON\.parse\(JSON\.stringify\(draft\)\) as RiskLibraryTemplateInput/g) || []).length, 2);
  assert.match(page, /Unable to create the risk template/);
  assert.match(page, /Unable to update the risk template/);
  assert.match(page, /role="alert">\{mutationError\}/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertIndependentDecision, assertQuestionnaireResponseAllowed, assertQuestionnaireTransition } from '../services/supplierContractRules.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('supplier questionnaire lifecycle is allowlisted and independently reviewed', () => {
  assert.doesNotThrow(() => assertQuestionnaireTransition('draft', 'sent'));
  assert.doesNotThrow(() => assertQuestionnaireTransition('sent', 'in_progress'));
  assert.doesNotThrow(() => assertQuestionnaireTransition('in_progress', 'submitted'));
  assert.doesNotThrow(() => assertQuestionnaireTransition('submitted', 'reviewed'));
  assert.throws(() => assertQuestionnaireTransition('draft', 'reviewed'), /cannot transition/);
  assert.throws(() => assertIndependentDecision('creator-a', 'creator-a', 'approved'), /cannot make the independent/);
});

test('supplier responses are limited to open non-template questionnaires', () => {
  assert.doesNotThrow(() => assertQuestionnaireResponseAllowed('sent', false));
  assert.doesNotThrow(() => assertQuestionnaireResponseAllowed('in_progress', false));
  assert.throws(() => assertQuestionnaireResponseAllowed('draft', false), /only be recorded/);
  assert.throws(() => assertQuestionnaireResponseAllowed('sent', true), /Template questionnaires/);
});

test('questionnaire routes enforce permissions, workspace scope and audited lifecycle', () => {
  const routes = read('src/routes/tprm.ts');
  const repo = read('src/repositories/tprmRepo.ts');
  assert.match(routes, /questionnaires\/:id\/transition', requirePermission\('Vendors', 'edit'\)/);
  assert.match(routes, /status === 'reviewed'.*requirePermission\('Vendors', 'approve'\)/s);
  assert.match(routes, /questions\/:questionId\/response', requirePermission\('Vendors', 'edit'\)/);
  assert.match(routes, /summary: 'Recorded supplier questionnaire response'/);
  assert.match(routes, /fileUrl && !isSafeExternalReference\(fileUrl\)/);
  assert.match(repo, /vendors WHERE id = \$3 AND workspace_id = \$2 AND archived_at IS NULL/);
  assert.match(repo, /status = 'draft'/);
  assert.doesNotMatch(repo.slice(repo.indexOf('const fieldMap', repo.indexOf('export async function updateQuestionnaire')), repo.indexOf('if (fields.length', repo.indexOf('export async function updateQuestionnaire'))), /status:|completionPercentage|reviewedBy/);
  assert.match(repo, /questionnaire\.workspace_id = \$1 AND questionnaire\.id = \$2/);
});

test('questionnaire destination renders a real selection-led workflow', () => {
  const app = read('../frontend/src/App.tsx');
  const page = read('../frontend/src/pages/SupplierQuestionnaires.tsx');
  assert.match(app, /case 'tprm-questionnaires':[\s\S]*<SupplierQuestionnaires/);
  assert.match(page, /Supplier Questionnaires/);
  assert.match(page, /fetchVendorQuestionnaireResponses/);
  assert.match(page, /Approve independent review/);
  assert.match(page, /actionLock\.current/);
  assert.match(page, /workspaceRef\.current/);
});

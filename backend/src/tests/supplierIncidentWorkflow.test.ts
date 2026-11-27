import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertSupplierIncidentResolution, assertSupplierIncidentTransition } from '../services/supplierContractRules.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('supplier incident lifecycle is explicit and resolution requires evidence', () => {
  assert.doesNotThrow(() => assertSupplierIncidentTransition('open', 'investigating'));
  assert.doesNotThrow(() => assertSupplierIncidentTransition('investigating', 'mitigating'));
  assert.doesNotThrow(() => assertSupplierIncidentTransition('mitigating', 'resolved'));
  assert.doesNotThrow(() => assertSupplierIncidentTransition('resolved', 'closed'));
  assert.throws(() => assertSupplierIncidentTransition('open', 'closed'), /cannot transition/);
  assert.throws(() => assertSupplierIncidentResolution('resolved', '', 'patched'), /Root cause and remediation/);
  assert.doesNotThrow(() => assertSupplierIncidentResolution('resolved', 'Supplier configuration gap', 'Configuration corrected'));
});

test('supplier incident persistence validates ownership and prevents direct lifecycle bypass', () => {
  const repo = read('src/repositories/tprmRepo.ts');
  const routes = read('src/routes/tprm.ts');
  const updateStart = repo.indexOf('export async function updateIncident');
  const fieldMap = repo.slice(repo.indexOf('const fieldMap', updateStart), repo.indexOf('if (fields.length', updateStart));
  assert.match(repo, /vendors WHERE id = \$3 AND workspace_id = \$2 AND archived_at IS NULL/);
  assert.match(repo, /WHERE id = \$1 AND workspace_id = \$2 AND status = \$3/);
  assert.doesNotMatch(fieldMap, /status:|resolvedAt/);
  assert.match(routes, /incidents\/:id\/transition', requirePermission\('Vendors', 'edit'\)/);
  assert.match(routes, /resolutionEvidenceRecorded/);
});

test('supplier incident destination renders a governed persisted workflow', () => {
  const app = read('../frontend/src/App.tsx');
  const page = read('../frontend/src/pages/SupplierIncidents.tsx');
  assert.match(app, /case 'tprm-incidents':[\s\S]*<SupplierIncidents/);
  assert.match(page, /Supplier Incidents/);
  assert.match(page, /fetchVendorIncidents/);
  assert.match(page, /Record supplier incident resolution/);
  assert.match(page, /setMetricView\('data'\)/);
  assert.match(page, /metricView === 'resolved'/);
  assert.match(page, /actionLock\.current/);
  assert.match(page, /workspaceRef\.current/);
});

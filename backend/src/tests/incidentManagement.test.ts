import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pool } from '../db.js';
import { canTransitionIncident, canTransitionVulnerability, nextIncidentStatuses, nextVulnerabilityStatuses } from '../lib/incidentLifecycle.js';
import { assertIncidentIds } from '../repositories/incidentManagementRepo.js';

const root = path.resolve(__dirname, '../../..');

test('incident and vulnerability lifecycles allow only governed transitions', () => {
  assert.equal(canTransitionIncident('open', 'triaged'), true);
  assert.equal(canTransitionIncident('open', 'closed'), false);
  assert.equal(canTransitionIncident('resolved', 'investigating'), true);
  assert.deepEqual(nextIncidentStatuses('closed'), []);
  assert.equal(canTransitionVulnerability('identified', 'triaged'), true);
  assert.equal(canTransitionVulnerability('identified', 'closed'), false);
  assert.equal(canTransitionVulnerability('mitigated', 'in_progress'), true);
  assert.deepEqual(nextVulnerabilityStatuses('false_positive'), []);
});

test('incident routes enforce dedicated RBAC, workspace links and audit history', async () => {
  const [index, routes, repository, migration, permissions] = await Promise.all([
    readFile(path.join(root, 'backend/src/index.ts'), 'utf8'),
    readFile(path.join(root, 'backend/src/routes/incidentManagement.ts'), 'utf8'),
    readFile(path.join(root, 'backend/src/repositories/incidentManagementRepo.ts'), 'utf8'),
    readFile(path.join(root, 'backend/sql/migrations/20261124-incident-vulnerability-management.sql'), 'utf8'),
    readFile(path.join(root, 'backend/src/services/accessGovernanceDefaults.ts'), 'utf8'),
  ]);
  assert.match(index, /requireModulePermissions\('Incidents'\)/);
  assert.match(routes, /requirePermission\('Incidents', 'create'\)/);
  assert.match(routes, /requirePermission\('Incidents', 'edit'\)/);
  assert.match(routes, /assertWorkspaceLinks/);
  assert.match(routes, /recordActivity/);
  assert.match(repository, /WHERE workspace_id=\$1 AND \(id=\$2 OR incident_ref=\$2\)/);
  assert.match(repository, /FOR UPDATE/);
  assert.match(repository, /security_case_events/);
  assert.match(migration, /UNIQUE \(workspace_id, incident_ref\)/);
  assert.match(migration, /UNIQUE \(workspace_id, vulnerability_ref\)/);
  assert.match(permissions, /'Incidents'/);
});

test('linked incidents reject missing or cross-workspace identifiers', async () => {
  const original = pool.query.bind(pool);
  let capturedValues: unknown[] = [];
  pool.query = (async (_text: string, values: unknown[] = []) => {
    capturedValues = values;
    return { rows: [{ id: 'incident-a' }], rowCount: 1 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(assertIncidentIds('workspace-a', ['incident-a', 'incident-b']), /unavailable in this workspace/);
    assert.deepEqual(capturedValues, ['workspace-a', ['incident-a', 'incident-b']]);
  } finally {
    pool.query = original;
  }
});

test('incident workspace is distinct from Risk Operations and has no sample records', async () => {
  const [app, sidebar, page, layout] = await Promise.all([
    readFile(path.join(root, 'frontend/src/App.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/components/Sidebar.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/IncidentManagement.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/layouts/MainLayout.tsx'), 'utf8'),
  ]);
  assert.match(app, /case 'incidents':[\s\S]*<IncidentManagement/);
  assert.match(sidebar, /key: 'incidents', label: 'Open Incident Management'/);
  assert.match(page, /No sample records are generated/);
  assert.match(page, /Evidence IDs reference metadata records/);
  assert.match(page, /Operational actions/);
  assert.equal((page.match(/const requestClose = \(\) => \{ if \(!saving\) onClose\(\); \};/g) || []).length, 2);
  assert.equal((page.match(/onClose=\{requestClose\}/g) || []).length, 2);
  assert.equal((page.match(/onClick=\{requestClose\} disabled=\{saving\}/g) || []).length, 2);
  assert.match(layout, /targetType === 'security_incident'[\s\S]*return 'incidents'/);
  assert.doesNotMatch(page, /INC-00001|VUL-00001|sampleIncident|mockIncident/);
});

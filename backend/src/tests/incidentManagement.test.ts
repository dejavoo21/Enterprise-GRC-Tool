import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pool } from '../db.js';
import { canTransitionIncident, canTransitionVulnerability, nextIncidentStatuses, nextVulnerabilityStatuses } from '../lib/incidentLifecycle.js';
import { addCaseComment, assertIncidentIds, assertWorkspaceMember, assignCase, updateIncidentCaseContext } from '../repositories/incidentManagementRepo.js';
import { validateIncidentCaseContext } from '../services/incidentContextRules.js';

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

test('insider-risk context validation bounds reviewed personal context', () => {
  const valid = {
    caseCategory: 'insider_risk',
    subjectUserId: '11111111-1111-4111-8111-111111111111',
    riskGroupLabels: ['Departure review'],
    indicatorSummary: 'Reviewed policy concern.',
    handlingBasis: 'Authorised investigation.',
    reviewDueAt: '2026-12-01T23:59:59.000Z',
    notes: 'Classified after review.',
  };
  assert.equal(validateIncidentCaseContext(valid, true), null);
  assert.match(validateIncidentCaseContext({ ...valid, riskGroupLabels: [{}] }, true) || '', /array/i);
  assert.match(validateIncidentCaseContext({ ...valid, riskGroupLabels: Array(21).fill('label') }, true) || '', /up to 20/i);
  assert.match(validateIncidentCaseContext({ ...valid, indicatorSummary: 'x'.repeat(4001) }, true) || '', /4,000/i);
  assert.match(validateIncidentCaseContext({ ...valid, reviewDueAt: 'not-a-date' }, true) || '', /valid date/i);
  assert.match(validateIncidentCaseContext({ ...valid, notes: '' }, true) || '', /rationale/i);
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
  assert.match(routes, /\/:entityType\/:id\/assignment', requirePermission\('Incidents', 'edit'\)/);
  assert.match(routes, /\/:entityType\/:id\/comments', requirePermission\('Incidents', 'edit'\)/);
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
  const [app, sidebar, page, layout, assets, controls, evidence, risks] = await Promise.all([
    readFile(path.join(root, 'frontend/src/App.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/components/Sidebar.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/IncidentManagement.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/layouts/MainLayout.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/Assets.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/Controls.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/Evidence.tsx'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/Risks.tsx'), 'utf8'),
  ]);
  assert.match(app, /case 'incidents':[\s\S]*<IncidentManagement/);
  assert.match(sidebar, /key: 'incidents', label: 'Open Incident Management'/);
  assert.match(page, /No sample records are generated/);
  assert.match(page, /Evidence IDs reference metadata records/);
  assert.match(page, /Operational actions/);
  assert.match(page, /Assign owner/);
  assert.match(page, /Add investigation comment/);
  assert.match(page, /immutable case history/);
  assert.match(page, /validateReviewedContext/);
  assert.match(page, /no more than 20 risk group labels/);
  assert.match(page, /maxLength=\{4000\}/);
  assert.match(page, /Filter by owner/);
  assert.match(page, /Filter by source/);
  assert.match(page, /Filters applied:/);
  assert.match(page, /\/assets\?search=/);
  assert.match(page, /\/risks\?search=/);
  assert.match(page, /\/controls\?search=/);
  assert.match(page, /\/evidence\?search=/);
  assert.match(assets, /searchParams\.get\('search'\)/);
  assert.match(controls, /initialSearch=\{linkedSearch\}/);
  assert.match(evidence, /initialSearch=\{linkedSearch\}/);
  assert.match(risks, /searchParams\.get\('search'\)/);
  assert.match(risks, /\[risk\.id, risk\.riskRef/);
  assert.equal((page.match(/const requestClose = \(\) => \{ if \(!saving\) onClose\(\); \};/g) || []).length, 3);
  assert.equal((page.match(/onClose=\{requestClose\}/g) || []).length, 3);
  assert.equal((page.match(/onClick=\{requestClose\} disabled=\{saving\}/g) || []).length, 3);
  assert.equal((page.match(/const submit = async \(\) => \{\s+if \(saving\) return;/g) || []).length, 4);
  assert.match(page, /<fieldset className="incidentForm" disabled=\{saving\}>/);
  assert.match(page, /<fieldset className="incidentDecision" disabled=\{saving\}>/);
  assert.match(layout, /targetType === 'security_incident'[\s\S]*return 'incidents'/);
  assert.doesNotMatch(page, /INC-00001|VUL-00001|sampleIncident|mockIncident/);
});

test('case assignment is workspace-scoped and records one transactional history event', async () => {
  const originalConnect = pool.connect.bind(pool);
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const row = { id: 'inc-a', workspace_id: 'workspace-a', incident_ref: 'INC-00042', title: 'Reviewed incident', description: '', incident_type: 'security_event', severity: 'high', status: 'investigating', source: 'manual', owner: 'Old Owner', detected_at: '2026-11-25T00:00:00Z', target_resolution_at: null, resolved_at: null, resolution_summary: null, linked_risk_ids: [], linked_asset_ids: [], linked_control_ids: [], linked_evidence_ids: [], created_by: 'creator', updated_by: 'creator', created_at: '2026-11-25T00:00:00Z', updated_at: '2026-11-25T00:00:00Z' };
  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      if (text.startsWith('SELECT *')) return { rows: [row] };
      if (text.startsWith('UPDATE')) return { rows: [{ ...row, owner: 'New Owner', updated_by: 'reviewer' }] };
      return { rows: [] };
    },
    release: () => undefined,
  };
  pool.connect = (async () => client) as typeof pool.connect;
  try {
    const updated = await assignCase('workspace-a', 'incident', 'inc-a', 'reviewer', 'New Owner', 'Escalated to the response lead.');
    assert.equal(updated?.owner, 'New Owner');
    assert.ok(calls.some(call => call.text.includes('WHERE workspace_id=$1 AND id=$2 FOR UPDATE') && call.values?.[0] === 'workspace-a'));
    assert.ok(calls.some(call => call.text.includes("'assigned'") && String(call.values?.[5]).includes('Old Owner to New Owner')));
    assert.ok(calls.some(call => call.text === 'COMMIT'));
  } finally { pool.connect = originalConnect; }
});

test('case comments validate the workspace record and append immutable history', async () => {
  const originalConnect = pool.connect.bind(pool);
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      if (text.startsWith('SELECT id')) return { rows: [{ id: 'inc-a' }] };
      if (text.startsWith('INSERT INTO security_case_events')) return { rows: [{ id: 'sce-a', workspace_id: 'workspace-a', entity_type: 'incident', entity_id: 'inc-a', action: 'commented', actor_id: 'reviewer', previous_status: null, new_status: null, notes: 'Investigation note.', created_at: '2026-11-25T12:00:00Z' }] };
      return { rows: [] };
    },
    release: () => undefined,
  };
  pool.connect = (async () => client) as typeof pool.connect;
  try {
    const event = await addCaseComment('workspace-a', 'incident', 'inc-a', 'reviewer', 'Investigation note.');
    assert.equal(event?.action, 'commented');
    assert.ok(calls.some(call => call.text.includes('WHERE workspace_id=$1 AND id=$2 FOR UPDATE') && call.values?.[0] === 'workspace-a'));
    assert.ok(calls.some(call => call.text.includes("'commented'") && call.values?.[5] === 'Investigation note.'));
  } finally { pool.connect = originalConnect; }
});

test('insider-risk case context is additive, minimised and never claims surveillance', async () => {
  const [routes, repository, migration, page] = await Promise.all([
    readFile(path.join(root, 'backend/src/routes/incidentManagement.ts'), 'utf8'),
    readFile(path.join(root, 'backend/src/repositories/incidentManagementRepo.ts'), 'utf8'),
    readFile(path.join(root, 'backend/sql/migrations/20261125-insider-risk-case-context.sql'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/IncidentManagement.tsx'), 'utf8'),
  ]);
  assert.match(routes, /assertWorkspaceMember\(workspaceId, body\.subjectUserId\)/);
  assert.match(routes, /incidents\/:id\/case-context', requirePermission\('Incidents', 'edit'\)/);
  assert.match(repository, /workspace_user_memberships WHERE workspace_id=\$1 AND user_id=\$2::uuid/);
  assert.match(repository, /'case_context_updated'/);
  assert.match(migration, /case_category IN \('security_incident', 'insider_risk'\)/);
  assert.match(migration, /FOREIGN KEY \(subject_user_id\) REFERENCES users\(id\) ON DELETE RESTRICT/);
  assert.match(page, /Insider risk cases/);
  assert.match(page, /No employee risk score, behaviour trend or endpoint telemetry is generated by LAFLO/);
  assert.doesNotMatch(page, /riskScore|behaviourScore|endpointEvents/);
});

test('subject validation rejects users outside the selected workspace', async () => {
  const original = pool.query.bind(pool);
  pool.query = (async () => ({ rows: [], rowCount: 0 })) as unknown as typeof pool.query;
  try { await assert.rejects(assertWorkspaceMember('workspace-a', '11111111-1111-1111-1111-111111111111'), /not an authorised member/); }
  finally { pool.query = original; }
});

test('reviewed case context update locks the workspace record and appends history', async () => {
  const originalConnect = pool.connect.bind(pool);
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const row = { id: 'inc-a', workspace_id: 'workspace-a', incident_ref: 'INC-00042', title: 'Reviewed case', description: '', incident_type: 'policy_concern', severity: 'high', status: 'investigating', source: 'manual', owner: 'Response Lead', detected_at: '2026-11-25T00:00:00Z', target_resolution_at: null, resolved_at: null, resolution_summary: null, linked_risk_ids: [], linked_asset_ids: [], linked_control_ids: [], linked_evidence_ids: [], case_category: 'security_incident', subject_user_id: null, risk_group_labels: [], indicator_summary: null, handling_basis: null, review_due_at: null, created_by: 'creator', updated_by: 'creator', created_at: '2026-11-25T00:00:00Z', updated_at: '2026-11-25T00:00:00Z' };
  const client = { query: async (text: string, values?: unknown[]) => { calls.push({ text, values }); if (text.startsWith('SELECT *')) return { rows: [row] }; if (text.startsWith('UPDATE')) return { rows: [{ ...row, case_category: 'insider_risk', subject_user_id: '11111111-1111-1111-1111-111111111111', risk_group_labels: ['Departure review'], indicator_summary: 'Reviewed policy concern.', handling_basis: 'Authorised investigation.', updated_by: 'reviewer' }] }; return { rows: [] }; }, release: () => undefined };
  pool.connect = (async () => client) as typeof pool.connect;
  try {
    const updated = await updateIncidentCaseContext('workspace-a', 'inc-a', 'reviewer', { caseCategory: 'insider_risk', subjectUserId: '11111111-1111-1111-1111-111111111111', riskGroupLabels: ['Departure review'], indicatorSummary: 'Reviewed policy concern.', handlingBasis: 'Authorised investigation.', notes: 'Classified after review.' });
    assert.equal(updated?.caseCategory, 'insider_risk');
    assert.ok(calls.some(call => call.text.includes('FOR UPDATE') && call.values?.[0] === 'workspace-a'));
    assert.ok(calls.some(call => call.text.includes("'case_context_updated'") && call.values?.[4] === 'Classified after review.'));
  } finally { pool.connect = originalConnect; }
});

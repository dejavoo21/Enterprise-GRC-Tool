import assert from 'node:assert/strict';
import test from 'node:test';
import { incidentActionStatus, securityCasePriority, vulnerabilityActionStatus } from '../repositories/issuesRepo.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('active incident lifecycle states map to source-managed operational work', () => {
  assert.equal(incidentActionStatus('open'), 'Open');
  assert.equal(incidentActionStatus('triaged'), 'Open');
  assert.equal(incidentActionStatus('investigating'), 'In Progress');
  assert.equal(incidentActionStatus('contained'), 'In Progress');
  assert.equal(incidentActionStatus('remediating'), 'In Progress');
  assert.equal(incidentActionStatus('resolved'), null);
  assert.equal(incidentActionStatus('closed'), null);
  assert.equal(incidentActionStatus('cancelled'), null);
});

test('active vulnerability lifecycle states map to source-managed operational work', () => {
  assert.equal(vulnerabilityActionStatus('identified'), 'Open');
  assert.equal(vulnerabilityActionStatus('triaged'), 'Open');
  assert.equal(vulnerabilityActionStatus('remediation_planned'), 'Open');
  assert.equal(vulnerabilityActionStatus('in_progress'), 'In Progress');
  assert.equal(vulnerabilityActionStatus('mitigated'), null);
  assert.equal(vulnerabilityActionStatus('accepted'), null);
  assert.equal(vulnerabilityActionStatus('closed'), null);
  assert.equal(vulnerabilityActionStatus('false_positive'), null);
});

test('security case severity retains its authoritative operational priority', () => {
  assert.equal(securityCasePriority('low'), 'Low');
  assert.equal(securityCasePriority('medium'), 'Medium');
  assert.equal(securityCasePriority('high'), 'High');
  assert.equal(securityCasePriority('critical'), 'Critical');
});

test('operations routes fail closed when the source-module view permission is absent', async () => {
  const source = await readFile(path.resolve(process.cwd(), 'src/routes/issues.ts'), 'utf8');
  assert.match(source, /Incident: 'Incidents', Vulnerability: 'Incidents'/);
  assert.match(source, /'Audit Readiness': 'Audits'/);
  assert.match(source, /Training: 'Training'/);
  assert.match(source, /if \(action\.sourceType !== 'Workflow'\) return sourceModules\[action\.sourceType\]/);
  assert.match(source, /permissionModules\.has\(action\.domain as PermissionModule\)/);
  assert.match(source, /new Set\(actions\.map\(actionPermissionModule\)/);
  assert.match(source, /\[\.\.\.requested\]\.filter\(moduleName => moduleName !== 'Risks'\)/);
  assert.match(source, /const data = listed\.filter\(action =>/);
  assert.match(source, /!await canReadAction\(req,action\)/);
  assert.match(source, /!await canReadAction\(req, issue\)/);
  assert.match(source, /!await canReadAction\(req,previous\)/);
});

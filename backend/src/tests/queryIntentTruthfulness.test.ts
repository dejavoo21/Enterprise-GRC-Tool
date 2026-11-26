import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('audit and evidence pages accept only implemented query intents', () => {
  const audit = read('../frontend/src/pages/AuditReadiness.tsx');
  const evidence = read('../frontend/src/pages/Evidence.tsx');

  assert.match(audit, /searchParams\.get\('type'\) === 'audit-blocker' \? 'audit-blocker' : null/);
  assert.match(audit, /label="Audit blockers"/);
  assert.doesNotMatch(audit, /does not yet expose a reliable record-level filter/);
  assert.match(evidence, /readAllowedFilter\(searchParams, 'status', \['expired'\]\)/);
  assert.match(evidence, /label="Expired evidence"/);
  assert.doesNotMatch(evidence, /This evidence status is not supported/);
});

test('applied filters cannot advertise cosmetic route-ready state', () => {
  const component = read('../frontend/src/components/AppliedQueryFilter.tsx');
  assert.doesNotMatch(component, /routeReady/);
  assert.doesNotMatch(component, /route ready/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateRetention, validateArchiveTransition, validateDisposalTransition, validateHoldTransition, validateRetentionRule } from '../services/recordsGovernance.js';

test('retention calculation is unavailable without an explicit rule', () => assert.equal(calculateRetention({}).status, 'Retention Unavailable'));
test('legal hold takes precedence over retention eligibility', () => assert.equal(calculateRetention({ triggerDate: '2020-01-01', durationMonths: 12, activeHoldCount: 1, now: new Date('2026-01-01') }).status, 'On Hold'));
test('elapsed retention creates a review requirement rather than deletion', () => assert.deepEqual(calculateRetention({ triggerDate: '2020-01-01', durationMonths: 12, now: new Date('2026-01-01') }), { status: 'Disposal Review Required', eligibilityDate: '2021-01-01' }));
test('retention rules reject unsupported source types and invalid duration', () => assert.equal(validateRetentionRule({ name: 'x', recordType: 'incident', triggerEvent: 'created_at', durationMonths: 0 }).length, 2));
test('active hold blocks disposal progression', () => assert.match(validateDisposalTransition('Eligibility Review', 'Approval', 1) ?? '', /block/));
test('disposal completion requires the controlled lifecycle', () => assert.match(validateDisposalTransition('Proposed', 'Verified Completed') ?? '', /Cannot move/));
test('archive requests cannot skip review and approval', () => assert.match(validateArchiveTransition('Proposed', 'Scheduled') ?? '', /Cannot move/));
test('legal hold release requires an active approved hold', () => assert.match(validateHoldTransition('Pending Approval', 'Released') ?? '', /Cannot move/));
test('records lifecycle requests use a reviewed accessible dialog', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /function RecordsRequestModal/);
  assert.match(page, /This records a controlled request only/);
  assert.match(page, /does not archive, dispose of, or delete/);
  assert.match(page, /role="alert"/);
});

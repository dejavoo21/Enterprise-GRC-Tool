import test from 'node:test';
import assert from 'node:assert/strict';
import { riskIssueCiaImpacts } from '../repositories/issuesRepo.js';

test('derived risk issues retain recorded CIA classifications without inventing missing ones', () => {
  const recorded = ['Availability', 'Integrity', 'Confidentiality', 'Integrity'];
  assert.deepEqual(riskIssueCiaImpacts(recorded), ['Confidentiality', 'Integrity', 'Availability']);
  assert.deepEqual(recorded, ['Availability', 'Integrity', 'Confidentiality', 'Integrity']);
  for (const missing of [undefined, null, [], 'Confidentiality', ['unknown']]) {
    assert.deepEqual(riskIssueCiaImpacts(missing), []);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('privacy reads are non-mutating and do not seed fabricated defaults', () => {
  const repository = read('src/repositories/privacyRepo.ts');
  assert.doesNotMatch(repository, /seedPrivacyDefaults/);
  const stateSource = repository.slice(repository.indexOf('export async function getPrivacyState'));
  assert.doesNotMatch(stateSource, /INSERT INTO|createDpiaRecord|createDataInventoryRecord/);
});

test('DPIA links and lifecycle operations are workspace scoped and permission protected', () => {
  const repository = read('src/repositories/privacyRepo.ts');
  const routes = read('src/routes/privacy.ts');
  assert.match(routes, /evidence: req\.body\?\.linkedEvidenceIds/);
  assert.match(routes, /requirePermission\('Risks', 'edit'\)/);
  assert.match(routes, /requirePermission\('Risks', 'approve'\)/);
  assert.match(repository, /privacy_dpia_events WHERE workspace_id=\$1 AND dpia_id=\$2/);
  assert.match(repository, /privacy_dpias WHERE workspace_id=\$1 AND id=\$2/);
});

test('privacy report summaries derive from current workspace state', () => {
  const routes = read('src/routes/privacy.ts');
  assert.match(routes, /const state = await getPrivacyState\(getWorkspaceId\(req\)\)/);
  assert.match(routes, /No distribution or approval is implied/);
  assert.doesNotMatch(routes, /Privacy program posture refreshed/);
});

test('privacy lifecycle migration is additive and constrains approval status', () => {
  const migration = read('sql/migrations/20261124-privacy-dpia-lifecycle.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS privacy_dpia_events/);
  assert.match(migration, /linked_evidence_ids JSONB/);
  assert.match(migration, /approval_status IN \('draft', 'in_review', 'approved', 'rejected'\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

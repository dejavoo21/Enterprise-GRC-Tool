import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Enterprise Activity Ledger schema is migration-owned', () => {
  const service = readFileSync(resolve(process.cwd(), 'src/services/activityLedger/activityLedger.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const seed = readFileSync(resolve(process.cwd(), 'src/scripts/seed-core-grc.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-enterprise-activity-ledger-schema.sql'), 'utf8');

  assert.doesNotMatch(service, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(startup, /ensureActivityLedgerSchema/);
  assert.doesNotMatch(seed, /ensureActivityLedgerSchema/);
  assert.match(service, /export async function recordActivity/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS enterprise_activity_ledger/);
  assert.match(migration, /No activity records are created or changed/);
});

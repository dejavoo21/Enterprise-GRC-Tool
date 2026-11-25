import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Asset Operations schema and compatibility transition are migration-owned', () => {
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const schema = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-asset-operations-schema.sql'), 'utf8');
  const transition = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-asset-operations-identity-transition.sql'), 'utf8');

  assert.equal(existsSync(resolve(process.cwd(), 'src/services/assetBootstrap.ts')), false);
  assert.doesNotMatch(startup, /ensureAssetOperationsSchema/);
  assert.equal((schema.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 4);
  assert.equal((schema.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 4);
  assert.doesNotMatch(schema, /UPDATE assets|SET NOT NULL|CREATE UNIQUE INDEX/);
  assert.match(transition, /WHERE asset_tag IS NULL/);
  assert.match(transition, /REPLACE\(id::text, '-', ''\)/);
  assert.doesNotMatch(transition, /LEFT\(id::text, 8\)/);
  assert.match(transition, /ALTER COLUMN asset_tag SET NOT NULL/);
  assert.match(transition, /CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_tag/);
});

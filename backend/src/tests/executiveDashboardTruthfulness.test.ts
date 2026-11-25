import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('executive dashboards cannot import a fabricated workspace seed', () => {
  const seedPath = resolve(process.cwd(), '../frontend/src/services/dashboard/executiveDashboardSeed.ts');
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.equal(existsSync(seedPath), false);
  assert.doesNotMatch(dashboard, /executiveDashboardSeed|buildExecutiveDashboardSeed|mergeWithExecutiveSeed/);
});

test('executive dashboard source does not backfill absent live values with seed helpers', () => {
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.doesNotMatch(dashboard, /fallbackScalar|fallbackText|shouldUseExecutiveSeedWorkspace/);
  assert.doesNotMatch(dashboard, /Seeded executive evidence artifact|Seeded vendor review posture/);
});

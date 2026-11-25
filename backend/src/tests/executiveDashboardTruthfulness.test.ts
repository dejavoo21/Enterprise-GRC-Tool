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

test('executive analytics do not manufacture historical score or severity trends', () => {
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.doesNotMatch(dashboard, /buildScoreTrend|buildFlatTrend|buildComplianceCoverageTrend/);
  assert.doesNotMatch(dashboard, /buildSeverityCountTrend|buildKpiSparklineSeries/);
  assert.match(dashboard, /const complianceTrendPoints = useMemo<TrendPoint\[\]>\(\(\) => \[\], \[\]\)/);
  assert.match(dashboard, /const auditTrendPoints = useMemo<TrendPoint\[\]>\(\(\) => \[\], \[\]\)/);
  assert.match(dashboard, /points: buildMonthlySeries\([\s\S]*risk\.updatedAt \|\| risk\.createdAt/);
  assert.match(dashboard, /return points\.some\(\(point\) => point\.value > 0\) \? points : \[\]/);
});

test('executive analytics do not infer forecasts, readiness, or momentum from current values', () => {
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.doesNotMatch(dashboard, /effectiveForecasts|predictedRiskExposure|complianceForecast|auditReadinessForecast|vendorForecast/);
  assert.doesNotMatch(dashboard, /effectiveReporting|committeeReadiness|count:\s*4/);
  assert.doesNotMatch(dashboard, /Readiness improved|Audit readiness improved|increased \$\{Math\.max/);
  assert.match(dashboard, /forecastValue:\s*null/g);
  assert.match(dashboard, /No recorded forecast model output/);
  assert.match(dashboard, /recordedBoardPackStatus/);
  assert.match(dashboard, /generated reports await attestation/);
  assert.match(dashboard, /trend:\s*'Current snapshot'/);
});

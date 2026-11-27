import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertAiComplianceProgram } from '../services/aiComplianceRules.js';

const valid = {
  frameworkCode: 'EU_AI_ACT' as const, frameworkName: 'EU AI Act', score: 45, targetScore: 90, gapCount: 4,
  controlCoveragePercent: 60, evidenceCoveragePercent: 35, documentationCoveragePercent: 70,
  trainingCoveragePercent: 50, status: 'watch' as const,
};

test('AI compliance readiness requires explicit bounded human-assessed values', () => {
  assert.doesNotThrow(() => assertAiComplianceProgram(valid));
  assert.throws(() => assertAiComplianceProgram({ ...valid, score: -1 }), /0 to 100/);
  assert.throws(() => assertAiComplianceProgram({ ...valid, targetScore: 101 }), /0 to 100/);
  assert.throws(() => assertAiComplianceProgram({ ...valid, evidenceCoveragePercent: 42.5 }), /whole recorded percentage/);
  assert.throws(() => assertAiComplianceProgram({ ...valid, gapCount: -1 }), /Gap count/);
  assert.throws(() => assertAiComplianceProgram({ ...valid, frameworkCode: 'UNKNOWN' as never }), /supported AI governance framework/);
});

test('AI compliance editor replaces the dead gap action without provider claims', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/AiGovernance.tsx'), 'utf8');
  const route = readFileSync(resolve(process.cwd(), 'src/routes/aiGovernance.ts'), 'utf8');
  assert.match(page, /Review EU AI Act Readiness/);
  assert.match(page, /Save readiness assessment/);
  assert.match(page, /does not calculate these values from live AI monitoring or provider telemetry/);
  assert.match(page, /updateAiComplianceProgramRecord/);
  assert.doesNotMatch(page, /Close EU AI Act Gap/);
  assert.match(route, /assertAiComplianceProgram\(req\.body \|\| \{\}\)/);
  assert.match(route, /requirePermission\('AI', 'configure'\)/);
});

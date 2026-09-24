import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyMethodology, validateMethodology, scoreRisk, scoreProfile, previewMatrix } from '../services/riskMethodologyRules.js';
const config = () => structuredClone(legacyMethodology);
test('legacy multiplication and rating boundaries are preserved', () => {
  const c = validateMethodology(config());
  assert.equal(scoreRisk(c, 5, 5).score, 25);
  assert.equal(scoreRisk(c, 4, 5).rating, 'Critical');
  assert.equal(scoreRisk(c, 3, 4).rating, 'High');
  assert.equal(scoreRisk(c, 2, 3).rating, 'Medium');
  assert.equal(scoreRisk(c, 1, 5).rating, 'Low');
});
test('3x3, 4x4 and rectangular configurations generate exact cell counts', () => {
  for (const [rows, cols] of [[3, 3], [4, 4], [3, 5], [5, 5]]) {
    const c = config(); c.likelihoodLevels = c.likelihoodLevels.slice(0, rows); c.impactLevels = c.impactLevels.slice(0, cols);
    c.ratingBands = [{ label: 'Configured band', minScore: 1, maxScore: rows * cols, colour: '#123456', severityOrder: 1 }];
    c.appetiteMaxScore = 1; c.treatmentRequiredFromScore = 2; c.escalationRequiredFromScore = rows * cols;
    const matrix = previewMatrix(validateMethodology(c));
    assert.equal(matrix.length, rows); assert.equal(matrix.flat().length, rows * cols);
    assert.equal(matrix[0][cols - 1].score, rows * cols);
  }
});
test('missing targets remain null; partial and mandatory targets rejected', () => {
  const input = { inherentLikelihood: 5, inherentImpact: 5, residualLikelihood: 3, residualImpact: 4 };
  assert.equal(scoreProfile(config(), input).target, null);
  assert.throws(() => scoreProfile(config(), { ...input, targetLikelihood: 2 }));
  assert.throws(() => scoreProfile({ ...config(), targetRequired: true }, input));
  const result = scoreProfile(config(), { ...input, targetLikelihood: 2, targetImpact: 2 });
  assert.equal(result.residual.score, 12); assert.equal(result.target?.score, 4);
  assert.equal(result.movement, 'Improving toward target');
});
test('invalid scales, colours, score types, gaps and overlaps fail validation', () => {
  for (const bad of [0, 6, 1.5, '3', null, NaN]) assert.throws(() => scoreRisk(config(), bad, 1));
  const gap = config(); gap.ratingBands[1].minScore = 7; assert.throws(() => validateMethodology(gap));
  const overlap = config(); overlap.ratingBands[1].minScore = 5; assert.throws(() => validateMethodology(overlap));
  const colour = config(); colour.ratingBands[0].colour = 'url(example)'; assert.throws(() => validateMethodology(colour));
  const labels = config(); labels.likelihoodLevels[1].label = 'Rare'; assert.throws(() => validateMethodology(labels));
  assert.throws(() => validateMethodology({ ...config(), scoringMethod: 'custom' }));
  assert.throws(() => validateMethodology({ ...config(), likelihoodLevels: [] }));
  assert.throws(() => validateMethodology({ ...config(), escalationRequiredFromScore: 2 }));
});

import { scoreBand } from '../services/riskMethodologyRules.js';
test('expected residual rating uses the linked scale and rejects invalid values', () => {
  assert.equal(scoreBand(legacyMethodology, 12).label, 'High');
  for (const value of [null, undefined, 0, 26, 1.5, NaN, Infinity]) assert.throws(() => scoreBand(legacyMethodology, value));
  const smaller = { ...legacyMethodology, likelihoodLevels: legacyMethodology.likelihoodLevels.slice(0,3), impactLevels: legacyMethodology.impactLevels.slice(0,3), ratingBands: [{ label:'Elevated',minScore:1,maxScore:9,colour:'#112233',severityOrder:1 }] };
  assert.equal(scoreBand(smaller,9).label,'Elevated');
  assert.throws(() => scoreBand(smaller,10));
});

test('selected preparation-only 5x5 policy boundaries and appetite remain stable', () => {
  const c = validateMethodology(config());
  assert.equal(c.likelihoodLevels.length, 5);
  assert.equal(c.impactLevels.length, 5);
  assert.equal(c.appetiteMaxScore, 11);
  // 11 and 19 are band boundaries, not attainable 5x5 multiplication products.
  for (const [score, rating] of [[5, 'Low'], [6, 'Medium'], [11, 'Medium'], [12, 'High'], [19, 'High'], [20, 'Critical'], [25, 'Critical']] as const) {
    assert.equal(scoreBand(c, score).label, rating);
  }
  for (let likelihood = 1; likelihood <= 5; likelihood++) {
    for (let impact = 1; impact <= 5; impact++) {
      const result = scoreRisk(c, likelihood, impact);
      assert.equal(result.outsideAppetite, result.score >= 12);
      assert.equal(result.treatmentRequired, result.score >= 12);
      assert.equal(result.escalationRequired, result.score >= 20);
    }
  }
});

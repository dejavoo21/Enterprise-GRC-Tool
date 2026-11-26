import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('review-due predicate uses authoritative review state and next-review date', () => {
  const helper = readFileSync('../frontend/src/lib/riskReview.ts', 'utf8');
  assert.match(helper, /\['review_due', 'overdue', 'reassessment_required'\]/);
  assert.match(helper, /risk\.status === 'closed' \|\| risk\.status === 'cancelled'/);
  assert.match(helper, /risk\.reviewStatus && DUE_REVIEW_STATUSES\.has\(risk\.reviewStatus\)/);
  assert.match(helper, /if \(!risk\.nextReviewDate\) return false/);
  assert.match(helper, /Date\.parse\(risk\.nextReviewDate\)/);
  assert.doesNotMatch(helper, /risk\.dueDate/);
});

test('landing count and matrix destination share the review-due predicate', () => {
  const landing = readFileSync('../frontend/src/pages/RiskWorkspaceLanding.tsx', 'utf8');
  const matrix = readFileSync('../frontend/src/pages/RiskMatrix.tsx', 'utf8');
  assert.match(landing, /risks\.filter\(\(risk\) => isRiskReviewDue\(risk\)\)/);
  assert.doesNotMatch(landing, /Boolean\(risk\.dueDate\)/);
  assert.match(matrix, /scoped\.filter\(risk => isRiskReviewDue\(risk\)\)/);
  assert.match(matrix, /risks=\{visibleRisks\}/);
  assert.doesNotMatch(matrix, /Review context is retained/);
  assert.doesNotMatch(matrix, /routeReady/);
});

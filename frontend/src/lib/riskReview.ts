import type { RiskIntelligenceRiskSummary } from '../types/riskIntelligence';

const DUE_REVIEW_STATUSES = new Set(['review_due', 'overdue', 'reassessment_required']);

export function isRiskReviewDue(risk: RiskIntelligenceRiskSummary, now = Date.now()) {
  if (risk.status === 'closed' || risk.status === 'cancelled') return false;
  if (risk.reviewStatus && DUE_REVIEW_STATUSES.has(risk.reviewStatus)) return true;
  if (!risk.nextReviewDate) return false;
  const reviewAt = Date.parse(risk.nextReviewDate);
  return Number.isFinite(reviewAt) && reviewAt <= now;
}

type ReviewDates = { lastReviewedAt?: string | null; collectedAt?: string | null };

// Preserve the dashboard's review-tolerance policy; automation freshness is separate.
export function isEvidenceOutsideReviewTolerance(item: ReviewDates, now = Date.now()): boolean {
  const value = item.lastReviewedAt || item.collectedAt;
  if (!value) return true;
  const reviewed = new Date(value).getTime();
  return Number.isNaN(reviewed) || (now - reviewed) / 86400000 > 120;
}

const COMPLETED_STATUSES = new Set(['completed', 'passed', 'exempted']);
const OVERDUE_STATUSES = new Set(['overdue', 'expired', 'refresher_required']);
const CLOSED_STATUSES = new Set(['completed', 'passed', 'exempted', 'cancelled']);
const ACTIVE_CAMPAIGN_STATUSES = new Set(['active', 'in_progress']);

export function isCompletedTrainingStatus(status: string | null | undefined): boolean {
  return status ? COMPLETED_STATUSES.has(status) : false;
}

export function isOverdueTrainingStatus(status: string | null | undefined): boolean {
  return status ? OVERDUE_STATUSES.has(status) : false;
}

export function isClosedTrainingStatus(status: string | null | undefined): boolean {
  return status ? CLOSED_STATUSES.has(status) : false;
}

export function isDerivedTrainingOverdue(
  dueAt: string | null | undefined,
  status: string | null | undefined,
  completedAt?: string | null | undefined,
): boolean {
  if (isCompletedTrainingStatus(status) || isClosedTrainingStatus(status) || completedAt) {
    return false;
  }

  if (isOverdueTrainingStatus(status)) {
    return true;
  }

  if (!dueAt) {
    return false;
  }

  const dueTime = new Date(dueAt).getTime();
  return Number.isFinite(dueTime) && dueTime < Date.now();
}

export function isActiveCampaignStatus(status: string | null | undefined): boolean {
  return status ? ACTIVE_CAMPAIGN_STATUSES.has(status) : false;
}

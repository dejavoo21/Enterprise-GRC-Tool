import type { DashboardIssueRecord, DashboardIssueStatus } from '../types/models.js';

export function validateActionStatusChange(action: DashboardIssueRecord, nextStatus: DashboardIssueStatus): string | null {
  if (action.sourceManaged && nextStatus !== action.status) {
    return 'Source-managed action status must be changed in its authoritative source workflow.';
  }
  return null;
}

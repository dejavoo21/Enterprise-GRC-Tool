import type { DashboardIssueRecord, DashboardIssueStatus } from '../types/models.js';

const TERMINAL = new Set<DashboardIssueStatus>(['Completed', 'Cancelled']);

export function validateActionStatusChange(action: DashboardIssueRecord, nextStatus: DashboardIssueStatus): string | null {
  if (action.sourceManaged && TERMINAL.has(nextStatus) && !TERMINAL.has(action.status)) {
    return 'Source-managed actions must be completed or cancelled in their authoritative source workflow.';
  }
  return null;
}

export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
export type ReportAction = 'submit' | 'review' | 'approve' | 'reject';
export class ReportWorkflowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function nextReportStatus(report: { status: ReportStatus; prepared_by: string; reviewed_by?: string | null }, action: ReportAction, actor: string, comment: unknown): ReportStatus {
  if (typeof comment !== 'string' || comment.trim().length < 3 || comment.length > 2000) throw new ReportWorkflowError('Enter a review comment between 3 and 2000 characters.');
  if (action === 'submit' && report.status === 'draft') return 'submitted';
  if (actor === report.prepared_by) throw new ReportWorkflowError('The preparer cannot review or approve their own report.', 403);
  if (action === 'review' && report.status === 'submitted') return 'reviewed';
  if (action === 'approve' && report.status === 'reviewed') {
    if (actor === report.reviewed_by) throw new ReportWorkflowError('Approval requires a different user from the reviewer.', 403);
    return 'approved';
  }
  if (action === 'reject' && ['submitted','reviewed'].includes(report.status)) return 'rejected';
  throw new ReportWorkflowError('This action is not valid for the current report status.', 409);
}

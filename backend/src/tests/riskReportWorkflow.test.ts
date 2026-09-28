import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReportStatus, ReportWorkflowError, type ReportStatus } from '../services/riskReportWorkflow.js';

const report = (status: ReportStatus) => ({ status, prepared_by: 'author', reviewed_by: 'reviewer' });
const denied = (status: number) => (error: unknown) => error instanceof ReportWorkflowError && error.status === status;
test('report workflow follows draft, submission, review and independent approval', () => {
  assert.equal(nextReportStatus(report('draft'), 'submit', 'author', 'Ready for review'), 'submitted');
  assert.equal(nextReportStatus(report('submitted'), 'review', 'reviewer', 'Sources checked'), 'reviewed');
  assert.equal(nextReportStatus(report('reviewed'), 'approve', 'approver', 'Approved for committee'), 'approved');
});
test('preparer cannot self-review or self-approve', () => {
  assert.throws(() => nextReportStatus(report('submitted'), 'review', 'author', 'Checked'), denied(403));
  assert.throws(() => nextReportStatus(report('reviewed'), 'approve', 'author', 'Approved'), denied(403));
});
test('reviewer cannot perform final approval', () => {
  assert.throws(() => nextReportStatus(report('reviewed'), 'approve', 'reviewer', 'Approved'), denied(403));
});
test('cannot skip review or change final decisions', () => {
  for (const status of ['draft', 'submitted', 'approved', 'rejected'] as const) {
    assert.throws(() => nextReportStatus(report(status), 'approve', 'approver', 'Approved'), denied(409));
  }
});
test('requires meaningful bounded comments', () => {
  for (const comment of [null, '', '  x  ', 'x'.repeat(2001)]) {
    assert.throws(() => nextReportStatus(report('draft'), 'submit', 'author', comment), denied(400));
  }
});
test('rejection is possible only during review', () => {
  assert.equal(nextReportStatus(report('submitted'), 'reject', 'reviewer', 'Needs correction'), 'rejected');
  assert.equal(nextReportStatus(report('reviewed'), 'reject', 'approver', 'Needs correction'), 'rejected');
  assert.throws(() => nextReportStatus(report('approved'), 'reject', 'approver', 'Withdraw'), denied(409));
});

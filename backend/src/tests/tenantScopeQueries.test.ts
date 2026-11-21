import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import * as actionsRepo from '../repositories/riskActionsRepo.js';
import * as reportsRepo from '../repositories/reportingCenterRepo.js';
import * as reviewTasksRepo from '../repositories/reviewTasksRepo.js';
import * as archiveRepo from '../repositories/riskReportArchiveRepo.js';

type QueryCall = { text: string; values: unknown[] };

function captureQueries(rowsFor: (text: string, values: unknown[]) => unknown[] = () => []) {
  const original = pool.query.bind(pool);
  const calls: QueryCall[] = [];
  pool.query = (async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const rows = rowsFor(text, values);
    return { rows, rowCount: rows.length } as never;
  }) as typeof pool.query;
  return { calls, restore: () => { pool.query = original; } };
}

test('filtered searches and aggregate sources keep workspace as the leading predicate', async () => {
  const capture = captureQueries();
  try {
    await reviewTasksRepo.getReviewTasks('workspace-a', {
      status: 'open',
      assignee: 'member-a',
      documentId: 'document-a',
    });
    await actionsRepo.list('workspace-a', { status: 'Open', priority: 'High', overdue: true });

    const reviewQuery = capture.calls.find((call) => call.text.includes('SELECT * FROM review_tasks'))!;
    assert.match(reviewQuery.text, /WHERE workspace_id = \$1/);
    assert.match(reviewQuery.text, /status = \$2/);
    assert.match(reviewQuery.text, /assignee ILIKE \$3/);
    assert.deepEqual(reviewQuery.values, ['workspace-a', 'open', '%member-a%', 'document-a']);

    const actionQuery = capture.calls.find((call) => call.text.includes('SELECT * FROM risk_actions WHERE'))!;
    assert.match(actionQuery.text, /workspace_id=\$1/);
    assert.match(actionQuery.text, /status=\$2/);
    assert.match(actionQuery.text, /priority=\$3/);
    assert.deepEqual(actionQuery.values, ['workspace-a', 'Open', 'High']);
  } finally {
    capture.restore();
  }
});

test('foreign report detail and mutation attempts remain scoped to the caller workspace', async () => {
  const capture = captureQueries();
  try {
    assert.equal(await reportsRepo.getGeneratedReport('workspace-a', 'report-b'), null);
    assert.equal(await reportsRepo.updateGeneratedReportStatus('workspace-a', 'report-b', 'approved'), null);
    await reportsRepo.listGeneratedReports('workspace-a');

    const detail = capture.calls.find((call) => call.text.includes('FROM generated_reports') && call.text.includes('id = $2'))!;
    assert.match(detail.text, /workspace_id = \$1 AND id = \$2/);
    assert.deepEqual(detail.values, ['workspace-a', 'report-b']);
    const mutation = capture.calls.find((call) => call.text.includes('UPDATE generated_reports'))!;
    assert.match(mutation.text, /WHERE workspace_id = \$1 AND id = \$2/);
    assert.deepEqual(mutation.values, ['workspace-a', 'report-b', 'approved']);
    const list = capture.calls.find((call) => call.text.includes('ORDER BY created_at DESC'))!;
    assert.deepEqual(list.values, ['workspace-a']);
  } finally {
    capture.restore();
  }
});

test('foreign actions cannot be read or changed and no mutation is attempted', async () => {
  const capture = captureQueries();
  try {
    assert.equal(await actionsRepo.update('workspace-a', 'action-b', { status: 'Completed' }), null);
    const lookup = capture.calls.find((call) => call.text.includes('(id=$2 OR action_ref=$2)'))!;
    assert.deepEqual(lookup.values, ['workspace-a', 'action-b']);
    assert.equal(capture.calls.some((call) => call.text.includes('UPDATE risk_actions SET')), false);
  } finally {
    capture.restore();
  }
});

test('review task creation atomically rejects a document outside the workspace', async () => {
  const capture = captureQueries();
  try {
    await assert.rejects(
      reviewTasksRepo.createReviewTask('workspace-a', {
        documentId: 'document-b',
        title: 'Foreign document review',
        assignee: 'Member A',
        assigneeEmail: 'member-a@example.invalid',
        dueAt: '2026-12-01',
      }),
      /Document is unavailable in this workspace/,
    );
    const insert = capture.calls.find((call) => call.text.includes('INSERT INTO review_tasks'))!;
    assert.match(insert.text, /WHERE EXISTS/);
    assert.match(insert.text, /governance_documents WHERE workspace_id = \$2 AND id = \$3/);
    assert.equal(insert.values[1], 'workspace-a');
    assert.equal(insert.values[2], 'document-b');
  } finally {
    capture.restore();
  }
});

test('report archive pagination, counts, and detail retrieval remain workspace scoped', async () => {
  const capture = captureQueries((text) => text.includes('COUNT(*)') ? [{ count: 0 }] : []);
  try {
    const page = await archiveRepo.listReports('workspace-a', 2);
    assert.deepEqual(page, { items: [], total: 0, page: 2 });
    await assert.rejects(archiveRepo.getReport('workspace-a', 'report-b'), /Report not found/);

    const list = capture.calls.find((call) => call.text.includes('FROM risk_report_snapshots') && call.text.includes('OFFSET'))!;
    assert.match(list.text, /WHERE workspace_id=\$1/);
    assert.deepEqual(list.values, ['workspace-a', 20]);
    const count = capture.calls.find((call) => call.text.includes('COUNT(*)'))!;
    assert.deepEqual(count.values, ['workspace-a']);
    const detail = capture.calls.find((call) => call.text.includes('SELECT * FROM risk_report_snapshots'))!;
    assert.deepEqual(detail.values, ['workspace-a', 'report-b']);
  } finally {
    capture.restore();
  }
});

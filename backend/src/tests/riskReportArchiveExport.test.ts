import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArchivedReportExport } from '../services/riskReportArchiveExport.js';
import type { RiskReportPack } from '../types/riskIntelligence.js';

const original: RiskReportPack = {
  reportType: 'risk_committee_report',
  title: 'Risk Committee Report',
  generatedAt: '2026-11-26T10:00:00.000Z',
  format: 'json',
  metadata: { workspace: 'Synthetic workspace', workspaceId: 'workspace-a', period: 'Current snapshot', preparedBy: 'preparer@example.invalid', classification: 'Confidential', status: 'Draft', version: '2.0' },
  sections: [{ heading: '11. Approval and Sign-off', bullets: ['Draft - not approved.'], table: { columns: ['Field', 'Value'], rows: [['Report status', 'Draft - not approved']] } }],
};

test('archived export reflects recorded review and approval without mutating the snapshot', () => {
  const before = structuredClone(original);
  const pack = buildArchivedReportExport({
    id: 'report-1', status: 'approved', prepared_email: 'preparer@example.invalid', pack: original,
    events: [
      { action: 'generated', actor_email: 'preparer@example.invalid', comment: null, created_at: '2026-11-26T10:00:00.000Z' },
      { action: 'review', actor_email: 'reviewer@example.invalid', comment: 'Reviewed against the source register.', created_at: '2026-11-26T11:00:00.000Z' },
      { action: 'approve', actor_email: 'approver@example.invalid', comment: 'Approved for circulation.', created_at: '2026-11-26T12:00:00.000Z' },
    ],
  });
  const signOff = pack.sections.find(section => section.heading === '11. Approval and Sign-off')!;
  const fields = Object.fromEntries(signOff.table!.rows);
  assert.equal(pack.reviewStatus, 'approved');
  assert.equal(fields['Report status'], 'approved');
  assert.equal(fields['Reviewed by'], 'reviewer@example.invalid');
  assert.equal(fields['Approved by'], 'approver@example.invalid');
  assert.equal(fields['Approval date'], '2026-11-26T12:00:00.000Z');
  assert.match(fields.Comments, /review: Reviewed against the source register/);
  assert.match(fields.Comments, /approve: Approved for circulation/);
  assert.match(signOff.bullets[0], /not a digital signature/);
  assert.equal(pack.sections.at(-1)?.heading, 'Recorded review and approval trail');
  assert.deepEqual(original, before);
});

test('archived export retains truthful unavailable sign-off fields before approval', () => {
  const pack = buildArchivedReportExport({ id: 'report-2', status: 'submitted', prepared_email: 'preparer@example.invalid', pack: original, events: [] });
  const fields = Object.fromEntries(pack.sections[0].table!.rows);
  assert.equal(fields['Reviewed by'], 'Not recorded');
  assert.equal(fields['Approved by'], 'Not recorded');
  assert.equal(fields['Approval date'], 'Not recorded');
  assert.equal(fields['Comments'], 'No review or approval comments recorded');
});

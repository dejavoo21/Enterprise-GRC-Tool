import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRiskReport, isRiskExportFormat } from '../services/riskReportExport.js';
import type { RiskReportPack } from '../types/riskIntelligence.js';

const pack: RiskReportPack = { reportType: 'risk_committee_report', title: 'Risk Committee Report', generatedAt: '2026-09-25T12:00:00Z', format: 'json', sections: [{ heading: 'Summary', bullets: ['Risk R-1: vendor, "review"', '=HYPERLINK("unsafe")', 'No formal approval recorded.'] }] };

test('CSV preserves report details and escapes formulas and quotes', async () => {
  const file = await exportRiskReport(pack, 'csv');
  assert.equal(file.filename, 'risk-committee-report.csv');
  const csv = file.content.toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Risk R-1: vendor, ""review"""'));
  assert.ok(csv.includes('"\'=HYPERLINK(""unsafe"")"'));
  assert.ok(csv.includes('Current snapshot'));
});

test('PDF produces a real PDF and JSON preserves source data', async () => {
  const pdf = await exportRiskReport(pack, 'pdf');
  assert.equal(pdf.contentType, 'application/pdf');
  assert.equal(pdf.content.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.content.toString('latin1').includes('%%EOF'));
  assert.deepEqual(JSON.parse((await exportRiskReport(pack, 'json')).content.toString()), pack);
});

test('Only implemented export formats are accepted', () => {
  for (const format of ['pdf', 'csv', 'json']) assert.equal(isRiskExportFormat(format), true);
  for (const format of ['word', '', null, undefined]) assert.equal(isRiskExportFormat(format), false);
});

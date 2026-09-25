import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

test('Report email requires configuration, validates recipient and attaches the selected file', async (t) => {
  const original = { EMAIL_ENABLED: process.env.EMAIL_ENABLED, SMTP_HOST: process.env.SMTP_HOST, EMAIL_FROM: process.env.EMAIL_FROM };
  let accepted = true;
  const sent: nodemailer.SendMailOptions[] = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (message: nodemailer.SendMailOptions) => {
    sent.push(message);
    return accepted ? { accepted: ['owner@example.invalid'], rejected: [] } : { accepted: [], rejected: ['owner@example.invalid'] };
  } }));
  process.env.EMAIL_ENABLED = 'false';
  process.env.SMTP_HOST = 'mail.example.invalid';
  process.env.EMAIL_FROM = 'reports@example.invalid';
  try {
    const { sendRiskReportEmail, isRiskReportEmailConfigured } = await import('../services/emailService.js');
    const attachment = { filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('test-only') };
    assert.equal(isRiskReportEmailConfigured(), false);
    await assert.rejects(sendRiskReportEmail('owner@example.invalid', 'Report', attachment), /not configured/);
    assert.equal(sent.length, 0);
    process.env.EMAIL_ENABLED = 'true';
    await assert.rejects(sendRiskReportEmail('owner@example.invalid\r\nBcc:other@example.invalid', 'Report', attachment), /invalid/);
    assert.equal(sent.length, 0);
    await sendRiskReportEmail('owner@example.invalid', 'Report', attachment);
    assert.equal(sent[0].to, 'owner@example.invalid');
    assert.deepEqual(sent[0].attachments, [attachment]);
    accepted = false;
    await assert.rejects(sendRiskReportEmail('owner@example.invalid', 'Report', attachment), /did not accept/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

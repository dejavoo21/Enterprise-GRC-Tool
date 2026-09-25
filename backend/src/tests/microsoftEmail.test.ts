import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer from 'nodemailer';
import { sendMicrosoftEmail } from '../services/microsoftEmail.js';

test('Microsoft provider sends attachments without initializing or falling back to SMTP', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalTransport = nodemailer.createTransport;
  Object.assign(process.env, {
    EMAIL_PROVIDER: 'microsoft365', EMAIL_ENABLED: 'true',
    MICROSOFT_TENANT_ID: 'test-tenant', MICROSOFT_CLIENT_ID: 'test-client',
    MICROSOFT_CLIENT_SECRET: 'test-secret', MICROSOFT_EMAIL_FROM: 'onboarding@laflogroup.com',
    MICROSOFT_EMAIL_FROM_NAME: 'LaFlo Advisory', SMTP_HOST: 'must-not-be-used.invalid',
  });
  const requests: { url: string; init?: RequestInit }[] = [];
  let status = 202;
  let tokenStatus = 200;
  nodemailer.createTransport = (() => { throw new Error('SMTP must not be initialized'); }) as typeof nodemailer.createTransport;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return String(input).includes('/token')
      ? new Response(JSON.stringify(tokenStatus === 200 ? { access_token: 'test-token' } : { error: 'sensitive-provider-error' }), { status: tokenStatus })
      : new Response(null, { status });
  };
  try {
    const service = await import('../services/emailService.js');
    assert.equal(service.isRiskReportEmailConfigured(), true);
    await service.sendRiskReportEmail('recipient@example.com', 'Test', { filename: 'test.csv', contentType: 'text/csv', content: Buffer.from('a,b') });
    const payload = JSON.parse(String(requests[1].init?.body));
    assert.match(requests[1].url, /users\/onboarding%40laflogroup.com\/sendMail$/);
    assert.equal(payload.message.from.emailAddress.name, 'LaFlo Advisory');
    assert.equal(payload.message.attachments[0].contentBytes, Buffer.from('a,b').toString('base64'));
    assert.equal(payload.saveToSentItems, true);
    assert.equal(await service.sendMfaOtpEmail({ recipientEmail: 'recipient@example.com', otpCode: '123456', expiresInMinutes: 5 }), true);
    status = 403;
    await assert.rejects(service.sendRiskReportEmail('recipient@example.com', 'Test', { filename: 'test.csv', contentType: 'text/csv', content: Buffer.from('a') }), /HTTP 403/);
    tokenStatus = 401;
    await assert.rejects(sendMicrosoftEmail({ to: 'recipient@example.com', subject: 'Test' }), /^Error: Microsoft email authentication failed \(HTTP 401\)\.$/);
    const before = requests.length;
    await assert.rejects(sendMicrosoftEmail({ to: 'bad\r\n@example.com', subject: 'Test' }), /recipient/);
    await assert.rejects(sendMicrosoftEmail({ to: 'recipient@example.com', subject: 'Test', attachments: [{ filename: 'large.pdf', contentType: 'application/pdf', content: Buffer.alloc(2500001) }] }), /too large/);
    assert.equal(requests.length, before);
    process.env.EMAIL_ENABLED = 'false';
    assert.equal(service.isRiskReportEmailConfigured(), false);
    await assert.rejects(service.sendRiskReportEmail('recipient@example.com', 'Test', { filename: 'a', contentType: 'text/plain', content: Buffer.from('a') }), /not configured/);
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.M365_CLIENT_SECRET;
    process.env.EMAIL_ENABLED = 'true';
    assert.equal(service.isRiskReportEmailConfigured(), false);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    nodemailer.createTransport = originalTransport;
  }
});

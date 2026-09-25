import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';

test('report attachment reaches a loopback SMTP receiver without external delivery', { timeout: 10000 }, async () => {
  const keys = ['EMAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const;
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const sockets = new Set<Socket>();
  let message = '';
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test receiver\r\n');
    let buffer = '';
    let data = false;
    socket.on('data', chunk => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (data) {
          if (line === '.') { data = false; socket.write('250 captured locally\r\n'); }
          else message += `${line}\r\n`;
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250 localhost\r\n');
        else if (line === 'DATA') { data = true; socket.write('354 send message\r\n'); }
        else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    Object.assign(process.env, { EMAIL_ENABLED: 'true', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(address.port), SMTP_USER: '', SMTP_PASS: '', EMAIL_FROM: 'reports@example.invalid' });
    const { sendRiskReportEmail } = await import('../services/emailService.js');
    const content = Buffer.from('risk,score\r\nSynthetic risk,4\r\n');
    await sendRiskReportEmail('recipient@example.invalid', 'Local audit', { filename: 'risk-report.csv', contentType: 'text/csv', content });
    assert.match(message, /To: recipient@example\.invalid/);
    assert.match(message, /Subject: LAFLO: Local audit/);
    assert.match(message, /filename=risk-report\.csv/);
    assert.ok(message.includes(content.toString('base64')));
    assert.match(message, /not evidence of formal approval/);
  } finally {
    for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

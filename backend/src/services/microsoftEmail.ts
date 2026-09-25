export interface MicrosoftMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; contentType: string; content: Buffer }[];
}

function configuration() {
  return {
    tenant: process.env.MICROSOFT_TENANT_ID || process.env.M365_TENANT_ID,
    client: process.env.MICROSOFT_CLIENT_ID || process.env.M365_CLIENT_ID,
    secret: process.env.MICROSOFT_CLIENT_SECRET || process.env.M365_CLIENT_SECRET,
    from: process.env.MICROSOFT_EMAIL_FROM,
    name: process.env.MICROSOFT_EMAIL_FROM_NAME || 'LaFlo Advisory',
  };
}

const validEmail = (value: string) => /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value);

export function isMicrosoftEmailConfigured(): boolean {
  const c = configuration();
  return Boolean(c.tenant && /^[a-zA-Z0-9.-]+$/.test(c.tenant) && c.client && c.secret && c.from && validEmail(c.from));
}

export async function verifyMicrosoftEmailAuthentication(): Promise<string> {
  if (!isMicrosoftEmailConfigured()) throw new Error('Microsoft email configuration is incomplete.');
  const c = configuration();
  let response: Response;
  try {
    response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant!)}/oauth2/v2.0/token`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: c.client!, client_secret: c.secret!, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
    });
  } catch {
    throw new Error('Microsoft email authentication request failed.');
  }
  if (!response.ok) throw new Error(`Microsoft email authentication failed (HTTP ${response.status}).`);
  const data = await response.json().catch(() => ({})) as { access_token?: string };
  if (!data.access_token || typeof data.access_token !== 'string') throw new Error('Microsoft email authentication returned no access token.');
  return data.access_token;
}

export async function sendMicrosoftEmail(message: MicrosoftMessage) {
  if (!validEmail(message.to)) throw new Error('The email recipient is invalid.');
  if ((message.attachments || []).reduce((total, attachment) => total + attachment.content.length, 0) > 2500000) {
    throw new Error('The report is too large for Microsoft email delivery. Download it instead.');
  }
  const token = await verifyMicrosoftEmailAuthentication();
  const c = configuration();
  let response: Response;
  try {
    response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.from!)}/sendMail`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          from: { emailAddress: { address: c.from, name: c.name } },
          toRecipients: [{ emailAddress: { address: message.to } }],
          body: { contentType: message.html ? 'HTML' : 'Text', content: message.html || message.text || '' },
          attachments: message.attachments?.map(attachment => ({
            '@odata.type': '#microsoft.graph.fileAttachment', name: attachment.filename,
            contentType: attachment.contentType, contentBytes: attachment.content.toString('base64'),
          })),
        },
        saveToSentItems: true,
      }),
    });
  } catch {
    // Do not retry an ambiguous send: Microsoft may already have accepted it.
    throw new Error('Microsoft email delivery could not be confirmed. Check Sent Items before retrying.');
  }
  if (response.status !== 202) throw new Error(`Microsoft email delivery was not accepted (HTTP ${response.status}).`);
  return { accepted: [message.to], rejected: [] as string[] };
}

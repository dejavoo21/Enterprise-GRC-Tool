# Microsoft 365 email delivery

Production selects Microsoft Graph with `EMAIL_PROVIDER=microsoft365` and
`EMAIL_ENABLED=true`. Set these secrets/settings in the backend Railway service:

- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET` (secret value, never committed)
- `MICROSOFT_EMAIL_FROM=onboarding@laflogroup.com`
- `MICROSOFT_EMAIL_FROM_NAME=LaFlo Advisory`

The application needs Microsoft Graph application `Mail.Send` permission with
admin consent and access to the sender mailbox. Prefer mailbox-scoped application
access. The existing Hotel application registration is reused with owner consent;
its configuration is not changed. Coordinate credential rotation across both apps.

Reports, reminders, and MFA codes use this provider. No SMTP transport is created
or used when Microsoft is selected, including when Microsoft fails. Legacy SMTP
support remains for explicitly configured installations and isolated tests only.

Graph HTTP 202 means accepted for processing, not confirmed inbox delivery. Sent
messages are saved to Sent Items. Check Microsoft message tracing for delivery
failures. Ambiguous network failures are not retried automatically to avoid
duplicate messages. Report attachments above 2.5 MB are rejected with a download
instruction; upload-session support is not implemented.

Validation: backend TypeScript build and microsoftEmail, riskReportEmail,
riskReportSmtp tests. Production verification uses a non-sensitive test message to
the sender mailbox; recipient receipt must be confirmed separately.

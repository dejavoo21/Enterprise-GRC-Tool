# Risk report delivery

Local implementation; not pushed or deployed.

- Reports support PDF, CSV and existing JSON exports of the current report snapshot.
- CSV uses section/record/field/value rows. Committee template 2.0 includes structured tables and a full-register appendix; other report types retain their existing narratives. Spreadsheet formula prefixes are escaped.
- PDF includes generation time, confidentiality footer and a statement that the snapshot is not formal approval.
- Email attaches the selected format and sends only to the authenticated account address after explicit confirmation.
- Delivery requires authentication, matching workspace, export permission and the existing POST permission gate.
- SMTP must explicitly have EMAIL_ENABLED=true, SMTP_HOST and EMAIL_FROM. SMTP_PORT defaults to 587; credentials use SMTP_USER and SMTP_PASS where required by the mail provider.
- Disabled or rejected delivery returns a failure, not a success. SMTP acceptance is not proof of inbox delivery.
- A per-process one-minute email throttle prevents rapid repeated sends; this is not a distributed rate limiter or durable delivery queue.
- No production configuration changed and no external email sent during validation.

## Validation

- Four automated tests cover PDF/JSON generation, CSV escaping, supported formats and mocked email attachment/configuration/recipient/rejection handling.
- Backend TypeScript build and frontend TypeScript/Vite build checked; frontend ESLint and ten existing methodology/session tests checked.
- Synthetic PDF rendered and visually inspected: readable content and page footer.
- Authenticated local in-app UI generated PDF and CSV prepared-report links; email correctly disabled with SMTP disabled. No browser console errors observed in that check.
- Browser download-to-disk completion remains separately unverified by automation; generation and prepared links are verified.
- Actual SMTP credentials, provider acceptance and inbox receipt require deployment configuration and an explicitly authorized delivery test.

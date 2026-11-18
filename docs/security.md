# Security plan

Security controls must be designed before account, book-file, and payment features are released.

- Hash passwords with a current password-hashing algorithm; never store plaintext passwords.
- Use secure, HttpOnly, SameSite cookies for browser sessions and protect state-changing requests against CSRF.
- Validate and normalize all input at API boundaries; enforce role authorization on the server for every protected resource.
- Store book files in private object storage. Issue short-lived signed URLs only after purchase/entitlement checks.
- Verify payment-provider webhook signatures, make handlers idempotent, and reconcile transactions.
- Record immutable ledger entries for financial events; derive balances from ledger entries.
- Rate-limit authentication and sensitive endpoints; keep secrets outside source control.
- Add audit records for administrative and financial actions, backups, retention controls, and a documented incident process.
- Provide privacy controls, consent-aware author messaging, unsubscribe handling, copyright reports, refunds, and dispute workflows.

This document is a plan. These controls are not yet implemented because the backend has not been started.

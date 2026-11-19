# Current state and next steps

This file records implementation status; the complete requirements remain in the master architecture documents.

## Implemented

- React/Vite frontend with responsive home, book catalogue, search, category filters, and sample book details.
- Gujarati, Hindi, and English interface translations.
- Express/Mongoose API with MongoDB Atlas configuration, health endpoint, book catalogue endpoints, and repeatable sample-book seed command.
- Reader registration, email verification, login, logout, seven-day server-side sessions, profile editing, and password changes. Passwords use Argon2id; sessions use random HttpOnly cookies.
- Transactional email adapter for Resend using server-only RESEND_API_KEY, a verified EMAIL_FROM, and an explicit public APP_BASE_URL. Verification and password-reset links expire after 30 minutes; tokens are stored as hashes and are single-use.
- Registration and password-reset email links work only when all email configuration is present. Without email configuration, development keeps its manual verification/reset-token flow. Production registration and reset remain disabled until email delivery is configured.
- Readers can request a new verification email without revealing whether an email belongs to a pending account. Login and authentication endpoints are rate-limited.
- Signed-in readers can update display name, bio, up to 10 hobbies, and an HTTPS profile-photo URL. Photo upload/storage is not configured. Password changes and resets revoke existing sessions.
- Guest wishlists are browser-local. Signed-in readers can sync saved catalogue books to an account-owned MongoDB wishlist.
- Readers can write one 1–5 star review per catalogue book, edit/delete their own review, report other reviews, and follow/unfollow catalogue authors. Public review summaries omit reader email and credentials.
- Admin-only review moderation routes and page can list reports, resolve them, and hide/restore reviews.
- Signed-in readers can submit a writer application with biography, writing languages, genres, and an optional HTTPS sample link. Applications are rate-limited; pending applications cannot be duplicated, and rejected applications can be resubmitted.
- Admins can view and approve/reject author applications. Approval uses a database transaction to create a public author profile and promote the reader to the author role. Author profile writes require the author role and are rate-limited.
- Approved authors can update their public biography and HTTPS website link. Public author pages show approved profiles and catalogue books under the author's original catalogue credit.
- Authors can create and edit book metadata drafts, save partial drafts, and submit completed details for administrator review. Admins can approve or request changes with a note. Author-owned book routes enforce author role and ownership; admin review routes require an admin role.
- Book submission currently handles metadata only. Cover/manuscript upload, publication to the public catalogue, purchases, and reader access are not implemented by this step.
- No admin account is automatically created; an operator must grant the admin role through a trusted database procedure before using admin pages.
- GitHub Actions runs the repository's existing quality checks on pushes.

## Not implemented

Secure admin provisioning, secure cover/manuscript uploads and publishing workflow, account deletion/export, verified-purchase review labels, helpful-review voting, production email deliverability monitoring, book-file storage and reading, purchases/payments, subscriptions, royalty ledger, CMS, affiliates, institutions, audiobooks, AI tools, and mobile apps.

## Next phase

Continue Phase 5: configure private file storage and secure cover/manuscript uploads, complete book approval-to-catalogue publishing, and add the related admin workflow. The storage provider is not selected or configured yet. Configure email secrets and the public frontend URL before enabling production registration or password reset. Follow the phases and Definition of Done in the master architecture.

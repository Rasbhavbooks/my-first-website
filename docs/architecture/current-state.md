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
- Admin-only review moderation routes and page can list reports, resolve them, and hide/restore reviews. No admin account is automatically created; an operator must grant the role through a trusted database procedure.
- GitHub Actions runs the repository's existing quality checks on pushes.

## Not implemented

Author applications and author studio, admin user/role management, account deletion/export, verified-purchase review labels, helpful-review voting, production email deliverability monitoring, book-file storage and reading, purchases/payments, subscriptions, royalty ledger, CMS, affiliates, institutions, audiobooks, AI tools, and mobile apps.

## Next phase

Configure the Codespaces/production email secrets and public frontend URL, then build a reviewed author application flow and secure admin provisioning. Keep public registration and reset disabled in production until email delivery and its verified sender are configured. Follow the phases and Definition of Done in the master architecture.

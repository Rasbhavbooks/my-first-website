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
- The admin dashboard shows aggregate counts for active accounts, readers, authors, catalogue books, pending author applications, pending book reviews, and pending review reports. These counts are available only to authenticated admins.
- Admins can search and filter user accounts by name, email, role, and status. The user list exposes only basic account fields; admins can suspend or restore verified reader/author accounts, and suspension revokes all of that user's active sessions. Admin accounts, the current admin, and unverified accounts cannot be changed from this page.
- Admins can search author storefronts and view follower, public-catalogue, draft, and submitted-book totals. They can suspend/restore author profiles; suspension hides the public storefront and blocks author-only API routes while preserving the account. A suspended user account must be restored before its author profile can be restored.
- Signed-in readers can submit a writer application with biography, writing languages, genres, and an optional HTTPS sample link. Applications are rate-limited; pending applications cannot be duplicated, and rejected applications can be resubmitted.
- Admins can view and approve/reject author applications. Approval uses a database transaction to create a public author profile and promote the reader to the author role. Author profile writes require the author role and are rate-limited.
- Approved authors can update their public biography, HTTPS website link, profile photo URL, and storefront cover image URL. They can feature up to three books from their existing public catalogue. Public author pages show approved profiles, profile branding, catalogue books under the author's original catalogue credit, and follower counts. The Author Studio shows aggregate follower totals, new followers over the last 7 and 30 days, catalogue-book totals, and author-owned draft/review-status totals without exposing reader identities. Readers can follow active author profiles and open followed authors from their account.
- Authors can create and edit book drafts and submit completed metadata for administrator review. Admins can approve or request changes with a note. Author-owned routes enforce author role and ownership; admin review routes require admin access.
- Author book drafts accept JPEG/PNG/WebP covers up to 5 MB and PDF manuscripts up to 25 MB. The API checks MIME type and file signatures, requires a successful ClamAV scan, then stores files in a private Cloudflare R2 bucket. MongoDB stores metadata and private object keys; API responses never expose keys or public object URLs.
- Authors can retrieve only their own book files; admins can retrieve files for submitted or approved books. Upload endpoints are rate-limited, filenames are sanitized, and downloads are sent as attachments with no-store and nosniff headers.
- Authors can create, edit, and delete up to 100 plain-text chapters per draft, with a 100,000-character limit per chapter. Chapter records are separate from book documents, private to the owning author, and visible to admins only while the book is under review. Public chapter reading is not enabled.
- File upload stays unavailable until R2 credentials and a reachable ClamAV daemon are configured. Admin approval currently records a review decision only; it does not publish to the public catalogue or enable sales/read access.
- A one-time CLI bootstrap can promote an existing active, email-verified reader to the first admin. It requires a typed confirmation, runs only when no admin exists, and is not exposed through the web API.
- GitHub Actions runs the repository's existing quality checks on pushes.

## Not implemented

Category management, full CMS and settings, book publication to the public catalogue, account deletion/export, verified-purchase review labels, helpful-review voting, production email deliverability monitoring, paid reader access and reading, purchases/payments, subscriptions, royalty ledger, CMS, affiliates, institutions, audiobooks, AI tools, and mobile apps.

## Next phase

Continue Phase 6: expand the admin panel with author and book management, then CMS and settings. Phase 5's upload runtime still needs a private Cloudflare R2 bucket and reachable ClamAV daemon. Public book publication remains disabled until the author rights wording is approved. Author storefront profiles, featured catalogue books, follower totals, recent follower growth, and book workflow totals are implemented. Sales analytics require the commerce ledger; remaining CRM features need their privacy and communication preferences defined. Upload code fails closed until both storage and scanning services are configured. Configure email secrets and the public frontend URL before enabling production registration or password reset. Admin book-review access can be initialized through the private one-time CLI bootstrap; admin dashboard aggregate counts are implemented; category management, CMS, and settings remain pending. Follow the phases and Definition of Done in the master architecture.

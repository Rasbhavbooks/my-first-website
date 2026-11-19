# Current state and next steps

This file records implementation status; the complete requirements remain in the master architecture documents.

## Implemented foundation
- React/Vite and Tailwind frontend workspace.
- Responsive homepage with hero, book discovery, categories, author introduction, and footer.
- Book details route for sample catalogue entries, including localized description, price, language, and category.
- Catalogue and API health unit tests, run by GitHub Actions with the frontend build.
- Sample catalogue search and category filtering.
- Reader wishlist with add/remove controls and browser-local persistence; account syncing is pending.
- Gujarati, Hindi, and English UI selection.
- Express API with health and read-only book list/detail endpoints backed by MongoDB; the client requests books through the API and falls back to local sample data if the API is stopped.
- Mongoose Book model validates multilingual titles/descriptions, language, category, author, and price; a repeatable seed command imports the demo catalogue.
- API health endpoint test runs in GitHub Actions.
- MongoDB Atlas connection configuration and a per-database read/write application user.
- Reader User model normalizes email, defaults new accounts to the reader role and pending-verification status, and hashes passwords with Argon2id.
- A responsive reader registration page is available in English, Gujarati, and Hindi and is wired to the development API.
- Development-only reader registration and email-verification endpoints validate inputs and rate-limit requests. Verification tokens are stored as hashes with expiry.
- Reader login checks Argon2id password hashes, blocks unverified accounts, and rate-limits attempts. Successful sign-in creates a seven-day database-backed session with a random HttpOnly, SameSite cookie; logout revokes the session. The frontend supports sign-in, session restore, and sign-out in English, Gujarati, and Hindi.
- Signed-in readers can update their display name, a short bio, up to 10 hobbies, and an HTTPS profile photo URL. Profile data is available in English, Gujarati, and Hindi. Photo uploads and managed image storage are not configured. Readers can also change their password; password changes revoke all existing reader sessions. Account endpoints require a valid server-side session.
- Guest wishlists remain browser-local. Signed-in readers can sync saved catalogue books to an account-owned MongoDB wishlist with validated book references and per-account limits.
- Outbound email, password reset, and production registration are still pending.

## Not implemented
Password reset, account deletion/export, full reader account management, author/admin permissions, book uploads, paid book access, reviews, account-synced reader library, CMS, subscriptions, payments, royalty ledger, affiliates, institutions, audiobooks, AI tools, production storage, and mobile apps.

## Next phase
Add registration, verification, session, profile, password-change, and wishlist synchronization checks; configure email delivery; then extend server-side authorization to author/admin workflows before exposing registration outside development. Admin and paid access remain future work. Do not mark a planned feature complete until it meets the Definition of Done in the master architecture.

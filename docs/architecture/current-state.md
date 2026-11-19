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
- Development-only reader registration and email-verification endpoints validate inputs and rate-limit requests. Verification tokens are stored as hashes with expiry. Outbound email, login/logout sessions, password reset, and production registration are still pending.

## Not implemented
Login/logout sessions, password reset, full reader account management, author/admin permissions, book uploads, paid book access, reviews, account-synced reader library, CMS, subscriptions, payments, royalty ledger, affiliates, institutions, audiobooks, AI tools, production storage, and mobile apps.

## Next phase
Add registration and verification flow checks, configure email delivery, then implement secure login/logout sessions and server-side authorization before exposing registration outside development. Admin and paid access remain future work. Do not mark a planned feature complete until it meets the Definition of Done in the master architecture.

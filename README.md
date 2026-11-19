# Rasbhav Books V3.0

**EVERY BOOK HAS A SOUL**

An Indian digital publishing ecosystem for readers, authors, publishers, affiliates, and educational institutions. Gujarati, Hindi, and English are the initial interface languages.

## Architecture is kept in this repository

The complete product architecture and development roadmap are saved in:

- [Master architecture](docs/architecture/MASTER-ARCHITECTURE.md)
- [Enterprise security architecture](docs/architecture/ENTERPRISE-SECURITY-ARCHITECTURE.md)
- [Current implementation status](docs/architecture/current-state.md)

These documents are the source of truth for future work. Follow the phases in order. Do not implement the whole long-term product at once.

## Current phase

Reader and author foundation: readers can manage profiles, wishlists, reviews, and followed authors. Readers can apply to become authors; admins review applications, and approval unlocks an author profile/studio. Public author pages show profile details and matching catalogue books. Review moderation and transactional Resend email are also available when configured. Admin accounts still require trusted manual provisioning. Production registration and password reset stay disabled until email settings and public app URL are configured.

## Run in GitHub Codespaces

Node.js is required in the Codespace environment, not on your personal computer. In a Codespaces terminal:

```sh
npm install
```

Set these Codespaces secrets, then restart the Codespace:

- `MONGODB_URI` — MongoDB Atlas connection string.
- `RESEND_API_KEY` — private API key from Resend.
- `EMAIL_FROM` — sender address verified with Resend, for example `Rasbhav Books <noreply@your-domain.example>`.
- `APP_BASE_URL` — public HTTPS URL for the frontend on port 5173, without a path.

Set `CLIENT_ORIGIN` to that same frontend origin so the API accepts browser requests. Keep all keys private; never commit them. Without email settings, development returns a manual one-time token. Production will not create accounts or reset passwords until email is configured. Before the first API start, load the sample books once:

```sh
npm run seed:books --workspace @rasbhav/server
```

Start the API in one terminal:

```sh
npm run dev:server
```

Then open a second terminal and start the frontend:

```sh
npm run dev
```

The frontend uses port 5173. The API uses port 4000 and exposes `/api/v1/health`, `/api/v1/books`, `/api/v1/books/:bookId`, registration, verification/resend, login/session/logout, reader profile/password and password-reset routes, account wishlist, book review/report routes, author-follow routes, reader author-application routes, author profile routes, public author profiles, and admin-only review and author-application routes. Without email configuration in development, registration and password reset return short-lived tokens for manual use. With Resend configured, the API emails links instead. Signed-in readers need an active verified account. The API reads books from MongoDB. Without a database connection, health remains available but the book endpoints report that the database is unavailable.

## Local setup

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Copy `server/.env.example` to `server/.env` only when configuring a development database. Never commit real credentials.

## Repository safety

The old Flask site remains in its separate reference repository and must not be changed. All Rasbhav Books V3.0 work belongs here.

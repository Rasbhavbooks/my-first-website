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

Reader engagement foundation: React + Vite, responsive book discovery, Gujarati/Hindi/English UI, Express API, and MongoDB Atlas development storage. Reader accounts include development-only registration and verification, rate-limited login, seven-day database-backed HttpOnly sessions, profile/password settings, and account-synced wishlist. Signed-in readers can review books, report reviews, and follow catalogue authors. Email delivery, password reset, review moderation, commerce, and production registration are not configured.

## Run in GitHub Codespaces

Node.js is required in the Codespace environment, not on your personal computer. In a Codespaces terminal:

```sh
npm install
```

Set the `MONGODB_URI` Codespaces secret and restart the Codespace. Before the first API start, load the sample books once:

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

The frontend uses port 5173. The API uses port 4000 and exposes `/api/v1/health`, `/api/v1/books`, `/api/v1/books/:bookId`, registration/verification, login/session/logout, reader profile and password routes, an authenticated account wishlist, book review/report routes, and authenticated author-follow routes. Registration is development-only until email delivery is configured; in development, it returns a short-lived verification token in the response. Signed-in readers need an active verified account. The API reads books from MongoDB. Without a database connection, health remains available but the book endpoints report that the database is unavailable.

## Local setup

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Copy `server/.env.example` to `server/.env` only when configuring a development database. Never commit real credentials.

## Repository safety

The old Flask site remains in its separate reference repository and must not be changed. All Rasbhav Books V3.0 work belongs here.

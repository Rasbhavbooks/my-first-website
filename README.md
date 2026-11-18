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

Phase 0/1 foundation: React + Vite frontend, mobile-first homepage, sample book discovery, Gujarati/Hindi/English UI, and an Express API for health and the sample book catalogue. The book data is demonstration data. No user accounts, book file storage, purchases, payment gateway, or production MongoDB is connected.

## Run in GitHub Codespaces

Node.js is required in the Codespace environment, not on your personal computer. In a Codespaces terminal:

```sh
npm install
npm run dev
```

The frontend uses port 5173. To run the API in another terminal:

```sh
npm run dev:server
```

The API uses port 4000 and exposes `/api/v1/health`, `/api/v1/books`, and `/api/v1/books/:bookId`. Set the `MONGODB_URI` Codespaces secret and restart the Codespace. Before the first API start, load the sample books once:

```sh
npm run seed:books --workspace @rasbhav/server
```

Then start the API in one terminal and the frontend in another. The API reads books from MongoDB. If no database connection is configured, health remains available but the book endpoints report that the database is unavailable.

## Local setup

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Copy `server/.env.example` to `server/.env` only when configuring a development database. Never commit real credentials.

## Repository safety

The old Flask site remains in its separate reference repository and must not be changed. All Rasbhav Books V3.0 work belongs here.

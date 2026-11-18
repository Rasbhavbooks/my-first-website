# Rasbhav Books V3.0

**Every book has a soul.**

Rasbhav Books is an Indian digital book and author platform for readers and independent authors, starting with Gujarati, Hindi, and English.

## Current foundation

The repository currently contains the responsive React + Vite frontend foundation and homepage:

- Browse a sample catalogue of books
- Search by title, author, category, or language
- Filter books by category
- Switch the interface between Gujarati, Hindi, and English
- View a responsive author/community introduction and newsletter form

The catalogue and newsletter are frontend demonstrations only. No accounts, API, database, payments, or email service are connected yet.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Create a production build with `npm run build`; preview it with `npm run preview`.

## Project layout

- `client/` — React/Vite application
- `client/src/components/` — shared interface components
- `client/src/data/` — sample catalogue and initial UI translations
- `docs/` — architecture, security plan, and roadmap

## Product direction

The planned product includes reader discovery and reading, author storefronts and book management, admin moderation and CMS, membership, payments, and a transaction-level royalty ledger. These features are not implemented yet. See [the architecture](docs/architecture.md), [security plan](docs/security.md), and [roadmap](docs/roadmap.md).

The legacy Flask project in the separate old repository remains reference-only. V3.0 is developed in this repository.

© 2026 Rasbhav Books.

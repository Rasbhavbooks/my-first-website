# Rasbhav Books V3.0 architecture

## Current application

The repository is a modular React/Vite frontend foundation. The homepage, catalogue fixtures, language state, shared layout, routes, and UI components have separate responsibilities.

- `client/src/routes` — route table
- `client/src/layouts` — shared site shell
- `client/src/pages` — page-level screens
- `client/src/components/common` — reusable interface primitives
- `client/src/components/navigation` — header and footer
- `client/src/components/books` — book catalogue UI
- `client/src/context` and `hooks` — shared client state and reusable behavior
- `client/src/services` — data access boundary; currently local sample data
- `client/src/data` — demo fixtures
- `client/src/i18n` — Gujarati, Hindi, and English interface messages
- `client/src/styles` — design tokens and responsive global styles

## Planned backend

Build a modular monolith in `server/` using Node.js, Express, MongoDB, and Mongoose. Feature modules own their routes, validation, services, and models. Shared configuration, authentication middleware, error handling, and logging sit in shared infrastructure. REST APIs should be reusable by a future Expo app.

## Delivery order

1. Frontend foundation and homepage
2. Reader accounts, catalogue API, and reading experience
3. Author profile, book management, and storefront
4. Admin moderation and CMS
5. Orders, verified payment webhooks, royalty ledger, and payouts
6. Analytics, marketing, and mobile client

The current frontend uses demonstration data. There is no server, database, account system, payment integration, or email delivery yet.

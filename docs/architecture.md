# Rasbhav Books V3.0 — Architecture

## Current foundation
The repository starts as a React + Vite client in `client/`. The first release is a responsive discovery homepage with a local sample catalogue and Gujarati, Hindi, and English interface copy. React Router is installed for upcoming reader, author, and admin routes; no server or persistent data is connected yet.

## Planned modular monolith
When backend work begins, keep one deployable Express application with feature modules under `server/src/modules/`. Modules should own their routes, validation, services, and Mongoose models. Shared authentication, configuration, logging, and error handling belong in shared middleware/services. Keep REST interfaces reusable by a future Expo client.

## Frontend boundaries
- `client/src/components`: reusable UI
- `client/src/pages`: route-level views as the product grows
- `client/src/data`: temporary presentation fixtures; replace with API services
- `client/src/i18n`: translation dictionaries and locale helpers when the catalogue expands
- `client/src/styles.css`: design tokens, responsive styles, and current homepage system

## First milestones
1. Foundation and discovery homepage (this change)
2. Reader accounts, catalogue API, and reading experience
3. Author studio and book submission workflow
4. Admin moderation and CMS
5. Orders, verified payment webhooks, royalty ledger, and payouts
6. Analytics, marketing, and mobile client

Payment, authentication, book storage, membership, and royalty flows are not implemented in this foundation.

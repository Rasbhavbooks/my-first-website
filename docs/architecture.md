# Rasbhav Books V3.0 architecture

## Frontend

The React/Vite client separates route definitions, layouts, pages, reusable UI, language state, hooks, data access, translations, and styling.

- `client/src/routes` — route table
- `client/src/layouts` — shared site shell
- `client/src/pages` — page-level screens
- `client/src/components` — common, navigation, and book UI
- `client/src/context` and `hooks` — shared client state and behavior
- `client/src/services` — data access boundary (currently demo fixtures)
- `client/src/data` and `i18n` — catalogue fixtures and translations
- `client/src/styles` — design tokens and responsive styles

## Backend

The Node.js/Express server is a modular monolith. Each feature module owns its routes and controller/service/model as it grows. Shared environment configuration, database connection, and middleware live in `server/src/config` and `server/src/middleware`. The first module is a health endpoint under `/api/v1/health`.

MongoDB is optional for the health endpoint. Set `MONGODB_URI` to connect the server to a database. No business collections or account routes exist yet.

## Delivery order

1. Frontend foundation and homepage
2. API/database foundation
3. Reader accounts, catalogue API, and reading experience
4. Author profile, book management, and storefront
5. Admin moderation and CMS
6. Orders, verified payment webhooks, royalty ledger, and payouts
7. Analytics, marketing, and mobile client

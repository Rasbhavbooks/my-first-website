# Planned REST API

No API server is implemented yet. This document records the initial resource boundaries.

- `/api/v1/auth` — registration, login, logout, current session
- `/api/v1/books` — public catalogue, filters, book detail, preview
- `/api/v1/authors/:slug` — public author profile and storefront
- `/api/v1/reader` — wishlist, follows, history, reviews, purchases
- `/api/v1/author` — profile and book management
- `/api/v1/admin` — protected moderation and CMS
- `/api/v1/orders` — checkout and reader order history
- `/api/v1/webhooks` — signed, idempotent payment-provider events

All write endpoints will validate input and enforce authorization on the server. API responses should use a consistent error envelope and avoid exposing private account, file, or payment data.

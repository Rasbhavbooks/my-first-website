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

Phase 6 — admin and CMS is implemented; Phase 7 — Commerce & Membership is in progress. Phase 5's author workflow is implemented, and initial admin user management is now available. Admins can search/filter accounts, manage author storefronts, edit existing catalogue metadata, manage localized categories, static CMS pages, three-language blog publishing, public site name and support email, maintenance mode and the default language for new visitors, localized homepage search titles and descriptions plus client-side canonical/Open Graph/Twitter tags and structured data, homepage hero/announcement content, header navigation, footer copy/browse links, an editable community footer column, homepage section visibility/order, a featured-books widget for existing catalogue books, and up to four custom localized homepage sections backed by the scanned media library, view workflow totals and configuration readiness without seeing secret values, and suspend/restore verified accounts and author profiles; publishing remains disabled until rights wording is approved. Admins can write a Gujarati, Hindi, and English description for each category. The public catalogue has localized category pages with category-filtered books. Homepage and category listings load search results from the API in pages of 24, with a browser catalogue fallback when the API is offline. Visitors can optionally allow catalogue-matching anonymous search counts; raw search terms are not linked to account/IP records, expire after 90 days, and are shown as trends only after three searches. reader and author foundation is implemented, including profiles, wishlists, reviews, author applications, and public author pages. Authors can update storefront branding, feature books from their existing public catalogue, view follower and book-workflow totals, prepare drafts, and submit files for admin review. Admins can set new cover upload limits from 1–10 MB and PDF manuscript limits from 1–25 MB; the defaults are 5 MB and 25 MB. Uploads use private Cloudflare R2 storage and ClamAV scanning, and stay disabled until both services are configured. Admin approval does not publish books until the author rights wording is approved. The first admin can be set up with the private, one-time CLI command below. Administrator pages require authenticator MFA and the persistent `ADMIN_MFA_ENCRYPTION_KEY` secret. Production registration and password reset stay disabled until email settings and the public app URL are configured.

Phase 7 groundwork now has provider-neutral order, payment-attempt and verified-payment-event models plus a balanced append-only ledger model; checkout remains unavailable. Initial sales scope: digital eBooks sold one book at a time. Print-on-demand and monthly reader membership are deferred. Order/payment/ledger persistence models are groundwork only; there is no checkout or payment API. Checkout remains disabled until the payment gateway, pricing, revenue split, tax/refund terms, and author-rights wording are approved.

## Run in GitHub Codespaces

Node.js is installed in the Codespace; it is not required on your personal computer. The repository dev container starts the Node workspace and a private ClamAV service on an internal Docker network. ClamAV port 3310 is not forwarded or published to the internet. The first start may take a few minutes while ClamAV initializes its virus definitions.

After this devcontainer configuration is merged, rebuild/reopen an existing Codespace once to apply it. The devcontainer sets `CLAMAV_HOST` and `CLAMAV_PORT` for the API; do not add them as Codespaces secrets.

In a Codespaces terminal, install the project dependencies:

```sh
npm install
```

Set these Codespaces secrets, then restart the Codespace:

- `MONGODB_URI` — MongoDB Atlas connection string.
- `ADMIN_MFA_ENCRYPTION_KEY` — a private 32-byte encryption key, generated with the command below.
- `RESEND_API_KEY` — private API key from Resend.
- `EMAIL_FROM` — sender address verified with Resend, for example `Rasbhav Books <noreply@your-domain.example>`.
- `APP_BASE_URL` — public HTTPS URL for the frontend on port 5173, without a path.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` — credentials and private bucket name from Cloudflare R2.

Generate the admin MFA key once in the Codespaces terminal:
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Save the 64-character output as the Codespaces secret `ADMIN_MFA_ENCRYPTION_KEY`, then restart the Codespace. Keep a secure backup of this key: administrator authenticator secrets are encrypted with it, so losing it prevents admin sign-ins until the MFA credentials are reset through a recovery procedure. Never commit the generated value or paste it into chat.

The upload API fails closed until R2 is configured and ClamAV is reachable. Create the R2 bucket as private and create a scoped R2 API token for that bucket. Never put R2 credentials in frontend variables or commit them. The admin readiness page checks the R2 connection only when an admin clicks its button; each check is one read-only `HeadBucket` Class B request. See [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) for current allowances and rates. For local development outside Codespaces or production, configure a private reachable ClamAV daemon in the server environment; never expose its TCP port publicly. `server/.env.example` lists all server settings.

Set `CLIENT_ORIGIN` to that same frontend origin so the API accepts browser requests. Keep all keys private; never commit them. Without email settings, development returns a manual one-time token. Production will not create accounts or reset passwords until email is configured. Before the first API start, load the sample books once:

```sh
npm run seed:books --workspace @rasbhav/server
```

Start the API and frontend together in one terminal:

```sh
npm run dev:all
```

Open the forwarded frontend port **5173**. The API runs on port **4000**. Press **Ctrl+C** in the terminal to stop both.

The frontend uses port 5173. The API uses port 4000 and exposes `/api/v1/health`, `/api/v1/categories`, opt-in aggregate search trends at `/api/v1/search-trends`, `/api/v1/pages`, `/api/v1/books`, `/api/v1/books/:bookId` and related-book recommendations, registration, verification/resend, login/session/logout, reader profile/password, private profile-photo upload/view/removal, account-data export, active-session listing/revocation, and password-reset routes, account wishlist, book review/report routes, author-follow routes, reader author-application routes, author profile routes, public author profiles, author-owned book draft/file/chapter routes, and admin dashboard aggregate metrics, paginated MFA-protected admin activity history at `/api/v1/admin/audit-logs`, MFA-protected recent admin session inventory at `/api/v1/admin/security/sessions`, user-management, author-management, catalogue-management, category-management, CMS page, homepage site-settings, review, author-application, and book-review routes. Activity history records successful admin writes using a sanitized route and internal admin ID; it does not store request bodies, query values, or IP addresses. Plain-text chapter drafts remain private to their authors and the review team; no public chapter reading is enabled. Without email configuration in development, registration and password reset return short-lived tokens for manual use. With Resend configured, the API emails links instead. Signed-in readers need an active verified account. Readers can upload a private JPEG, PNG, or WebP profile photo up to 5 MB; uploads require a clean ClamAV scan and configured private Cloudflare R2 storage, and the file is available only to its owner. The API reads books from MongoDB. Without a database connection, health remains available but the book endpoints report that the database is unavailable.

## First admin account

Create and verify a normal reader account first. With the API's private `MONGODB_URI` configured, run this once in the repository terminal:

```sh
npm run admin:bootstrap
```

Enter that verified account's email, then type the exact confirmation phrase shown by the command. The command only promotes an active, verified reader when no admin account exists. It does not create a public admin registration page or change the account password. Afterward, sign in through the separate admin login page.

## Local setup

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev:all
```

Copy `server/.env.example` to `server/.env` only when configuring a development database. Never commit real credentials.

## Repository safety

The old Flask site remains in its separate reference repository and must not be changed. All Rasbhav Books V3.0 work belongs here.

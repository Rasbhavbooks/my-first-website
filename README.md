# Rasbhav Books V3.0

**Every book has a soul.**

A digital book and author platform for readers and independent authors, starting with Gujarati, Hindi, and English.

## Current foundation

- Responsive React + Vite homepage with a sample book catalogue
- Search and category filters
- Gujarati, Hindi, and English UI language selection
- Modular Express API foundation with a health endpoint
- MongoDB connection configuration, ready for a connection string

The sample catalogue is local demo data. Reader accounts, book uploads, payments, and email delivery are not implemented.

## Run in GitHub Codespaces

The repository needs Node.js 20.19+ or 22.12+ in the development environment. In the Codespaces terminal:

```sh
npm install
npm run dev
```

The frontend runs on port 5173. To start the API in a second terminal:

```sh
npm run dev:server
```

The API listens on port 4000. Check `/api/v1/health` on that port. Without a MongoDB URI, the API starts in database-disconnected mode.

## Run locally

```sh
npm install
npm run dev
```

Create a local `server/.env` from `server/.env.example` to configure MongoDB. Never commit real secrets or credentials.

## Project layout

- `client/` — modular React/Vite application
- `server/src/config/` — environment and database setup
- `server/src/modules/` — API feature modules
- `server/src/middleware/` — shared request and error handling
- `docs/` — architecture, API plan, database plan, security, and roadmap

The legacy Flask project lives in a separate reference repository. V3.0 is developed here.

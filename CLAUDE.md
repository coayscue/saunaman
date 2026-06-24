# Sauna Man SF

Booking platform for **Sauna Man SF** — mobile sauna sessions at San Francisco beaches. Customers book seats in public sauna events or reserve private sessions, sign liability waivers, pay via Stripe, donate, pay invoices, and leave reviews. An admin dashboard (behind a secret URL) manages events, users, reservations, donations, and invoices.

## Architecture

Two apps in one repo, run together in dev:

- **`server/`** — Express 5 + Mongoose REST API on **port 5001**. Talks to a local **MongoDB** database named `saunaman`. See [server/CLAUDE.md](server/CLAUDE.md).
- **`client/`** — React 18 + Vite single-page app on **port 3000**. See [client/CLAUDE.md](client/CLAUDE.md).

In dev, Vite proxies `/api` → `http://localhost:5001`. In prod the client points at `https://api.saunaman-sf.com/api`.

External services: **Stripe** (payments, refunds), **Resend** (transactional email + `.ics` calendar invites), **Google Maps** (location picker).

## Running

All commands run from the repo root:

```bash
npm run dev      # both server (nodemon) + client (vite) via concurrently
npm run server   # API only, port 5001
npm run client   # SPA only, port 3000
npm start        # production server entry (node server/index.js)
```

MongoDB must be running locally (`mongodb://localhost:27017/saunaman` by default). `mongosh` is available for inspecting data.

## Environment

Secrets live in `.env` at the repo root (gitignored). Keys in use:

| Var | Used by |
|---|---|
| `MONGO_URI` | server DB connection |
| `STRIPE_SECRET_KEY` | server — payment intents, refunds |
| `STRIPE_PUBLISHABLE_KEY` | reference (client uses its own `VITE_` var) |
| `RESEND_API_KEY` | server email |
| `APP_URL` | server — links in emails |
| `PORT` | server (default 5001) |
| `ADMIN_PATH` | server — the secret admin URL path |

The client reads `VITE_STRIPE_PUBLISHABLE_KEY` and `VITE_GOOGLE_MAPS_API_KEY` from Vite's env (both have fallbacks in code; the Stripe one falls back to a test key).

## Conventions that span both apps

- **All Mongo `_id` fields are string UUIDs**, not ObjectIds. References between models are stored as `String` with a `ref`. Never assume ObjectId behavior.
- **Money is handled in dollars** everywhere in app code (model fields, request bodies, UI). Conversion to cents happens only at the Stripe boundary (`utils/stripe.js`).
- Server is **CommonJS** (`require`); client is **ESM JSX** (`import`).
- There is no configured linter/formatter task and no real test suite beyond Create React App defaults — don't assume `npm test`/`npm run lint` do anything meaningful.

## Project skills

- **`/prompt-to-pr <description>`** — implement a change, validate it end-to-end, and open a GitHub PR with a populated test plan. See [.claude/skills/prompt-to-pr/](.claude/skills/prompt-to-pr/).
- **`/validate`** — run the app, drive the UI with Playwright, instrument data flow, verify the DB, and produce a test plan. See [.claude/skills/validate/](.claude/skills/validate/).

`.validation/` holds run artifacts (screenshots, logs, test plans) produced by these skills.

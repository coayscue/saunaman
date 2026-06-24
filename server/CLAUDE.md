# server/ — Express + Mongoose API

REST API on port **5001**, backed by local MongoDB `saunaman`. CommonJS. Entry point: [index.js](index.js).

## Request lifecycle (index.js)

`index.js` wires everything in this order: CORS → JSON body parsing → a **request logger** (logs `METHOD url → status (ms)`, dumps the JSON body on 4xx/5xx) → static serving of `/uploads/reviews` → admin auth → routes → a global error handler that returns `{ error }`.

On startup it connects to Mongo, starts the server, and schedules the **review-email job**: `sendPendingReviewEmails()` runs 10s after boot and then every 60 minutes. It finds non-cancelled reservations whose event has ended, emails a review request, and sets `review_email_sent = true`.

## Admin authentication

- Admin tokens are kept in an **in-memory `Set` (`adminTokens`)** — they do **not** survive a server restart, and won't work across multiple instances.
- `POST /api/admin/verify` with `{ path }`: if `path === process.env.ADMIN_PATH`, it returns `{ valid: true, token }` (a UUID) and stores the token.
- Admin routes are protected by `requireAdmin`, which checks the `x-admin-token` request header against the set (403 otherwise).

## Route module pattern

Routes live in [routes/](routes/) and come in two shapes:

1. **Dual-router** (most files): export `{ publicRouter, adminRouter }`. In `index.js` the public router is mounted at the base path, and the admin router is mounted at the **same path** behind `requireAdmin`. Files: `events`, `users`, `reservations`, `donations`, `invoices`.
2. **Single-router**: export one router, mounted public-only. Files: `payments`, `privateBookings`, `reviews`.

**When adding an admin endpoint**, add it to that file's `adminRouter` and confirm `index.js` mounts the admin router for that path behind `requireAdmin`. Every handler uses a `try/catch` returning `res.status(4xx/5xx).json({ error: err.message })`.

## Models ([models/](models/))

All schemas share: `_id` = `{ type: String, default: uuidv4 }`, `{ timestamps: true }`, and **String refs** (e.g. `event: { type: String, ref: 'Event' }`). Money fields are `Number` in dollars.

- **User** — `email` unique; `credits` (Number, used for free public rebookings); `signedWaiver`.
- **Event** — `type: 'public' | 'private'`; `booked` flag; `max_capacity`; `tent_count` (1 or 2); embedded `location { name, address, lat, lng }`; `duration` in minutes.
- **Reservation** — links `event` + `user`; `cancelled`; `review_email_sent`.
- **Payment** — `amount` (dollars), `stripe_payment_id` (or the literal `"credit_used"`), `reservation` ref.
- **Review** — `stars` 1–5, `text`, `photos` (array of filenames in `uploads/reviews/`), one per reservation.
- **Donation**, **Invoice** — straightforward; Invoice has `paid`/`cancelled`/`date_paid` lifecycle.

## Domain rules worth knowing

- **Booking** (`reservations.js POST /`): blocks double-booking; if `usedCredit`, decrement `user.credits` and record a `"credit_used"` payment. Private events flip `booked=true` after the first reservation; public events flip `booked=true` only at `max_capacity`.
- **Cancellation** (`reservations.js POST /:id/cancel`): private events get a **75% Stripe refund** (unless paid by credit); public events grant the user **+1 credit**. `booked` is recomputed accordingly.
- **Private bookings** (`privateBookings.js`): price via `calcPrice(tentCount, duration)` (1 tent $450 / 2 tents $700 base, ×1.5 for 3h, ×2 for 4h); enforces **36-hour advance** and **no time-slot overlap**; capacity 12 (1 tent) / 24 (2 tents); creates the Event + Reservation + Payment and emails both admin and customer. Preset `LOCATIONS` (5 SF beaches) are defined in this file.
- **Reviews** (`reviews.js`): photo uploads via **multer** to `uploads/reviews/` (≤50MB, jpeg/jpg/png/webp/heic), filenames are UUIDs; one review per reservation.

## Utilities ([utils/](utils/))

- **`stripe.js`** — `createPaymentIntent(amountInDollars)` converts to cents; exports the `stripe` client for refunds.
- **`email.js`** — Resend-based. Sender is `Sauna Man SF <support@saunaman-sf.com>`. Builds RFC `.ics` invites; email links use `APP_URL`.

## Gotchas

- `adminTokens` is in-memory: restarting the dev server logs admins out and breaks any in-flight admin token.
- No request-validation library — handlers check fields manually. Match that style.
- `_id` is a UUID string; don't write code that assumes ObjectId casting/format.

# client/ — React + Vite SPA

React 18 single-page app on port **3000**, built with Vite. Entry: [src/index.jsx](src/index.jsx) → [src/App.jsx](src/App.jsx). Components and pages are `.jsx`; functional components with hooks throughout.

## API access

Always import the shared axios instance: `import api from './api'` ([src/api.js](src/api.js)). Its `baseURL` is `http://localhost:5001/api` in dev and `https://api.saunaman-sf.com/api` in prod (`import.meta.env.PROD`). In dev, Vite also proxies `/api` → 5001 ([vite.config.js](vite.config.js)).

Call endpoints relative to that base, e.g. `api.get('/events/${id}')`, `api.post('/reservations', {...})`. Read errors as `err.response?.data?.error`.

## Routing & the admin dashboard ([App.jsx](src/App.jsx))

Public routes: `/`, `/private`, `/book/:eventId`, `/cancel/:reservationId`, `/donate`, `/review/:reservationId`, `/waiver`, `/invoice/:invoiceId`.

The catch-all `*` route renders `AdminLoader`, which **posts the current `location.pathname` to `/admin/verify`**. If the server confirms it matches `ADMIN_PATH`, it:
1. sets the returned token on the axios instance: `api.defaults.headers.common['x-admin-token'] = token`, then
2. **lazy-imports** `AdminDashboard`.

So the admin dashboard is reached by navigating to the secret admin URL. The token lives only in the in-memory axios instance — a full page reload re-verifies via the path. `AdminDashboard` loads all admin data in one `Promise.all` over `/events`, `/users`, `/reservations`, `/donations`, `/invoices` (all hitting the token-protected admin routers).

## Page conventions

Pages are typically **multi-step wizards driven by local `useState`**. Example: `BookEvent` uses a `step` state (1=email → 2=name → 3=waiver → 4=payment → 5=done) and renders one block per step with a `step-indicator`. Follow this pattern (local state, conditional blocks) rather than introducing a state-management library.

Styling is a mix of **inline `style={{}}` objects** and shared CSS classes from `App.css` (`btn`, `btn-primary`, `btn-success`, `form-group`, `step-indicator`, `success-message`). Dark theme; brand red is `#BA160C`. Dates are formatted with `toLocaleDateString` (and `moment` is available, used by the admin calendar).

## Payments (Stripe)

[components/StripePaymentForm.jsx](src/components/StripePaymentForm.jsx) wraps Stripe `<Elements>` + `<PaymentElement>`. Flow:
1. Server creates a payment intent → client receives a `clientSecret`.
2. Render `<StripePaymentForm clientSecret={...} onSuccess={fn} onError={fn} />`. It renders nothing until `clientSecret` is set.
3. On success it calls `onSuccess(paymentIntent.id)`; the page then POSTs the reservation/donation/invoice with that id.

Publishable key comes from `VITE_STRIPE_PUBLISHABLE_KEY` (falls back to a hardcoded test key). Apple Pay wallet is enabled only in prod.

## Components ([src/components/](src/components/))

- **StripePaymentForm** — payment UI (above).
- **LiabilityWaiver** — controlled waiver checkbox/content (`accepted`, `onChange`).
- **LocationPicker** — Google Maps via `@vis.gl/react-google-maps` with Places autocomplete; needs `VITE_GOOGLE_MAPS_API_KEY`.
- **PhotoCollage** — review photo display.

## Gotchas

- Money values from the API are in **dollars** — display directly, don't divide.
- Admin auth is purely the in-memory `x-admin-token` on the axios instance; navigating away/reloading triggers re-verification through `AdminLoader`.
- No component test coverage to rely on (CRA test scaffolding only).

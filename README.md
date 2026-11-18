# Saunaman

Booking website with a React/Vite frontend, Express backend, MongoDB database, Stripe payments, Resend email, and Google Calendar integration.

## Requirements

- Git.
- Node.js 22.12 or later on the Node 22 release line, with npm. Verify with `node --version` and `npm --version`.
- MongoDB Community Server and MongoDB Shell. Follow [MongoDB installation and startup for macOS and Windows](docs/LOCAL_MONGODB.md).
- Development credentials supplied securely by the project owner for Google OAuth, Stripe test mode, and Resend. Google Maps is optional for map/place selection.

Run the commands below in macOS Terminal or Windows PowerShell, from the repository root unless stated otherwise.

## 1. Get the code and install dependencies

The developer must publish `availability-booking` before another computer can clone that branch.

```text
git clone --branch availability-booking https://github.com/coayscue/saunaman.git
cd saunaman
npm run setup
```

For an existing clone with local changes saved, fetch and switch to the feature branch.

```text
git fetch origin
git switch availability-booking
git pull --ff-only
npm run setup
```

`npm run setup` installs both the backend/root dependencies and the frontend dependencies from their lockfiles. Run it again after pulling dependency updates.

## 2. Create the local environment files

Create `.env` in the repository root using your editor. Keep any existing settings and replace the placeholders below with development credentials.

```dotenv
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/saunaman
APP_URL=http://localhost:3000
ADMIN_PATH=/local-admin
ADMIN_PASSWORD=choose-a-local-password

STRIPE_SECRET_KEY=sk_test_replace_with_actual_key
STRIPE_AUTO_APPROVE_TEST_BOOKINGS=false
RESEND_API_KEY=re_replace_with_actual_key

GOOGLE_CLIENT_ID=replace_with_oauth_client_id
GOOGLE_CLIENT_SECRET=replace_with_oauth_client_secret
GOOGLE_CALENDAR_ID=replace_with_test_calendar_id
GOOGLE_REDIRECT_URI=http://localhost:5001/api/google-calendar/callback
CALENDAR_TOKEN_ENCRYPTION_KEY=replace_with_64_hex_characters
```

Generate the encryption key once and copy its output into `CALENDAR_TOKEN_ENCRYPTION_KEY`.

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Preserve that key for the lifetime of the local Google connection. Changing it requires reconnecting the calendar.

Create `client/.env.local` for the frontend.

```dotenv
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_replace_with_matching_publishable_key
VITE_GOOGLE_MAPS_API_KEY=replace_with_maps_key_if_needed
```

The Stripe secret and publishable key must belong to the same test environment. Remove the optional Maps line if you have no Maps key. The backend requires the Resend key at startup. Use the owner's verified sending domain when testing email.

Both environment files are gitignored. Share credentials securely and keep them out of commits. Local MongoDB starts with separate data and requires its own Google connection.

## 3. Start MongoDB

On macOS, start the version you installed. For example, for MongoDB 8.0 use the following commands. Substitute `mongodb-community@7.0` if that is your installed version.

```bash
brew services start mongodb-community@8.0
brew services list
```

On Windows, open PowerShell as Administrator and start the installed service if it is stopped.

```powershell
Get-Service -Name MongoDB
Start-Service -Name MongoDB
```

Verify the connection on either platform.

```text
mongosh "mongodb://127.0.0.1:27017/saunaman" --eval "db.runCommand({ ping: 1 })"
```

Expect `{ ok: 1 }`. See the [MongoDB guide](docs/LOCAL_MONGODB.md) for installation, stopping/restarting, and troubleshooting.

## 4. Run the website

```text
npm run dev
```

Keep this terminal open. Expect `Connected to MongoDB` in the backend output.

- Website — http://localhost:3000
- Private bookings — http://localhost:3000/private
- Admin with the sample configuration — http://localhost:3000/local-admin
- Backend API — http://localhost:5001/api

Sign into admin using the local `ADMIN_PASSWORD` you set. If you choose another `ADMIN_PATH`, use that path instead. Restart `npm run dev` after changing environment files. Press Ctrl+C to stop the app.

## 5. Connect Google Calendar

The Google OAuth client must have `http://localhost:5001/api/google-calendar/callback` registered as a redirect URI and Calendar API enabled. Its consent configuration must allow the Google account you use. Calendar availability and event access are needed.

In admin, click **Connect / reconnect Google Calendar**, sign into the account with access to the configured calendar, grant access, then choose **Check connection**. Expect `connected`. Use a dedicated test calendar and inboxes you control because calendar writes and Resend emails are real even with Stripe test payments.

## 6. Test availability and booking

1. In admin > **Booking availability**, inspect the initial weekly schedule. Edit a weekday's hours and save.
2. Add available hours on a date more than 36 hours away, then open `/private` and refresh availability. Verify two-, three-, and four-hour sessions fit inside the window.
3. Add an entire-day block for that date. Refresh the booking page and verify the day is unavailable. Remove the block and verify sessions return when no booking, pending hold or Google Busy event overlaps.
4. Submit a request with your own customer email. Use Stripe test card `4242 4242 4242 4242`, any future expiry, a three-digit CVC and a valid postal code.
5. Expect the under-review message and an admin review email. Approve the request in admin and verify confirmation, a simulated captured payment in Stripe, and a Google event.
6. Submit a separate request and deny it. Verify its payment authorization is released and its slot reopens.
7. Cancel the confirmed test event through admin. Verify a full test refund, customer email, removed Google event and reopened availability.
8. Use **Sync now and refresh events** to verify that linked website/Google event edits synchronize. Availability windows created in admin mirror to Google in the background.

`STRIPE_AUTO_APPROVE_TEST_BOOKINGS=false` keeps the manual approval flow testable. Setting it to `true` and restarting enables auto-approval for new eligible 4242 test-card requests outside production. Live Google Busy events and existing bookings still take priority.

Full cases, webhook setup, synchronization rules and expected outcomes are in [CALENDAR_TESTING.md](CALENDAR_TESTING.md). For reliable local webhook testing, follow that guide to add the Stripe CLI listener's `STRIPE_WEBHOOK_SECRET` to root `.env`.

## 7. Run automated checks

From the repository root on Windows or macOS, run the following commands.

```text
npm test
npm run build
```

`npm test` runs the backend test files using Node's test runner through a portable file-discovery script. Provider interactions in those tests are simulated. `npm run build` verifies the production frontend build. Use `npm run dev` for local feature testing because the production frontend build targets the production API.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install root/backend and frontend dependencies |
| `npm run dev` | Run backend and frontend together |
| `npm run server` | Run backend with automatic restart |
| `npm run client` | Run frontend only |
| `npm test` | Run backend automated tests |
| `npm run build` | Build the frontend |
| `npm start` | Run backend without automatic restart |

## Common setup problems

- **Connection refused on 27017** — start MongoDB and verify the local `MONGO_URI`.
- **Missing Resend API key** — set `RESEND_API_KEY` in root `.env` and restart the app.
- **Payment is not configured** — set `VITE_STRIPE_PUBLISHABLE_KEY` in `client/.env.local` and restart.
- **Calendar availability unavailable** — connect the configured calendar through admin and check Google permissions.
- **Google access blocked** — use an account permitted by the OAuth audience and test-user settings.
- **Port already in use** — stop the earlier development process before starting another.

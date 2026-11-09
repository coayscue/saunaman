# Calendar and private booking approval testing

## Scope
New private checkout authorizes a card and creates a pending request. It does not capture payment or create a confirmed Event until approval. Approval creates a Google event, captures payment and confirms database records. Denial/expiry cancels the entire authorization; defensive recovery refunds a captured payment in full. Existing confirmed bookings are not migrated. Public sessions, invoices and donations retain immediate payment.

Unique hourly MongoDB lock documents reserve the entire requested interval. They work with standalone MongoDB; no replica set is required. Denial/expiry releases locks only after payment reconciliation. Approved events keep availability blocked through Google and the local Event. Separate Google blocks always remain authoritative.

The worker runs every 30 seconds and on startup. Durable states, deterministic event/record IDs and Stripe idempotency keys support crash recovery. Transient provider errors retain the hold and appear in the admin list. A request gets a 24-hour decision window capped before the actual card authorization expiry (a conservative one-hour window if expiry metadata is absent). Checkout holds expire after 15 minutes. Do not manually remove locks to recover a request; inspect payment/calendar state first.

## Configuration
Use Node 22.12+. Start MongoDB, then run `npm run dev` from the repository root.

Root `.env` keeps existing keys and needs:
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_ID
- GOOGLE_REDIRECT_URI=http://localhost:5001/api/google-calendar/callback
- CALENDAR_TOKEN_ENCRYPTION_KEY (preserve the existing 64-hex value)
- STRIPE_SECRET_KEY=sk_test_... for local tests
- STRIPE_WEBHOOK_SECRET=whsec_... from the Stripe CLI listener below
- RESEND_API_KEY with permission to send from the verified saunaman-sf.com domain
- APP_URL=http://localhost:3000 (use a client-reachable HTTPS origin in production)
- ADMIN_PASSWORD: set a strong local password; required with NODE_ENV=production
- ADMIN_PATH: preserve the existing private dashboard path

Frontend `client/.env.local` needs VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... from the same sandbox as the backend secret.

Do not use live Stripe keys for this checklist. Resend emails ARE real even when Stripe is in test mode.

## Reconnect Google Calendar (required)
In Google Cloud Console, select the project, then Google Auth Platform > Data Access. Add https://www.googleapis.com/auth/calendar.events alongside the existing freebusy scope. Save. Open local admin, sign in if prompted, and choose Connect / reconnect Google Calendar. Authorize the calendar-owning account and grant the additional permission. Check connection. The calendar stays private. External/Testing authorizations typically need reconnection after seven days; complete production OAuth setup before launch.

## Stripe webhook for local testing
Install/sign into Stripe CLI for the correct account/sandbox. Run:

```
stripe login
stripe listen --forward-to localhost:5001/api/stripe/webhook
```

Copy the listener's whsec_... signing secret into root STRIPE_WEBHOOK_SECRET, then restart the backend while keeping the listener running. The webhook verifies signatures using the raw request body. Without the listener, the browser callback and background worker still reconcile requests, but test webhook delivery before deployment.

## Happy path: approval
1. Create a private request more than 36 hours ahead during business hours. Use your own email for customer receipts. Complete the waiver.
2. Authorize using card 4242 4242 4242 4242, any future expiry and a valid CVC/postal code.
3. Expect: “Your timeslot and booking is under review we will get back to you shortly”.
4. In Stripe, verify the payment is authorized/requires capture, not succeeded/captured.
5. Refresh the booking page: the requested interval must be held. Another overlapping request must fail. An adjacent interval should remain available.
6. support@saunaman-sf.com receives a review email. Its link opens admin and highlights the request. Opening the link alone never makes a decision. Localhost links only work on the machine running the local app; use production APP_URL when deployed.
7. In admin, click Approve and collect payment and confirm. Expect confirmed, a successful captured Stripe payment, one Google event on the configured calendar, one local event/reservation/payment, and a customer confirmation email.
8. Refresh/repeat the same request: it must not create another charge or Google event.

## Denial
1. Make a separate request and verify Stripe shows authorization only.
2. In admin, choose Deny and release payment hold and confirm.
3. Expect denied, Stripe canceled, a customer denial email, no confirmed Google event, and the website interval available on refresh (unless another Google event blocks it).
4. Repeat denial: no second refund, no duplicate credit, no new booking.

## Additional verification
- A declined test payment must not create a pending request or admin approval email; abandoned checkout holds expire.
- An all-day Busy Google event disables that day. A Free event does not block. Check recurring event exceptions and DST/browser timezone differences.
- Add a conflicting Google Busy event after a request is pending, then approve: it must be denied/released rather than captured.
- Close the browser after card authorization: webhook/worker should move the request to pending and send notifications.
- Restart backend with a pending request: it must remain pending and retain its hold.
- Revoke calendar access during approval: request stays processing with an error and no false confirmation; reconnect and let worker retry.
- Simulate provider failure in isolated tests rather than interrupting live payments. Verify recovery after capture succeeds but confirmation writes fail.
- Expiration can be exercised by shortening a request deadline in a disposable TEST database, then waiting one worker interval. Expect released funds/slot and expiration email. Never edit production payment records as a test.

## Automated checks
```
node --test server/tests/*.test.js
npm run build --prefix client
```
Tests use fake providers for financial actions. They cover validation, payment association, deadline limits, overlapping lock ownership, authorization, approval, denial, expiration and capture failure recovery. They do not replace live sandbox testing.

## Production checklist
Configure HTTPS APP_URL and callback URLs, reconnect production Google Calendar, set ADMIN_PASSWORD and a nondefault ADMIN_PATH, and configure a Stripe webhook endpoint at https://api.saunaman-sf.com/api/stripe/webhook using that endpoint's signing secret. Select payment_intent.amount_capturable_updated, payment_intent.succeeded, payment_intent.canceled and payment_intent.payment_failed events. Deploy frontend/backend together and keep at least one backend instance running for reconciliation. Monitor admin processing errors and provider delivery logs. Keep the original calendar connection available during in-flight approvals. Do not rely on a development External/Testing OAuth token for unattended production.

Known boundaries: Google Calendar edits made concurrently by a human cannot participate in MongoDB locking; rechecks reduce but cannot eliminate that race. Admin Cancel Event and Delete Event now cancel confirmed events with full refunds and customer notifications; Delete archives the event while retaining records. Original customer cancellation remains separate. Local tests cannot prove production email deliverability, Google permissions or bank hold timing. Email retries are at-least-once with Resend idempotency keys; outages beyond provider deduplication windows can produce duplicate notices.


## Admin event cancellation and deletion
Open an event from the admin calendar or agenda (including older bookings like John Doe). Cancel Event issues a full remaining refund, restores a credit if the reservation used credit, sends each customer a cancellation email, and releases availability. Application-created Google events are removed; manually created Google Busy events remain. Delete Event does the same, then archives the event out of the active dashboard. It does not erase payment/reservation history. Cancelled events remain visible with a Cancelled status. Failure messages retain retry controls; the worker retries every 30 seconds. Email delivery retries after funds/slot processing and does not repeat a completed refund.

Test only with Stripe test-mode bookings: cancel one confirmed event, verify full refund in Stripe, customer email, removed Google event, and reopened website interval. Refresh and retry to check no duplicate refund/email. Delete a separate event and verify it disappears from active admin/public listings while its reservation history remains. Also test a legacy booking without a BookingRequest record: no unrelated Google event should be deleted. No existing booking is cancelled just by deploying this code.


## Optional automatic test-card approval
Set STRIPE_AUTO_APPROVE_TEST_BOOKINGS=true in root .env and restart the backend. It is enabled locally for development. Only NEW requests created while enabled are eligible. The processor checks Stripe's server-returned livemode=false, requires_capture, Visa and last4=4242, and refuses auto-approval with NODE_ENV=production. This uses the standard availability, calendar, capture and confirmation flow; it does not bypass failures. Stripe captures are simulated, but Google events and Resend emails are real. To test manual approval/denial, set the flag to false and create a new request. Existing pending requests never opt themselves into automatic approval.


## Two-way Google Calendar event synchronization
The backend polls every 60 seconds and on startup. Admin > Google Calendar availability > Sync now and refresh events runs the same worker immediately. A database lease serializes workers, incremental sync tokens are paged before being saved, and invalid Google tokens trigger a full resync. Existing confirmed bookings with Google linkage are backfilled automatically. New admin-created events are linked/exported automatically. Older unrelated website events can be linked using Connect this event to Google in their event details. Personal Google events remain availability blocks and are not imported as website bookings.

No new environment variables are needed. The existing Google connection must have calendar.events permission; reconnect if permissions are missing. Run the backend continuously for background synchronization. Existing legacy calendar titles are normalized to avoid false conflicts when rescheduling.

### Verify both directions using test bookings
1. Restart npm run dev using Node 22.12+. Open admin and check Google connection.
2. Create a new admin event on a free date. Click Sync now and refresh events (or wait one minute). Confirm exactly one Google event appears and event details show synced.
3. Edit that event's start, duration or location in admin. Sync again. Confirm the same Google event changes rather than a duplicate being created.
4. Move the same event in Google Calendar and change its location. Sync again. Confirm the website event date/duration/location and admin calendar update. Prices, customer records and payments must not change.
5. Repeat with a confirmed test customer booking: schedule/location changes should send a customer change notification through Resend. Real emails and calendar changes occur even when Stripe uses test keys. No new payment or refund is triggered by synchronization.
6. Edit both copies differently before syncing. Expect conflict. Open event details and choose Keep website version or Keep Google version. Inspect both calendars before choosing; this applies the selected version and may notify customers.
7. Move a Google event onto another website event, active request hold, or Google Busy event. Expect conflict; website booking details should not be overwritten by the conflicting Google change.
8. Delete the linked Google event. Expect google_deleted and an admin review message. The paid booking is not automatically cancelled or refunded. Restore the Google event, or explicitly cancel through admin using the existing full-refund workflow.
9. Add a personal Busy event in Google. Confirm it blocks booking availability but does not create a public listing, customer reservation or website Event.
10. Cancel/delete a newly admin-created linked event through admin. Confirm its Google event is removed too. Existing unrelated Google blocks must remain.
11. Restart the backend and run Sync now repeatedly. There must be no duplicate Google events or repeat schedule notices for unchanged data.
12. Disconnect/revoke Google access. Sync must show an error; reconnect and retry to recover. No payment changes should occur as part of recovery.

Linked bookings support single timed events. Converting one to an all-day or recurring event is flagged for review rather than silently changing the booking. Google-added events are not automatically converted to bookings. Sync is polling rather than push-based, so allow a minute plus provider latency. Edits made outside the app can race with other actions; database revisions and Google If-Match checks protect against silent overwrites but cannot make Google/MongoDB one transaction. Conflict decisions remain administrator actions.

Automated sync tests use fake Google, email and database providers. They cover inbound/outbound updates, conflict choices, overlaps, deletion safeguards, repeat-update suppression, revision/ETag checks, deterministic export, legacy titles, pagination and expired cursors. Live sandbox synchronization and email delivery still require the manual steps above.

# Test Plan — Event "End Date" field

## What was changed
Added an optional `endDate` field to events. Server: `endDate` (Date) added to the Event model; ICS calendar invites (`server/utils/email.js`) now use `endDate` for `DTEND` when present (falling back to start + duration). Client: admin create/edit forms get an "End Date & Time (optional)" input; the admin calendar uses `endDate` for the event end; admin event/reservation detail modals show an End Date row; public pages (Home card, BookEvent, CancelReservation, LeaveReview) display the end date / time range when present.

## Validation steps
1. Snapshotted the `events` collection before the run — 12 events, **0** with an `endDate` field.
2. Instrumented the create data-flow path with `[VALIDATE-DEBUG]` prints (client payload, server incoming body, server post-save document).
3. Started the app (`npm run dev`) and waited for client (3000) + server (5001) to return 200.
4. Drove the UI with Playwright (headed):
   - Opened the admin dashboard.
   - Opened **+ Create Event**, filled the form including the new **End Date & Time** field (start `2026-12-15 10:00`, end `2026-12-15 12:00`), price `$55`, capacity `10`, type `public`.
   - Submitted → server returned **201**.
   - Opened the new event's detail modal → **End Date** row shows `Dec 15, 2026, 12:00 PM`.
   - Viewed the admin **Calendar** tab.
   - Opened the public **Home** page → event card shows an **Ends:** line.
   - Clicked **Book Now** → BookEvent page shows the full **start – end** range.
5. Read the print values from the server log and browser console.
6. Snapshotted the `events` collection after the run and confirmed the persisted `endDate`.
7. Removed all instrumentation (final `grep` for the marker returns nothing) and stopped the servers.

## Screenshots
| Step | Screenshot |
|---|---|
| Admin dashboard | `screenshots/01-admin-dashboard.png` |
| Create form with End Date filled | `screenshots/02-create-form-with-end-date.png` |
| Agenda after create | `screenshots/03-after-create-agenda.png` |
| Admin event detail — End Date row | `screenshots/04-admin-event-detail-end-date.png` |
| Admin calendar | `screenshots/05-admin-calendar.png` |
| Home card — "Ends:" line | `screenshots/06-home-card-end-date.png` |
| BookEvent — start–end range | `screenshots/07-book-event-end-range.png` |

## Print-statement evidence
| Checkpoint | Output | Proves |
|---|---|---|
| Client create payload | `[VALIDATE-DEBUG] client create payload endDate raw: 2026-12-15T12:00 -> ISO: 2026-12-15T18:00:00.000Z` | The datetime-local value is read from state and serialized to ISO before the POST. |
| Server incoming body | `[VALIDATE-DEBUG] POST /events incoming endDate: 2026-12-15T18:00:00.000Z` | The `endDate` reaches the route handler intact. |
| Server post-save | `[VALIDATE-DEBUG] saved event _id: ef146b8f-db19-45d5-bb73-9fa73fb8af6b endDate: 2026-12-15T18:00:00.000Z` | Mongoose accepts and persists `endDate` (schema field works). |

No `pageerror` entries were captured in the browser console during the flow.

## Database verification
- **Before:** `events` count = 12, events with `endDate` = **0**.
- **After:** new event `ef146b8f-db19-45d5-bb73-9fa73fb8af6b` persisted with:
  - `date: 2026-12-15T16:00:00.000Z`
  - `endDate: 2026-12-15T18:00:00.000Z` ✅ (matches the value entered in the UI / sent by the client)

The `endDate` field is present and stored as a Date on the persisted document (serialized to an ISO string by the query helper).

## Result
| Checkpoint | Result |
|---|---|
| End Date input in admin create form | PASS |
| Client serializes endDate → ISO | PASS |
| Server receives & persists endDate | PASS |
| DB document has correct endDate | PASS |
| Admin event detail shows End Date | PASS |
| Public Home card shows "Ends:" | PASS |
| BookEvent shows start–end range | PASS |

**Overall: PASS**

> Test data note: this run created one public event named **"Validation End Date Event"** (`ef146b8f-db19-45d5-bb73-9fa73fb8af6b`) in the local `saunaman` DB.

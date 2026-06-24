---
name: validate
description: Autonomously validate a code change end-to-end on the saunaman stack (React+Vite client / Express server / MongoDB). Runs the app, drives the real UI with Playwright and captures screenshots, temporarily instruments the code with print statements to confirm the right data flows through the right places, verifies the database actually received the correct changes, removes all instrumentation afterward, and writes a structured step-by-step test plan with screenshots, print values, and DB before/after. Use to validate/test a change, confirm a fix works, or produce a test plan before opening a PR.
---

# validate

Prove a code change actually works on the **saunaman** stack — by running the real app, watching the real data flow, and inspecting the real database — then produce a clear test plan documenting exactly what was done and what was observed.

## Stack facts (this repo)
- **Client:** React + Vite, port **3000** (`npm run client`). Proxies `/api` → 5001.
- **Server:** Express, port **5001** (`npm run server`). Both together: `npm run dev`.
- **DB:** local MongoDB, database **`saunaman`** (`mongosh` is installed). Connection in `.env` `MONGO_URI`.
- **Models** (`server/models/`): Event, User, Reservation, Payment, Review, Donation, Invoice. `_id` is a string UUID.
- **Routes** (`server/routes/`): split into `publicRouter` / `adminRouter`. Admin routes need header `x-admin-token`.
- **Tooling:** Playwright (root devDependency, chromium installed) for headed UI + screenshots.

## Inputs
- A description of the change being validated (from the caller or `$ARGUMENTS`). If absent, infer it from the current `git diff`.
- Derive from the change: which **UI flow** exercises it, which **data** should flow and where, and which **collection/field** in Mongo should change.

## Procedure

Work through these phases in order. Track progress with TodoWrite.

### 0. Set up a run folder
```bash
RUN_ID=$(date +%Y%m%d-%H%M%S)
mkdir -p .validation/$RUN_ID/screenshots
```
All artifacts (screenshots, server log, DB snapshots, the test plan) go in `.validation/$RUN_ID/`.

### 1. Snapshot the DB *before* (baseline)
Query the collection(s) the change touches so you can prove a delta later. Use the helper:
```bash
node .claude/skills/validate/scripts/db-query.mjs "<collection>" '<JSON filter>' > .validation/$RUN_ID/db-before.json
```
Record counts and the specific document(s)/fields you expect to change.

### 2. Instrument the code (temporary print statements)
Add `console.log` statements at the **data-flow checkpoints** for this change — e.g. the request body as it enters the route, the document just before `.save()`, the value as it leaves the API on the client, the state right before render. 

**Every instrumentation line MUST carry the marker `// [VALIDATE-DEBUG]`** so it can be removed reliably:
```js
console.log("[VALIDATE-DEBUG] incoming reservation body:", JSON.stringify(req.body)); // [VALIDATE-DEBUG]
```
Before moving on, list exactly what you added:
```bash
grep -rn "\[VALIDATE-DEBUG\]" server client/src
```

### 3. Start the app and capture logs
- Check what's already running: `lsof -ti:5001`, `lsof -ti:3000`.
- Start with server output teed to the run log so print values are captured:
```bash
npm run dev > .validation/$RUN_ID/server.log 2>&1 &
```
- Wait for readiness: poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` and `http://localhost:5001` until 200/expected.

### 4. Drive the UI with Playwright + screenshot each step
Copy the template and edit it for this change's flow:
```bash
cp .claude/skills/validate/scripts/flow.template.mjs .validation/$RUN_ID/flow.mjs
```
Edit `flow.mjs` to walk the actual user steps (navigate, fill, click, assert), calling `shot('NN-description')` after each meaningful step. Run it **headed**:
```bash
RUN_DIR=.validation/$RUN_ID node .validation/$RUN_ID/flow.mjs
```
Screenshots land in `.validation/$RUN_ID/screenshots/`. Capture, at minimum: the starting state, the action being performed, and the resulting state that proves the feature.

### 5. Read the print values
Pull the instrumentation output from the captured logs:
```bash
grep "\[VALIDATE-DEBUG\]" .validation/$RUN_ID/server.log
```
For client-side checkpoints, read them from the Playwright console capture (the template forwards `page.on('console')` into `.validation/$RUN_ID/client-console.log`). Confirm each checkpoint shows the **expected** value in the **expected** place. Quote the actual lines in the test plan.

### 6. Snapshot the DB *after* and diff
Re-run the same query:
```bash
node .claude/skills/validate/scripts/db-query.mjs "<collection>" '<JSON filter>' > .validation/$RUN_ID/db-after.json
```
Confirm the concrete change: new document exists / field was added / value matches what was entered in the UI. State the before→after delta explicitly. If a new schema field was added, confirm it's present and correctly typed on the persisted document.

### 7. Remove ALL instrumentation
```bash
# show, then remove every marked line
grep -rn "\[VALIDATE-DEBUG\]" server client/src
# remove lines containing the marker
grep -rl "\[VALIDATE-DEBUG\]" server client/src | while read f; do
  sed -i '' '/\[VALIDATE-DEBUG\]/d' "$f"
done
# verify none remain — this MUST return nothing
grep -rn "\[VALIDATE-DEBUG\]" server client/src
```
Confirm the only remaining diff is the intended change (run `git diff --stat`). Stop the dev servers you started (`lsof -ti:5001 | xargs kill`, `lsof -ti:3000 | xargs kill`) if you started them.

### 8. Write the test plan
Write `.validation/$RUN_ID/TEST_PLAN.md` using the structure in `references/test-plan-format.md`. It must contain:
- **What was changed** (1–2 lines).
- **Numbered steps** of exactly what you did to validate.
- **Screenshots** referenced inline (the caller/PR skill rewrites these to raw GitHub URLs after pushing — keep paths relative to the run folder: `screenshots/NN-description.png`).
- **Print-statement evidence**: the actual `[VALIDATE-DEBUG]` lines, each with what it proves.
- **Database verification**: before → after, with the specific doc/field.
- **Result**: PASS / FAIL per checkpoint and overall.

## Output
Return to the caller: the path to `TEST_PLAN.md`, the run folder, the overall PASS/FAIL, and the list of screenshot files. Leave `.validation/$RUN_ID/` in the working tree (the PR skill commits it).

## Guardrails
- **Never leave instrumentation behind.** Phase 7's final grep returning empty is mandatory. If anything remains, remove it before reporting.
- Never print or log secrets from `.env` (Stripe keys, Mongo URI, Resend key).
- Don't seed/delete unrelated DB data; if you create test records, note them in the test plan.
- If the app can't start or the flow can't run, report the failure with the captured log — do not fake a pass.

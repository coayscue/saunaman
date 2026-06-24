---
name: prompt-to-pr
description: Implement a code change from a natural-language description, autonomously validate it end-to-end (run the app, drive the UI, verify data flow and the database), then open a GitHub PR with a fully populated test plan (steps, screenshots, print-statement evidence, DB before/after). Use when the user wants to "make this change and open a PR", "ship this and validate it", or "implement X, test it, and PR it".
---

# prompt-to-pr

End-to-end: take a change request → write the code → prove it works with the `validate` skill → open a PR whose body IS the test plan.

The change to implement is in `$ARGUMENTS` (or the user's request). Stack: React+Vite client (3000) / Express server (5001) / MongoDB `saunaman`. Track all phases with TodoWrite.

## Preconditions (check once)
- `gh auth status` → if not authenticated, tell the user to run `gh auth login` and stop.
- Working tree: note the current branch.
  - **If on `main`:** create and check out a new branch before starting (derive a short kebab-case name from the change request, e.g. `git checkout -b feat/event-end-date`). Don't commit the change to `main`.
  - **Otherwise:** use the current branch as-is.

## Phase 1 — Implement
1. Understand the request; locate the relevant files (`server/routes`, `server/models`, `client/src`).
2. Make the change, matching existing code style. Keep it focused — only what the request asks.
3. Sanity-check it compiles / imports resolve. Do **not** hand-wave correctness — that's Phase 2's job.

## Phase 2 — Validate
Invoke the **`validate`** skill with the change description. It will:
run the app → instrument data-flow checkpoints with `[VALIDATE-DEBUG]` prints → drive the UI with Playwright and screenshot each step → read the print values → snapshot the DB before/after → **remove all instrumentation** → write `.validation/<RUN_ID>/TEST_PLAN.md`.

Get back: run folder, `TEST_PLAN.md` path, overall PASS/FAIL, screenshot list.

**If validation FAILS:** fix the code and re-run `validate`. Do not open a PR on a failing validation unless the user explicitly says to.

## Phase 3 — Open the PR
1. Confirm instrumentation is gone: `grep -rn "\[VALIDATE-DEBUG\]" server client/src` must be empty. `git diff --stat` should show only the intended change plus `.validation/`.
2. Stage and commit the change **and** the run folder (screenshots are needed for inline rendering):
   ```bash
   git add -A && git commit -m "<concise change summary>"
   git push -u origin HEAD
   ```
3. Get the pushed commit SHA (for permanent screenshot URLs):
   ```bash
   SHA=$(git rev-parse HEAD)
   ```
4. Build the PR body from `TEST_PLAN.md`, rewriting every relative screenshot path to a raw GitHub URL so it renders inline:
   `screenshots/NN-x.png` → `https://github.com/coayscue/saunaman/raw/<SHA>/.validation/<RUN_ID>/screenshots/NN-x.png`
   (Using the SHA, not the branch name, keeps images alive after the branch is deleted on merge.)
5. Create the PR:
   ```bash
   gh pr create --title "<title>" --body-file <prepared-body.md>
   ```
   Title = concise change summary. Body = Summary + the full test plan (steps, inline screenshots, print evidence table, DB before/after, overall PASS).
6. Return the PR URL to the user.

## Guardrails
- Never open a PR if `validate` reported FAIL (without explicit user override).
- Never commit `.env` or secrets. `.gitignore` already excludes `.env`.
- If `gh` isn't authenticated, stop and ask the user to `gh auth login`.
- Keep the implementation diff and the validation artifacts in the same commit so screenshot URLs resolve.

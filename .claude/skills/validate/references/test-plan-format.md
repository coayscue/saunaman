# Test plan format

Write `TEST_PLAN.md` using exactly this structure. Keep it concrete — quote real values, not paraphrases.

```markdown
## Summary
<1–2 sentences: what changed and what this validation proves.>

## What I validated
- Feature/behavior under test:
- UI flow exercised:
- Data expected to flow:
- DB change expected: <collection>.<field> / new document / etc.

## Steps performed
1. <action> → <observed result>  ![step](screenshots/01-initial-state.png)
2. <action> → <observed result>  ![step](screenshots/02-after-submit.png)
3. ...

## Print-statement evidence (instrumentation)
Temporary `[VALIDATE-DEBUG]` logs added at each data-flow checkpoint (removed after validation):

| Checkpoint | Location | Logged value | Expected? |
|---|---|---|---|
| incoming request body | server/routes/<x>.js | `{ ... actual ... }` | ✅ |
| doc before save | server/routes/<x>.js | `{ ... }` | ✅ |
| value rendered | client/src/... | `...` | ✅ |

Raw lines:
```
<paste the actual grepped [VALIDATE-DEBUG] lines>
```

## Database verification
**Before:**
```json
<relevant slice of db-before.json>
```
**After:**
```json
<relevant slice of db-after.json>
```
**Delta:** <e.g. "new reservations doc `<id>` created with field `partySize: 4` exactly matching UI input; count 12 → 13.">

## Result
- UI flow: PASS/FAIL
- Data flow (print checkpoints): PASS/FAIL
- Database persisted correctly: PASS/FAIL
- Instrumentation removed (grep clean): ✅
- **Overall: PASS/FAIL**
```

Notes:
- Screenshot paths stay relative to the run folder (`screenshots/NN-*.png`). The PR skill rewrites them to raw GitHub URLs after the branch is pushed so they render inline in the PR.
- Every PASS must be backed by a quoted value or a screenshot — no unsupported claims.

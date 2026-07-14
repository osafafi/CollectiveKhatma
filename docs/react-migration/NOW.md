# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-420 — personal and settings routes                      |
| Last completed code commit            | `5af9404` — `RM-420: migrate personal and settings routes` |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 4 — member application migration                     |
| Next recommended task                 | RM-430 — completion/du3a flow (Codex)                      |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740        |
| Last updated                          | 2026-07-14                                                 |

RM-420 is committed at `5af9404`; this file is the exact-hash handoff update.

## Next-session read set — RM-430

Read only after the exact-hash handoff commit:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-430.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. Member UI-inventory section 2.8 plus directly relevant member app, completion
   state/content subscriptions, identity/roster context, du3a acknowledgement
   persistence, shared feedback/navigation primitives, legacy completion views,
   and test harness/tests.

Do not load the full historical migration plan, completed task evidence, theme
map, dependency audit, khatma/reader/personal/settings flows, or admin sources
for RM-430.

## Handoff from RM-420

- Added React personal insight with live member identity, Arabic lifetime page
  count/percentage, 604-page progress, zero behavior, and switch-person action.
- Added the React settings route with a persisted 1–5 reading-scale slider,
  visibly scaling Quran sample, and disclosure state preserved across routes.
- Added 3 focused scenarios. Full verification passed: lint, 171 tests (1
  skipped), production build, React bundle budgets, changed-file formatting,
  and diff checks. Browser QA passed at phone/desktop RTL with no overflow or
  console errors. Detailed evidence is in [`tasks/RM-420.md`](tasks/RM-420.md).
- Reading scale remains browser-local and adds no Redux state or Firestore
  listeners.
- No dependency, lockfile, Firebase/data/domain, legacy UI, admin, reader/
  completion, or production-entry changes.

Earlier history is retrievable through [`archive/README.md`](archive/README.md)
and is not startup context.

## Claim protocol

Before RM-430 implementation, confirm the clean handoff hash and dependencies,
then change only its tracker row to `IN PROGRESS`, create its task record,
rewrite this file with active scope/read set/risks, and run the smallest useful
baseline check. Do not append a chronological session log here.

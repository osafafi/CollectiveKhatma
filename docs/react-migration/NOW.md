# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                                |
| ------------------------------------- | ------------------------------------------------------------ |
| Integration branch                    | `reactmigration`                                             |
| Branch base                           | `6992007` (`main` at migration start)                        |
| Last completed code task              | RM-410 — khatma list and landing routes                      |
| Last completed code commit            | `5ebed75` — `RM-410: migrate khatma list and landing routes` |
| Active migration task                 | None                                                         |
| Current phase                         | Phase 4 — member application migration                       |
| Next recommended task                 | RM-420 — personal and settings routes (Codex)                |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740          |
| Last updated                          | 2026-07-14                                                   |

RM-410 is committed at `5ebed75`; this file is the exact-hash handoff update.

## Next-session read set — RM-420

Read only after the exact-hash handoff commit:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-420.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. Member UI-inventory sections 2.6 and 2.7 plus directly relevant member app,
   identity context, personal insight, settings/persistence, shared primitives,
   legacy personal/settings views, and test harness/tests.

Do not load the full historical migration plan, completed task evidence, theme
map, dependency audit, khatma/reader/completion flows, or admin sources for
RM-420.

## Handoff from RM-410

- Added React khatma list/landing routes with active-series targeting, assignment
  progress, member-only warnings, paused/awaiting/done states, group pending
  names, history, errors, navigation, and completion-write feedback.
- A persistent member-experience reconciler owns reference-counted assignment
  subscriptions for exactly the selected member's active khatmas; route changes
  do not create feature-local Firestore listeners.
- Added 8 focused scenarios. Full verification passed: lint, 168 tests (1
  skipped), production build, React bundle budgets, changed-file formatting, and
  diff checks. Browser QA passed at phone/desktop RTL with no overflow or console
  errors. Detailed evidence is in [`tasks/RM-410.md`](tasks/RM-410.md).
- The documented transient empty-list behavior is intentionally preserved.
- No dependency, lockfile, Firebase schema/rules, legacy UI, reader/personal/
  completion, admin, or production-entry changes.

Earlier history is retrievable through [`archive/README.md`](archive/README.md)
and is not startup context.

## Claim protocol

Before RM-420 implementation, confirm the clean handoff hash and dependencies,
then change only its tracker row to `IN PROGRESS`, create its task record,
rewrite this file with active scope/read set/risks, and run the smallest useful
baseline check. Do not append a chronological session log here.

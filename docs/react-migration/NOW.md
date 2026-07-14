# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-350 — shared React test harness                  |
| Last completed code commit            | Pending; working tree is based on `3353123`         |
| Active migration task                 | None                                                |
| Current phase                         | Phase 3 complete; RM-300 through RM-350 are `DONE`  |
| Next recommended task                 | RM-400 — member identity gate (Codex)               |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740 |
| Last updated                          | 2026-07-14                                          |

RM-340 is committed and pushed at `3353123`. The working tree contains only the
completed RM-350 test harness, focused tests, and migration evidence.

## Next-session read set — RM-400

Read only:

1. This file.
2. The Phase 4 table in [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-400.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. The identity-gate UI-inventory section and directly relevant member app,
   persistence, roster subscription, shell, and test-harness source/tests.

Do not load the full historical migration plan, all completed task evidence, the
theme map, or the dependency audit for RM-400.

## Handoff from RM-350

- Codex completed RM-350 from clean RM-340 commit `3353123`.
- Added `renderWithAppProviders` under `tests/support`, composing the production
  Redux, MUI, error/feedback, write-operation, and hash-router providers.
- Every render defaults to a fresh store and controllable subscription sources;
  callers can seed snapshots, emit values/errors, address assignment streams by
  khatma, inspect listener counts, navigate with a configured user, and rerender
  without losing providers.
- React test cleanup now resets the hash route to prevent cross-test leakage.
- Verification passed: typecheck, lint, 157 tests, production build, formatting,
  and diff checks. Bundle budgets were not rerun because changes are test-only.
- No application source, dependency, lockfile, legacy UI, or production-entry
  changes.

Detailed RM-350 evidence lives in [`tasks/RM-350.md`](tasks/RM-350.md). Earlier
history is retrievable through [`archive/README.md`](archive/README.md) and is not
startup context.

## Claim protocol

Before implementation:

1. Confirm the expected branch and inspect the working tree.
2. Confirm the task's dependencies are `DONE` in `TRACKER.md`.
3. Change only that tracker row to `IN PROGRESS` and set its owner.
4. Create or update the task record under `tasks/`.
5. Rewrite this file with the active task, expected commit, exact read set, and
   current risks.
6. Run the smallest useful baseline check.

At completion, update the tracker and task record, then rewrite this file with a
compact handoff. Do not add a chronological session log here.

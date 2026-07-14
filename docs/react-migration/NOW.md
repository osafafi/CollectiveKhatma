# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-340 — browser-persistence hooks                  |
| Last completed code commit            | Pending; working tree is based on `cb18dae`         |
| Active migration task                 | None                                                |
| Current phase                         | Phase 3; RM-300 through RM-340 are `DONE`           |
| Next recommended task                 | RM-350 — shared React test harness (Codex)          |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740 |
| Last updated                          | 2026-07-14                                          |

The working tree contains the completed RM-340 implementation, tests, and
migration evidence on top of clean commit `cb18dae`.

## Next-session read set — RM-350

Read only:

1. This file.
2. The Phase 3 table in [`TRACKER.md`](TRACKER.md#phase-3--shared-react-components-and-app-shells).
3. Create `tasks/RM-350.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. Relevant provider, router, Redux, subscription, and test setup source/tests
   discovered for RM-350.

Do not load the full historical migration plan, all completed task evidence, the
theme map, or the dependency audit for RM-350.

## Handoff from RM-340

- Codex completed RM-340 from clean commit `cb18dae`.
- Added four React hooks under `src/app/persistence` for remembered identity,
  reading scale, last-read page, and per-khatma du3a acknowledgement.
- Exact legacy keys, fallbacks, ranges, and the acknowledgement value `'1'` are
  preserved. Blocked or throwing storage falls back safely while React state
  remains usable.
- Focused tests cover all four behaviors and unavailable storage.
- Verification passed: typecheck, lint, 154 tests, production build, formatting,
  and diff checks. Bundle budgets were not rerun because no preview entry imports
  the new module and its bundle graph is unchanged.
- No data/domain, dependency, lockfile, legacy UI, or production-entry changes.

Detailed RM-340 evidence lives in [`tasks/RM-340.md`](tasks/RM-340.md). Earlier
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

# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-330 — charts and custom icon overrides           |
| Last completed code commit            | `382ff6c` — pushed to `origin/reactmigration`       |
| Active migration task                 | None                                                |
| Current phase                         | Phase 3; RM-300 through RM-330 are `DONE`           |
| Next recommended task                 | RM-340 — browser-persistence hooks (Codex)          |
| Then                                  | RM-350 — shared React test harness (Codex)          |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740 |
| Last updated                          | 2026-07-14                                          |

The documentation compaction is based on the clean, pushed RM-330 handoff at
`382ff6c`. Until the compaction itself is committed, documentation files are the
only expected changes after that code commit.

## Next-session read set — RM-340

Read only:

1. This file.
2. [`tasks/RM-340.md`](tasks/RM-340.md).
3. The Phase 3 table in [`TRACKER.md`](TRACKER.md#phase-3--shared-react-components-and-app-shells).
4. The exact UI-inventory sections linked from the task record.
5. Relevant source/tests discovered for RM-340.

Do not load the full historical migration plan, all completed task evidence, the
theme map, or the dependency audit for RM-340.

## Handoff from RM-330

- Claude completed RM-330 from clean commit `4cae693` and pushed task commit
  `382ff6c`.
- Added reusable React `DonutChart` and `SegmentBar` components plus an
  override-aware icon source/store and `useIconUrl`.
- `NavIcon` now consumes the icon store and both React preview entries start the
  PNG-over-SVG override probe.
- Verification passed: typecheck, lint, 149 tests, production build, bundle
  budgets, formatting/diff checks, and live mobile/desktop RTL checks.
- Latest recorded React-spike budgets: member 322.52/350 kB initial JS and
  368.63/400 kB transfer; admin 322.50/375 kB initial JS and 368.61/425 kB
  transfer.
- No data/domain, dependency, lockfile, legacy UI, or production-entry changes.
- The React icon probe intentionally requires an `image/*` content type because
  Vite returns its HTML SPA fallback for missing PNG `HEAD` requests in dev.

Detailed RM-330 evidence lives in [`tasks/RM-330.md`](tasks/RM-330.md). Earlier
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

# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-400 — member identity gate                       |
| Last completed code commit            | `16b4814` — `RM-400: add member identity gate`      |
| Active migration task                 | None                                                |
| Current phase                         | Phase 4 — member application migration              |
| Next recommended task                 | RM-410 — khatma list and landing routes (Codex)     |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740 |
| Last updated                          | 2026-07-14                                          |

RM-400 is committed at `16b4814`; this file is the exact-hash handoff update.

## Next-session read set — RM-410

Read only:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-410.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. Member UI-inventory sections 2.2 and 2.3 plus directly relevant member app,
   khatma/assignment selectors and subscriptions, series/progress domain logic,
   legacy khatma list/landing views, shared primitives, and test harness/tests.

Do not load the full historical migration plan, completed task evidence, theme
map, dependency audit, reader/personal/completion flows, or admin sources for
RM-410.

## Handoff from RM-400

- Added the React identity gate outside member navigation and backed it with the
  provider-owned Redux roster listener; no duplicate feature listener exists.
- Loading, empty, live roster, and connection-error states match the inventory.
- Selection preserves `khatma.memberId`; a typed context supplies live identity
  and switching, and the personal route exposes the switch action.
- Focused tests cover states, updates, persistence, switching, navigation,
  rerenders, and cleanup. Full verification passed: lint, 160 tests (1 skipped),
  production build, React bundle budgets, formatting, and diff checks.
- Emulator/browser QA passed on phone and desktop RTL with no overflow or console
  errors. Detailed evidence is in [`tasks/RM-400.md`](tasks/RM-400.md).
- MUI MCP is configured and documented; Recipes generation currently needs
  `MUI_RECIPES_API_KEY` in the environment.
- No dependency, lockfile, Firebase/data/domain, legacy UI, or production-entry
  changes.

Earlier history is retrievable through [`archive/README.md`](archive/README.md)
and is not startup context.

## Claim protocol

Before RM-410 implementation, confirm the clean handoff hash and dependencies,
then change only its tracker row to `IN PROGRESS`, create its task record,
rewrite this file with active scope/read set/risks, and run the smallest useful
baseline check. Do not append a chronological session log here.

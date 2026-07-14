# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-440 — Quran reader                               |
| Last completed code commit            | `8f644b7` — `RM-440: migrate the Quran reader`      |
| Active migration task                 | None                                                |
| Current phase                         | Phase 4 — member application migration              |
| Next recommended task                 | RM-450 — member component/integration tests         |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740 |
| Last updated                          | 2026-07-14                                          |

RM-440 was owned by Claude (tracker owner reassigned from Codex at owner
request) and is committed at `8f644b7`; this file is the exact-hash handoff
update.

## Next-session read set — RM-450

Read only after this exact-hash handoff commit:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-450.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. The React member app/routes (identity, khatma list/landing, personal,
   settings, completion interrupt, and the new `reader/`), the shared React test
   harness and existing member suites, and the reader loader-mock pattern in
   [`tasks/RM-440.md`](tasks/RM-440.md).

Do not load the full historical migration plan, completed task evidence, theme
map, dependency audit, admin sources, or production cutover work for RM-450.

## Handoff from RM-440

- Both member reader sub-routes are React: browse (`#/quran`, `#/quran/{page}`)
  and assigned (`#/khatma/{id}/read`), replacing the removed preview fallback in
  `MemberRouteContent`.
- The browse reader derives its page from the URL (last-read fallback); the
  assigned reader keeps index state in a component keyed `{khatmaId}:{round}` so
  realtime ticks never reset scroll/page while a new round remounts fresh.
- Reader source lives under `src/app/member/reader/`; `tests/app/member-reader.test.tsx`
  adds 9 scenarios (Quran loader mocked). Full verification passed: typecheck,
  lint, 185 tests (1 skipped), production and React builds, bundle budgets,
  formatting, and diff checks.
- Desktop 1280×800 and phone 390×844 RTL QA passed against the emulator: browse
  navigation/jumps/persistence, assigned finish→done with the reader surviving
  the realtime write, reading-scale sizing, no overflow, and no console errors.
- No dependency, data-layer, domain, legacy UI, admin, production-entry, or
  Firebase/rules changes.

Detailed evidence is in [`tasks/RM-440.md`](tasks/RM-440.md). Earlier history is
retrievable through [`archive/README.md`](archive/README.md) and is not startup
context.

## Claim protocol

Before RM-450 implementation, confirm the clean handoff and dependencies, then
change only its tracker row to `IN PROGRESS`, create its task record, rewrite
this file with active scope/read set/risks, and run the smallest useful baseline
check. Do not append a chronological session log here.

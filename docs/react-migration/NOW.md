# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                          |
| ------------------------------------- | ------------------------------------------------------ |
| Integration branch                    | `reactmigration`                                       |
| Branch base                           | `6992007` (`main` at migration start)                  |
| Last completed code task              | RM-430 — completion/du3a flow                          |
| Last completed code commit            | `f833b3c` — `RM-430: migrate completion and du3a flow` |
| Active migration task                 | None                                                   |
| Current phase                         | Phase 4 — member application migration                 |
| Next recommended task                 | RM-440 — Quran reader (Codex)                          |
| Open decisions affecting current work | None; OD-03 is needed by RM-460 and OD-04 by RM-740    |
| Last updated                          | 2026-07-14                                             |

RM-430 is committed at `f833b3c`; this file is the exact-hash handoff update.

## Next-session read set — RM-440

Read only after the exact-hash handoff commit:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-440.md` while claiming the task, using its tracker
   acceptance and discovered context.
4. Member UI-inventory sections 2.4–2.5 plus directly relevant member app,
   reader routes and legacy reader, Quran content loader, assignment state,
   reading-scale/last-page persistence, completion interrupt, shared feedback/
   navigation primitives, and test harness/tests.

Do not load the full historical migration plan, completed task evidence, theme
map, dependency audit, unrelated member routes, admin sources, or production
cutover work for RM-440.

## Handoff from RM-430

- Added a route-independent React completion boundary that keeps assignment
  subscriptions alive while unmounting member route content and navigation.
- The first active completed khatma belonging to the selected member interrupts
  the view until its exact `khatma.du3aAck.{id}` key is acknowledged; multiple
  completions are presented one at a time.
- Unset/self reciters receive live `content.du3aText` with the default fallback;
  other members receive the live roster name of the designated reciter.
- Added 5 focused scenarios and acknowledged completed fixtures in 2 existing
  RM-410 route tests. Full verification passed: lint, 176 tests (1 skipped),
  production and React builds, bundle budgets, formatting, and diff checks.
- Phone (390×844) and desktop (1280×800) RTL QA passed with no overflow,
  hidden navigation, restored route state, correct 25.6px Quran text, compact
  Done action, and no console warnings/errors.
- No dependency, data-layer, domain, legacy UI, admin, production-entry, or
  Firebase/rules changes.

Detailed evidence is in [`tasks/RM-430.md`](tasks/RM-430.md). Earlier history is
retrievable through [`archive/README.md`](archive/README.md) and is not startup
context.

## Claim protocol

Before RM-440 implementation, confirm the clean handoff and dependencies, then
change only its tracker row to `IN PROGRESS`, create its task record, rewrite
this file with active scope/read set/risks, and run the smallest useful baseline
check. Do not append a chronological session log here.

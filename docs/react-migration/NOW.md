# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                       |
| ------------------------------------- | --------------------------------------------------- |
| Integration branch                    | `reactmigration`                                    |
| Branch base                           | `6992007` (`main` at migration start)               |
| Last completed code task              | RM-450 — member component/integration tests         |
| Last completed code commit            | `42a4bad` — `RM-450: add member integration tests`  |
| Active migration task                 | None                                                |
| Current phase                         | Phase 4 — member application migration              |
| Next recommended task                 | RM-460 — member parity review                       |
| Open decisions affecting current work | OD-03 is needed by RM-460; OD-04 by RM-740          |
| Last updated                          | 2026-07-14                                          |

RM-450 was owned by Claude (tracker owner reassigned from Codex at owner
request). The exact-hash handoff is recorded by the follow-up `docs:` commit.

## Next-session read set — RM-460

Read only after this exact-hash handoff commit:

1. This file.
2. The Phase 4 table in
   [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Create `tasks/RM-460.md` while claiming the task, using its tracker
   acceptance and OD-03.
4. The root UI parity inventory's member checklist and the composed member app
   (`MemberApp`/`MemberExperience` and its routes under `src/app/member/`), then
   run the member preview against the emulator for mobile/desktop RTL parity.

RM-460 is a **Joint** parity review (mobile/desktop RTL) that depends on OD-03;
confirm that open decision before starting. Do not load the full historical
migration plan, completed task evidence, theme map, dependency audit, or admin
sources for RM-460.

## Handoff from RM-450

- Added `tests/app/member-integration.test.tsx` (4 scenarios) — the dedicated
  member **integration** layer above the per-feature RM-400..440 suites. It
  drives the composed member tree
  (`MemberIdentityBoundary` → `MemberExperience`) across continuous,
  cross-feature journeys the per-task suites do not:
  1. Gate → khatmas list → khatma landing → assigned reader → finish round.
  2. A realtime assignment tick received on `/personal` is reflected after
     navigating to the list, with the assignment listener still single
     (`starts:1, stops:0, active:1`).
  3. Switch person from the shell → gate returns and the previous member's
     assignment listener drops; picking another member subscribes only theirs.
  4. An unacknowledged completed khatma overlays the assigned reader route;
     acknowledgement restores the reader page, indicator, and chrome.
- The Quran loader (`@/content/quran/loader`) is mocked exactly as in
  `member-reader.test.tsx`, keeping reader routes deterministic and offline.
- Verification: typecheck, lint, `npm test` (34 files, 189 tests +4, 1 skipped),
  Prettier on the new file and changed docs, and `git diff --check` — all clean.
- No product source, data, domain, admin, production-entry, build-input, or
  Firebase/rules changes; bundle budgets and builds are unaffected and were not
  re-run.

Detailed evidence is in [`tasks/RM-450.md`](tasks/RM-450.md). Earlier history is
retrievable through [`archive/README.md`](archive/README.md) and is not startup
context.

## Claim protocol

Before RM-460 implementation, confirm the clean handoff and OD-03, then change
only its tracker row to `IN PROGRESS`, create its task record, rewrite this file
with active scope/read set/risks, and run the smallest useful baseline check. Do
not append a chronological session log here.

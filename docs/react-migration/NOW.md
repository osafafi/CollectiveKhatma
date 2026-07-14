# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-500 — admin shell + Home dashboard                      |
| Last completed code commit            | _recorded in the follow-up `docs: record RM-500 handoff hash`_ |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 5 — admin application migration                      |
| Next recommended task                 | RM-510 — Roster route                                      |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740      |
| Last updated                          | 2026-07-14                                                 |

Phase 5 has begun. RM-500 turned the admin React entry into the real admin shell
(persistent header + nav + routed content + active∪open assignment subscriptions)
and migrated the Home dashboard. The Home distribute/redistribute flow (same-day
guard P7, busy-disable P8) is verified emulator-backed. RM-500 inherits the OD-03
theme refresh via the shared theme.

## Handoff from RM-500

- New React admin sources under `src/app/admin/`: `AdminApp` (composition +
  route content), `AdminShell` (persistent `admin.heading` header),
  `AdminAssignmentsSubscriptions` (active ∪ open-detail listeners, **P9**),
  `pages/HomePage` (metrics + pending readers + warnings + distribute),
  `useQuranScopeMaps` (surah/juz maps for distribution), `todayIso` (React-owned
  local "today" — React must not import the legacy `src/ui` layer).
- Non-home admin routes (roster/khatmas/khatma/settings) render a navigable
  placeholder until RM-510–540 migrate them.
- Removed the orphaned Phase-3 admin preview scaffold (`PreviewShell`,
  `PrimitivesPreview`, `ChartsPreview`).
- Intentional deltas (recorded in [`tasks/RM-500.md`](tasks/RM-500.md)):
  distribution errors use an error tone + `role="alert"` (not the legacy uniform
  green); one `h1` per route (persistent title is a non-heading label).
- Gates: typecheck, lint, `npm test` (35 files / **197** tests, +7 / 1 skipped),
  console clean across the live admin walk.

## Next-session read set — RM-510 (Roster)

Read only after the RM-500 exact-hash handoff commit:

1. This file.
2. The Phase 5 table in
   [`TRACKER.md`](TRACKER.md#phase-5--admin-application-migration).
3. Create `tasks/RM-510.md` while claiming, using its tracker acceptance.
4. The **admin Roster** checklist in
   [`REACT_MIGRATION_UI_INVENTORY.md`](../../REACT_MIGRATION_UI_INVENTORY.md)
   §3.2, plus §4 **P4** (search caret/focus) and §5 quirk 5 (fire-and-forget
   mutations); legacy [`src/ui/admin/pages/roster.ts`](../../src/ui/admin/pages/roster.ts)
   and the React admin sources under `src/app/admin/`.

RM-510 (Roster) reuses the RM-500 shell and the shared form primitives
(`NumberStepper`, `Fields`, `AppButton`, confirmation). Keep the same
senior-friendly OD-03 standard. Do not load member sources or the full plan.

## Risks / notes for next task

- Search must preserve caret/focus across the keystroke re-render (**P4**) — a
  controlled MUI field handles this; the full draft-stability proof is RM-550.
- Match the legacy feedback granularity (§5 quirk 5): stepper/enable-disable/add
  are fire-and-forget; only create/edit-save show status. Flag if improved.
- The admin assignment-subscription set (active ∪ open detail, **P9**) lives in
  the RM-500 shell; RM-530 relies on the "open detail" half.

## Claim protocol

Before RM-510 implementation, confirm this clean handoff, change only its tracker
row to `IN PROGRESS`, create its task record, rewrite this file with active
scope/read set/risks, and run the smallest useful baseline check. Do not append a
chronological session log here.

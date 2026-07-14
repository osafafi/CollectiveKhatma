# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-510 — Roster route                                      |
| Last completed code commit            | `b0b73c3` — `RM-510: admin Roster route`                   |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 5 — admin application migration                      |
| Next recommended task                 | RM-520 — Khatmas list/create                               |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740      |
| Last updated                          | 2026-07-14                                                 |

RM-510 migrated the admin **Roster** route (`#/roster`) into the RM-500 admin
shell: search-as-you-type (caret/focus preserved, **P4**), per-person row
(muted+badged when disabled, min-1 pages/round stepper, enable/disable,
remove-with-confirm), the add form (name/note/pages with
`nameRequired`/`nameTaken` validation), and empty/no-match states — all
emulator-verified. RM-510 inherits the OD-03 theme via the shared theme.

## Handoff from RM-510

- New `src/app/admin/pages/RosterPage.tsx` (`AdminRosterPage`); `AdminApp`'s
  `AdminRouteContent` now routes `roster` → it. The placeholder covers only
  `khatmas`/`khatma`/`settings` until RM-520–540.
- Drafts (search text + add-form fields) are component-local `useState`; they
  survive live-snapshot re-renders (the P2/P4 parity case). The controlled search
  field keeps caret/focus without the legacy manual re-focus hack.
- Feedback granularity matches the legacy (§5 quirk 5): stepper/enable-disable/add
  writes are fire-and-forget; only the client-side add validation is surfaced.
- Intentional deltas (recorded in [`tasks/RM-510.md`](tasks/RM-510.md)): add
  validation carries `role="alert"` + error tone; remove uses the shared
  confirmation dialog on a danger tone; drafts are route-scoped (RM-550 formalizes
  the cross-form model).
- Gates: typecheck, lint, `npm test` (36 files / **205** tests, +8 / 1 skipped),
  console clean across the live admin roster walk.

## Next-session read set — RM-520 (Khatmas list/create)

Read only after the RM-510 exact-hash handoff commit:

1. This file.
2. The Phase 5 table in
   [`TRACKER.md`](TRACKER.md#phase-5--admin-application-migration).
3. Create `tasks/RM-520.md` while claiming, using its tracker acceptance.
4. The **admin Khatmas list + create** checklist in
   [`REACT_MIGRATION_UI_INVENTORY.md`](../../REACT_MIGRATION_UI_INVENTORY.md)
   §3.3, plus §4 **P2** (draft survival) and §5 quirk 4 (unused strings);
   legacy [`src/ui/admin/pages/khatmas.ts`](../../src/ui/admin/pages/khatmas.ts)
   and the React admin sources under `src/app/admin/` (`AdminApp`, `pages/`), the
   shared primitives under `src/components/primitives/`, and the `useQuranScopeMaps`
   / series helpers already used by Home.

RM-520 reuses the RM-500 shell and shared primitives and adds the draft-heavy
create form (scope select, member picker, per-member capacity, reciter, backfill,
series-continuation). Do not load member sources or the full plan.

## Risks / notes for next task

- The create form is the biggest admin draft (P2): scope/member/capacity/reciter
  state must survive unrelated snapshots — component-local state kept mounted does
  this; the full proof is RM-550.
- Series continuation (`findSeriesByName`/`nextSeriesNumber`) and the surah-name
  scope checklist need the surah maps (`useQuranScopeMaps`, already built for Home).
- Do not resurrect the §5-quirk-4 unused strings as "parity".

## Claim protocol

Before RM-520 implementation, confirm this clean handoff, change only its tracker
row to `IN PROGRESS`, create its task record, rewrite this file with active
scope/read set/risks, and run the smallest useful baseline check. Do not append a
chronological session log here.

# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-530 — Khatma detail route (with RM-520)                 |
| Last completed code commit            | `b0b73c3` — `RM-510: admin Roster route`                   |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 5 — admin application migration                      |
| Next recommended task                 | RM-540 — Admin Settings route                              |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740      |
| Last updated                          | 2026-07-14                                                 |

RM-520 + RM-530 migrated **both admin Khatmas routes** together (they share the
`startNext` create-form handoff and the surah-name data). Emulator-verified,
gates clean (typecheck / lint / **222** tests, +17, 1 skipped).

## Handoff from RM-520 + RM-530

- **RM-520** `#/khatmas` — `src/app/admin/pages/KhatmasPage.tsx`: list
  (active-first → `createdAt` desc, status badge + percent, detail link) and the
  gated create form (scope full/range/surahs, member picker, per-member additive
  capacity, reciter, backfill, series continuation). The whole create form is one
  lifted `draft` (survives snapshots **P2** and the show/hide toggle; resets on
  successful create).
- **RM-530** `#/khatmas/{id}` — `src/app/admin/pages/KhatmaPage.tsx`: header, edit
  card, members card (warning/clear, chunk toggle, return-to-pool, remove,
  capacity editor, add-member), controls (reciter, start-next, complete, delete),
  completed controls, history, loading/not-found.
- New shared pieces: `useSurahs.ts`, `SurahCapacitySelect.tsx`, and the
  `CreateKhatmaPrefill` context/provider (`createKhatmaPrefillContext.ts` +
  `CreateKhatmaPrefill.tsx`), wired into `AdminExperience`. `AdminApp` now routes
  `khatmas`/`khatma` to the real pages; only `settings` remains a placeholder.
- Intentional deltas (in the task records): create/edit statuses carry `role`
  + tone (a11y); confirmations use the shared RTL dialog; drafts are route-scoped
  (RM-510 delta, RM-550 formalizes); `startNext` hands off via a one-shot context
  (peek-then-clear-in-effect, StrictMode-safe) instead of a shared draft object.
- `admin-home.test.tsx`'s loader mock gained `getSurahs` (its P9 case now mounts
  the real detail page).

## Next-session read set — RM-540 (Admin Settings)

Read only after the RM-530 exact-hash handoff commit:

1. This file + the Phase 5 table in
   [`TRACKER.md`](TRACKER.md#phase-5--admin-application-migration).
2. Create `tasks/RM-540.md` while claiming, from its tracker acceptance.
3. Inventory §3.5 (Settings), §4 **P3** (`du3aTouched` guard), §5 quirk 5, and
   §1.3/§2.7 + **P11** (the shared reading-scale control) in
   [`REACT_MIGRATION_UI_INVENTORY.md`](../../REACT_MIGRATION_UI_INVENTORY.md);
   legacy [`src/ui/admin/pages/settings.ts`](../../src/ui/admin/pages/settings.ts)
   and the member Settings React page for the shared reading-scale control.

RM-540 is the smallest remaining admin page: the du3a editor (textarea seeded
from `content.du3aText`, `du3aTouched` snapshot guard, `setDu3aText` +
`saved`/`saveError`) and the shared 1–5 reading-scale control.

## Risks / notes for next task

- **P3:** once the du3a textarea is edited, incoming content snapshots must NOT
  overwrite it — seed once, then a touched guard (the mirror of the member/roster
  draft-survival pattern already used).
- **P11:** the reading scale is one shared localStorage-backed control across both
  apps — reuse the member settings control, do not fork it.
- After RM-540, RM-550 (draft-stability proof) can walk P2/P3/P4 across all admin
  forms now that create/edit/roster/settings drafts exist.

## Claim protocol

Confirm this clean handoff, flip only the RM-540 tracker row to `IN PROGRESS`,
create its task record, rewrite this file with active scope/read set/risks, and
run the smallest useful baseline check. Do not append a chronological session log.

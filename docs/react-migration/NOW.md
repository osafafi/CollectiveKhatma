# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                         |
| ------------------------------------- | ----------------------------------------------------- |
| Integration branch                    | `reactmigration`                                      |
| Branch base                           | `6992007` (`main` at migration start)                 |
| Last completed code task              | RM-610 — Cut over admin entry to React                |
| Last completed code commit            | Uncommitted; baseline `6c733e9`                       |
| Active migration task                 | None                                                  |
| Current phase                         | Phase 6 — cutover, cleanup, and end-to-end validation |
| Next recommended task                 | RM-620 — Remove legacy UI and Tailwind                |
| Open decisions affecting current work | OD-04 by RM-740                                       |
| Last updated                          | 2026-07-15                                            |

RM-600 + RM-610 complete the controlled production cutover. Both deployable HTML
inputs now mount React; the hidden admin filename and metadata are unchanged.
Gates are clean (typecheck/build, lint, **235** tests + 1 skipped, focused entry
contract, two built-page smokes, and bundle budgets).

## Handoff from RM-600 + RM-610

- `index.html` loads `src/app/entries/member.tsx`; `admin-nano.html` loads
  `src/app/entries/admin.tsx`.
- Both React entries set their localized runtime `document.title`, preserving the
  parity inventory §1.1 contract from the legacy bootstraps.
- Vite still publishes exactly the member and hidden admin production inputs.
  `react-preview.html` and `admin-react-preview.html` remain development-only.
- Built smokes passed: member `/` rendered the React member UI; hidden admin
  `/admin-nano.html#/home` resolved the React `home` route. Both retained Arabic
  RTL metadata and produced no console warnings/errors; admin retained
  `noindex, nofollow`.
- RM-040 budgets passed: member 341.62/387.73 kB against 350/400 kB JS/transfer;
  admin 342.32/388.43 kB against 375/425 kB.
- Tailwind and all legacy UI source remain intentionally present for RM-620.

## Next-session read set — RM-620 (Remove legacy UI and Tailwind)

1. This file + Phase 6 in `TRACKER.md` + `tasks/RM-600.md` and `tasks/RM-610.md`.
2. Create `tasks/RM-620.md` while claiming from tracker acceptance: legacy
   renderers/Tailwind gone, retained CSS independent, no dead imports.
3. Inventory `src/member.ts`, `src/admin.ts`, `src/ui/**`, Tailwind imports/plugin
   and configuration, plus any tests/docs that still encode the transition.
4. Separate CSS/assets still consumed by React from legacy-only CSS before
   deleting anything; the Quran font, shared static icons, and React theme assets
   are not legacy merely because legacy code also used them.
5. Run dead-import search, typecheck, lint, full tests, production build, and
   bundle budgets after cleanup.

## Risks / notes for next task

- Partial migration must not reach `main`; current work is uncommitted on
  `reactmigration` after exact baseline `6c733e9`.
- Do not remove data/domain modules under `src/data/**`; both React apps use those
  framework-independent contracts.
- Do not rename/expose the hidden admin entry or add a member-app link.
- The large shared production chunk warning is known; optimization and final
  bundle documentation are RM-630 after cleanup.

## Claim protocol

Confirm this two-entry cutover handoff, flip only RM-620 to `IN PROGRESS`, create
its task record, rewrite this file with active scope/read set/risks, and run the
smallest useful baseline check. Do not append a chronological session log.

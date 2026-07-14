# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-460 — member parity review + OD-03 refresh              |
| Last completed code commit            | `f34de3c` — `RM-460: member parity review + OD-03 refresh` |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 4 done → Phase 5 — admin application migration       |
| Next recommended task                 | RM-500 — admin shell and Home dashboard                    |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740      |
| Last updated                          | 2026-07-14                                                 |

Phase 4 exit is met: the React member preview has functional + RTL parity and the
OD-03 visual refresh is applied (approved deltas recorded). Realtime updates do
not reset reader state (P1, covered by RM-440/RM-450).

## Handoff from RM-460

- **OD-03 resolved** toward an intentional refresh (owner: fresh, modern,
  senior-friendly UI, reading-comfortable colors). Applied entirely at the theme
  level — no functional/data/domain/routing/listener change.
- Refreshed `src/theme/muiTheme.ts` (warm low-glare palette, calm emerald
  primary, distinct gold accent w/ dark text, higher contrast, softer card
  radius 18 + warm layered shadow, roomier line-heights) and
  `src/theme/globalStyles.ts` (keyboard `:focus-visible` ring). The React MUI
  palette now **intentionally diverges** from legacy `theme.css` (untouched;
  production until RM-600, deleted at RM-620).
- `tests/theme/mui-theme.test.ts` updated: pins refreshed values, asserts the
  accent/warn split (R3) and the intentional legacy divergence (+1 test).
- Member checklist walked emulator-backed on mobile + desktop RTL; all boxes
  confirmed. WCAG-AA contrast measured for every pair. Verification detail and
  the full approved-delta list: [`tasks/RM-460.md`](tasks/RM-460.md).
- Gates: typecheck, lint, `npm test` (34 files / **190** tests +1 / 1 skipped),
  console clean. Screenshots unavailable in the preview pane (raster capture
  times out) — verified via exact computed styles instead.

## Next-session read set — RM-500

Read only after the RM-460 exact-hash handoff commit:

1. This file.
2. The Phase 5 table in
   [`TRACKER.md`](TRACKER.md#phase-5--admin-application-migration).
3. Create `tasks/RM-500.md` while claiming, using its tracker acceptance.
4. The **admin** checklist in
   [`REACT_MIGRATION_UI_INVENTORY.md`](../../REACT_MIGRATION_UI_INVENTORY.md)
   §1, §3.1 (Home) and §4/§5 risks (P2/P3/P7/P8/P9), plus the admin React sources
   under `src/app/admin/` and the admin preview entry (`admin-react-preview.html`).

RM-500 (admin shell + Home dashboard) inherits the OD-03 refresh automatically
via the shared theme — no re-decision needed; keep the same senior-friendly,
reading-comfortable standard. Do not load member sources or the full historical
plan for RM-500.

## Risks / notes for next task

- Admin drafts must survive unrelated snapshots (P2) and the same-day distribute
  guard (P7) / busy-disable (P8) must hold — these are RM-500/RM-550 concerns.
- The refreshed theme is shared; admin surfaces get the new look for free. Verify
  admin still passes its own contrast/RTL when RM-570 reviews it.

## Claim protocol

Before RM-500 implementation, confirm this clean handoff, change only its tracker
row to `IN PROGRESS`, create its task record, rewrite this file with active
scope/read set/risks, and run the smallest useful baseline check. Do not append a
chronological session log here.

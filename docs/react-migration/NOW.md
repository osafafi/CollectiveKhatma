# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Integration branch                    | `reactmigration`                                                               |
| Branch base                           | `6992007` (`main` at migration start)                                          |
| Last completed code task              | RM-560 — Admin component/integration tests                                     |
| Last completed code commit            | `6402cf7` (RM-540+550); RM-560 + RM-570 complete on-branch, **commit pending** |
| Active migration task                 | None                                                                           |
| Current phase                         | Phase 6 — cutover, cleanup, and end-to-end validation                          |
| Next recommended task                 | RM-600 — Cut over member entry to React                                        |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740                          |
| Last updated                          | 2026-07-15                                                                     |

RM-560 + RM-570 close **Phase 5**. The React admin app now has an integration
test layer and a live, emulator-backed parity sign-off. Gates clean (typecheck /
lint / **235** tests, +4, 1 skipped); admin preview walked on mobile + desktop
RTL with a live write round-trip.

## Handoff from RM-560 + RM-570

- **RM-560** `tests/app/admin-integration.test.tsx` (4 scenarios) — the admin
  parallel of `member-integration.test.tsx`: cross-feature journeys through the
  composed `AdminExperience`. (1) create → live snapshot → detail → edit (CRUD +
  validation); (2) distribute → completion snapshot drops the khatma **and
  releases its listener** (**P10**); (3) navigation off a completed detail
  releases only that listener while the active one persists (**P9→P10**); (4)
  distribution error → alert → re-enabled → retry succeeds (error flow). No source
  changes. The steady-state admin P-rows were already covered (P7/P8/P9 in
  `admin-home`, P2/P3/P4 in `admin-draft-stability`/`admin-settings`); RM-560 adds
  only the dynamic P10 the per-route suites do not exercise.
- **RM-570** admin parity review — all §3 routes + §1/§6 confirmed live on the
  emulator (metrics, roster search+caret, create scope/members/capacity/reciter/
  continuation note, detail members/warning/return-to-pool/history, settings du3a
  seeded from Firestore + shared reading scale, desktop right-rail vs mobile
  bottom-bar RTL). One live `updatePerson` round-trip proved the write path.
  **OD-03 already RESOLVED (RM-460)** — the admin app inherits the same
  centralized refreshed theme (palette values match RM-460 exactly), so its visual
  layer is the same approved delta; no new owner decision was needed.
- Observation (shared, not a blocker): route headings render ink `#26312b` — the
  `color="primary.main"` prop yields no color rule on the h2 heading, **identical
  in the member app** (accepted in RM-460), legible, under the refresh umbrella.
  A candidate for a future shared-theme touch-up, recorded in `tasks/RM-570.md`.

## Next-session read set — RM-600 (Cut over member entry to React)

Read only after the RM-560 + RM-570 exact-hash handoff commit:

1. This file + the Phase 6 table in
   [`TRACKER.md`](TRACKER.md#phase-6--cutover-cleanup-and-end-to-end-validation).
2. Create `tasks/RM-600.md` while claiming, from its tracker acceptance
   (production member entry mounts React; smoke + build checks pass).
3. The production entry wiring: `vite.config.ts` inputs (`index.html` = member
   production, `react-preview.html` = the React member preview) and the entries
   `src/app/entries/member.tsx` vs the legacy member bootstrap. RM-600 flips the
   **production** member entry to the React tree without disturbing the admin
   entry (admin cutover is RM-610, and depends on RM-600).
4. The bundle budgets (RM-040) — member 350/400 kB JS/transfer — since a cutover
   changes what production ships; re-run the budget/build check.

## Risks / notes for next task

- Partial migration must not reach `main`; cross-agent handoff needs a clean,
  committed exact hash (this session's RM-560 + RM-570 commit is **pending**).
- **Screenshots** in the preview browser time out (a browser-pane quirk, not an
  app fault — `read_page`/`get_page_text`/`javascript_tool`/console are clean).
  Verify via the DOM/a11y tree + computed styles, as RM-460/RM-570 did.
- The emulator seed (`npm run seed`) is verified working; RM-600 is a production
  entry/build change, so prioritize `npm run build` + a member smoke over jsdom.
- RM-610 (admin cutover) is unblocked by RM-570 but gated on RM-600 first.

## Claim protocol

Confirm this clean handoff, flip only the RM-600 tracker row to `IN PROGRESS`,
create its task record, rewrite this file with active scope/read set/risks, and
run the smallest useful baseline check. Do not append a chronological session log.

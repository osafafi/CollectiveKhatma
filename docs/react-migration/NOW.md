# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                              |
| ------------------------------------- | ---------------------------------------------------------- |
| Integration branch                    | `reactmigration`                                           |
| Branch base                           | `6992007` (`main` at migration start)                      |
| Last completed code task              | RM-550 — form-draft stability (with RM-540)                |
| Last completed code commit            | `907e35d` (RM-520+530); RM-540+550 complete on-branch, **commit pending** |
| Active migration task                 | None                                                       |
| Current phase                         | Phase 5 — admin application migration                      |
| Next recommended task                 | RM-560 — Admin component/integration tests                 |
| Open decisions affecting current work | OD-03 RESOLVED (intentional refresh); OD-04 by RM-740      |
| Last updated                          | 2026-07-14                                                 |

RM-540 + RM-550 migrated the **Admin Settings route** and pinned **form-draft
stability** across every admin form. With RM-540 the admin app has **no route
placeholders left** — all five hashes render real pages. Gates clean
(typecheck / lint / **231** tests, +9, 1 skipped); emulator-verified.

## Handoff from RM-540 + RM-550

- **RM-540** `#/settings` — `src/app/admin/pages/SettingsPage.tsx`
  (`AdminSettingsPage`): the du3a editor (`Du3aEditor` — seeded from live
  `content.du3aText`, `setDu3aText` on save, `saved`/`saveError` status, **P3**
  touched guard) and the shared reading-scale control.
- **New shared primitive** `src/components/primitives/ReadingScaleControl.tsx`:
  the 1–5 reading-scale `<details>` popover **extracted from the member
  `SettingsPage`** so both apps use one control (**P11**, reused not forked). The
  member page now consumes it (its RM-420 tests unchanged).
- **`AdminApp`** `AdminRouteContent` now lifts `useReadingScale()` +
  `settingsOpen` (like the member app), routes `settings` → the real page, and
  **the dead `AdminRoutePlaceholder` / `PENDING_ROUTE_HEADING` are removed**.
- **RM-550** — `tests/app/admin-draft-stability.test.tsx`: one consolidated proof
  that live snapshots don't clobber drafts — P2 create form, P2 edit card, P2
  add-person, P4 search caret. P3 (du3a) lives in `admin-settings.test.tsx`. No
  source changes; the stability already existed (RM-510 draft-scope delta).
- Intentional deltas (in the task records): du3a save carries `role`+tone (a11y);
  drafts are component-local/route-scoped (P2/P3); the reading scale is one shared
  localStorage-backed control (P11).

## Next-session read set — RM-560 (Admin component/integration tests)

Read only after the RM-540 + RM-550 exact-hash handoff commit:

1. This file + the Phase 5 table in
   [`TRACKER.md`](TRACKER.md#phase-5--admin-application-migration).
2. Create `tasks/RM-560.md` while claiming, from its tracker acceptance
   (critical CRUD, distribution, validation, listener, and error flows).
3. The existing admin suites to consolidate/extend, not duplicate:
   `tests/app/admin-{home,roster,khatmas,khatma,settings,draft-stability}.test.tsx`
   and the shared harness `tests/support/reactTestHarness.tsx`.
4. Inventory §4 (the P1–P11 risk oracle) — RM-560 is where the remaining admin
   P-rows (listener sets **P9**, same-day guard **P7**, busy-disable **P8**) get
   their explicit regression tests if a prior task did not already cover them.

## Risks / notes for next task

- Prefer **extending** the per-route admin suites over a new mega-file; the
  harness already seeds Firestore publishers and swappable write operations.
- **Screenshots** in the preview browser were timing out this session (a
  browser-pane quirk, not an app fault — `read_page`/`javascript_tool` and the
  console were clean). Verify via `read_page` + `get_page_text` if it recurs.
- The seed script (`npm run seed`) was verified this session — see below.

## Emulator seed status (verified 2026-07-14)

`scripts/seed-emulator.ts` seeds **correctly**: cleared + re-seeded, then checked
every CLAUDE.md invariant (page conservation over 1..604 = 0 missing / 0 double,
streak/warning, `completedPages`, round settling) — all hold. The Home dashboard
renders the intended demo (أهل القرآن ١, ١٠٪, ٦٠ read · ١ pending · ٥٤٣ remaining,
مريم yellow). Only fix applied: a **misleading docstring** in `seedKhatma` (it
claimed round 2 *releases + re-serves* مريم's page; the engine never auto-releases
— she keeps it pending). The `MetadataLookupWarning` on run is a benign
firebase-admin metadata probe, not a seed fault.

## Claim protocol

Confirm this clean handoff, flip only the RM-560 tracker row to `IN PROGRESS`,
create its task record, rewrite this file with active scope/read set/risks, and
run the smallest useful baseline check. Do not append a chronological session log.

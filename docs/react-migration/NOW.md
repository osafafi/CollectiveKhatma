# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                 |
| ------------------------------------- | --------------------------------------------- |
| Integration branch                    | `reactmigration`                              |
| Branch base                           | `6992007` (`main` at migration start)         |
| Last completed code task              | RM-410 — khatma list and landing routes       |
| Last completed code commit            | `5ebed75` — RM-410 implementation             |
| Exact handoff commit                  | `11b955f` — RM-410 documentation handoff      |
| Active migration task                 | RM-420 — personal and settings routes (Codex) |
| Current phase                         | Phase 4 — member application migration        |
| Next recommended task                 | None while RM-420 is active                   |
| Open decisions affecting current work | None                                          |
| Last updated                          | 2026-07-14                                    |

RM-420 was claimed from a clean `reactmigration` worktree at exact handoff
commit `11b955f`. Dependencies RM-310 and RM-340 are complete.

## Active scope — RM-420

- Implement the React `#/personal` route with selected-member identity,
  lifetime completed-page insight, percentage/progress, and switch-person action.
- Implement the React `#/settings` route with the compatible 1–5 reading-scale
  control, live application, sample text, and remembered value.
- Preserve existing member navigation and browser-local persistence semantics.
- Add focused integration coverage for live personal data, settings persistence,
  scale application, and navigation.

## Read set

1. This file and [`tasks/RM-420.md`](tasks/RM-420.md).
2. The Phase 4 row in [`TRACKER.md`](TRACKER.md#phase-4--member-application-migration).
3. Member UI-inventory [§2.6](../../REACT_MIGRATION_UI_INVENTORY.md#26-personal-صفحتي--personal)
   and [§2.7](../../REACT_MIGRATION_UI_INVENTORY.md#27-settings-الإعدادات--settings).
4. Directly relevant React member app/shell/identity/navigation, roster state,
   persistence, shared primitives, legacy personal/settings views, and tests.

Do not load the historical migration plan, completed-task evidence, theme map,
dependency audit, reader/completion flows, admin sources, or unrelated routes.

## Boundaries and risks

- Keep reading scale in browser persistence, not Redux or Firestore.
- Reuse the shared roster subscription and identity context; add no route-local
  realtime subscriptions.
- Preserve the legacy 604-page lifetime percentage and empty/zero behavior.
- Apply reading scale without pulling Quran-reader migration into RM-420.
- Do not change legacy UI, production entries, dependencies/lockfile, Firebase
  schema/rules, admin behavior, or unrelated member routes.

## Exit protocol

Complete focused and full verification, update `tasks/RM-420.md` with evidence,
mark only the RM-420 tracker row `DONE`, commit implementation, then replace this
file with the exact-hash handoff and next recommended task.

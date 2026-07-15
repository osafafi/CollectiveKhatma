# React Migration Tracker

This is the canonical source for task owner, status, dependencies, and concise
acceptance. Detailed evidence belongs in `tasks/RM-xxx.md` or, for work completed
through RM-330, in the Git snapshot documented under `archive/`.

Use only: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `DONE`, or `DEFERRED`.

## Phase 0 — Baseline, inventory, and governance

| ID     | Task                                     | Owner  | Status | Depends on     | Concise acceptance/evidence                                                            |
| ------ | ---------------------------------------- | ------ | ------ | -------------- | -------------------------------------------------------------------------------------- |
| RM-000 | Create migration plan and branch rules   | Codex  | DONE   | —              | `reactmigration` governance established.                                               |
| RM-010 | Confirm baseline health                  | Codex  | DONE   | RM-000         | Typecheck, lint, 66 tests, and production build passed.                                |
| RM-020 | Build route-by-route UI parity inventory | Claude | DONE   | RM-000         | Root UI inventory covers all routes, states, persistence, RTL, and baseline quirks.    |
| RM-030 | Record React architecture addendum       | Claude | DONE   | RM-020, RM-260 | `ARCHITECTURE.md` documents implemented branch-only React architecture and boundaries. |
| RM-040 | Establish bundle/performance budgets     | Codex  | DONE   | RM-120, RM-200 | Budget checker enforces member 350/400 kB and admin 375/425 kB JS/transfer ceilings.   |

Phase exit: baseline health and parity inventory are recorded with no hidden
baseline failure.

## Phase 1 — Node, dependencies, and developer tooling

| ID     | Task                                    | Owner  | Status | Depends on     | Concise acceptance/evidence                                           |
| ------ | --------------------------------------- | ------ | ------ | -------------- | --------------------------------------------------------------------- |
| RM-100 | Pin Node 24 LTS consistently            | Codex  | DONE   | RM-010         | Node 24.18.0 aligned across local metadata, CI, deploy, and docs.     |
| RM-110 | Audit/group dependency updates          | Codex  | DONE   | RM-100         | Root dependency audit classifies all direct packages and timing.      |
| RM-115 | Map Tailwind tokens/components to MUI   | Claude | DONE   | RM-020         | Root theme map covers tokens, components, retained CSS, and risks.    |
| RM-120 | Install React/MUI/Redux toolchain       | Codex  | DONE   | RM-110         | Reviewed toolchain installed; clean install and full baseline passed. |
| RM-130 | Configure TypeScript/Vite/ESLint/Vitest | Codex  | DONE   | RM-120         | React compilation, refresh, lint, and jsdom tests configured.         |
| RM-140 | Update CI/deploy tooling                | Codex  | DONE   | RM-100, RM-130 | CI/deploy use pinned Node and run React-aware quality gates.          |
| RM-150 | Verify clean toolchain installation     | Codex  | DONE   | RM-140         | Fresh install and complete legacy/React quality suite passed.         |

Phase exit: one Node LTS line is used everywhere and the legacy application
continues to build and pass.

## Phase 2 — React, MUI, routing, and Redux foundations

| ID     | Task                                       | Owner  | Status | Depends on                     | Concise acceptance/evidence                                                         |
| ------ | ------------------------------------------ | ------ | ------ | ------------------------------ | ----------------------------------------------------------------------------------- |
| RM-200 | Create React structure and preview entries | Codex  | DONE   | RM-130                         | Dev-only member/admin React previews exist; production remains legacy-only.         |
| RM-210 | Implement centralized MUI RTL theme        | Claude | DONE   | RM-115, RM-130                 | RTL Emotion/MUI theme matches mapped tokens including portals and retained CSS.     |
| RM-220 | Implement typed hash routing               | Codex  | DONE   | RM-200                         | Shared typed contract preserves all existing hashes and fallbacks.                  |
| RM-230 | Create Redux store, hooks, and slices      | Codex  | DONE   | RM-200                         | Serializable normalized state, typed hooks/selectors, and listener statuses tested. |
| RM-240 | Bridge Firestore subscriptions into Redux  | Codex  | DONE   | RM-230                         | Reference-counted listeners handle snapshots/errors and Strict Mode cleanup.        |
| RM-250 | Integrate writes and operation feedback    | Codex  | DONE   | RM-230                         | All existing mutations exposed through typed, retryable, latest-call-safe feedback. |
| RM-260 | Verify foundation behavior                 | Codex  | DONE   | RM-210, RM-220, RM-240, RM-250 | Composed provider/router/store/write behavior and emulator path verified.           |

Phase exit: the React previews navigate and react to Firestore without duplicate
listeners or data/domain contract changes.

## Phase 3 — Shared React components and app shells

| ID     | Task                                       | Owner  | Status | Depends on     | Concise acceptance/evidence                                                           |
| ------ | ------------------------------------------ | ------ | ------ | -------------- | ------------------------------------------------------------------------------------- |
| RM-300 | Providers, error boundary, feedback states | Claude | DONE   | RM-210, RM-230 | Shared provider composition, async feedback, error fallback, and snackbar tested.     |
| RM-310 | Responsive shells and navigation           | Claude | DONE   | RM-210, RM-220 | Member/admin bottom-nav and desktop RTL rail preserve routes and accessibility.       |
| RM-320 | Shared MUI form/display primitives         | Codex  | DONE   | RM-210         | Actions, surfaces, fields, steppers, status/progress, and confirmation tested.        |
| RM-330 | Charts and custom icon overrides           | Claude | DONE   | RM-210         | `382ff6c`; charts and PNG-over-SVG icon store tested and live-verified.               |
| RM-340 | Browser-persistence hooks                  | Codex  | DONE   | RM-200         | Four typed hooks preserve exact keys/fallbacks and tolerate blocked storage; 5 tests. |
| RM-350 | Shared React test harness                  | Codex  | DONE   | RM-230, RM-300 | Shared provider render, seeded publishers, routing, cleanup, and isolation; 3 tests.  |

Phase exit: feature work can compose stable shared contracts without duplicating
provider setup or editing legacy DOM helpers.

## Phase 4 — Member application migration

| ID     | Task                               | Owner  | Status | Depends on                             | Concise acceptance/evidence                                                              |
| ------ | ---------------------------------- | ------ | ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| RM-400 | Identity gate and member switching | Codex  | DONE   | RM-240, RM-310, RM-340                 | Live roster gate, persistence, switching, cleanup tests, and RTL QA pass.                |
| RM-410 | Khatma list and landing routes     | Codex  | DONE   | RM-240, RM-310, RM-320                 | Relevant khatmas, progress, assignments, warnings, history, and errors match baseline.   |
| RM-420 | Personal and settings routes       | Codex  | DONE   | RM-310, RM-340                         | Personal insight, scale, navigation, and remembered settings match baseline.             |
| RM-430 | Completion/du3a flow               | Codex  | DONE   | RM-240, RM-340                         | Reciter variants, content, acknowledgement, and navigation suppression match.            |
| RM-440 | Quran reader                       | Claude | DONE   | RM-220, RM-250, RM-320, RM-340         | Browse/assigned reading, navigation, scale, finish, errors, and stable scroll/page work. |
| RM-450 | Member component/integration tests | Claude | DONE   | RM-400, RM-410, RM-420, RM-430, RM-440 | Critical route, realtime, identity, completion, and reader behavior automated.           |
| RM-460 | Member parity review               | Joint  | DONE   | RM-450                                 | Member checklist walked on mobile/desktop RTL; OD-03 refresh applied as approved deltas. |

Phase exit: the React member preview has functional parity and realtime updates
do not reset reader state.

## Phase 5 — Admin application migration

| ID     | Task                              | Owner  | Status | Depends on                             | Concise acceptance/evidence                                                                         |
| ------ | --------------------------------- | ------ | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| RM-500 | Admin shell and Home dashboard    | Claude | DONE   | RM-240, RM-250, RM-310, RM-320         | Metrics, warnings, distribute/redistribute, same-day guard, and status outcomes match (RM-500).     |
| RM-510 | Roster route                      | Claude | DONE   | RM-250, RM-320                         | Search (caret/focus), CRUD, min-1 stepper, enablement, uniqueness, and confirmation match (RM-510). |
| RM-520 | Khatmas list/create/continue      | Claude | DONE   | RM-250, RM-320                         | Scope, continuation, members, capacities, validation, and drafts work (RM-520).                     |
| RM-530 | Khatma detail route               | Claude | DONE   | RM-250, RM-320                         | Progress, assignments, edits, releases, warnings, completion, delete, and history work (RM-530).    |
| RM-540 | Admin Settings route              | Claude | DONE   | RM-250, RM-320                         | Global du3a edit/save/error and shared reading-scale control match baseline (RM-540).               |
| RM-550 | Prove form-draft stability        | Claude | DONE   | RM-500, RM-510, RM-520, RM-530, RM-540 | Live snapshots keep create/edit/add-person/du3a drafts and search caret intact (RM-550).            |
| RM-560 | Admin component/integration tests | Claude | DONE   | RM-550                                 | Critical CRUD, distribution, validation, listener, and error flows automated (RM-560).              |
| RM-570 | Admin parity review               | Joint  | DONE   | RM-560                                 | Admin checklist passes mobile/desktop RTL live; refresh inherited from RM-460 (RM-570).             |

Phase exit: the React admin preview has functional parity and realtime updates
do not disrupt in-progress forms.

## Phase 6 — Cutover, cleanup, and end-to-end validation

| ID     | Task                               | Owner                     | Status      | Depends on     | Concise acceptance/evidence                                                                 |
| ------ | ---------------------------------- | ------------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------- |
| RM-600 | Cut over member entry to React     | Joint                     | DONE        | RM-460         | React production entry; build/smoke pass; 341.62/387.73 kB within 350/400 kB budgets.       |
| RM-610 | Cut over admin entry to React      | Joint                     | DONE        | RM-570, RM-600 | React hidden entry; route/build smoke passes; 342.32/388.43 kB within 375/425 kB budgets.   |
| RM-620 | Remove legacy UI and Tailwind      | Joint                     | NOT STARTED | RM-610         | Legacy renderers/Tailwind are gone; retained CSS is independent; no dead imports.           |
| RM-630 | Optimize and document bundles      | Codex                     | NOT STARTED | RM-620, RM-040 | Route splitting/imports reviewed and final sizes recorded against budgets.                  |
| RM-640 | Emulator cross-client validation   | Joint                     | NOT STARTED | RM-610         | Two clients verify realtime reads/writes/distribution/completion/reload/reconnect/cleanup.  |
| RM-650 | Accessibility, RTL, responsive QA  | Claude                    | NOT STARTED | RM-620         | Keyboard, focus, labels, contrast, direction, portals, sizing, and layouts pass.            |
| RM-660 | Authorized staging/live smoke test | Project owner + one agent | NOT STARTED | RM-640, RM-650 | With explicit authorization, production-like Firebase reads/writes pass without deployment. |
| RM-670 | Update all project documentation   | Joint                     | NOT STARTED | RM-620, RM-630 | User/developer docs match final implementation and setup.                                   |

Phase exit: both production entries use React, legacy UI/Tailwind are gone, and
the app is validated end to end without changing `main` prematurely.

## Phase 7 — Merge readiness and controlled handoff to main

| ID     | Task                                | Owner          | Status      | Depends on                     | Concise acceptance/evidence                                                         |
| ------ | ----------------------------------- | -------------- | ----------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| RM-700 | Final clean quality suite           | Codex          | NOT STARTED | RM-630, RM-640, RM-650, RM-670 | Clean install, typecheck, lint, all tests, build, and CI pass.                      |
| RM-710 | Review delta against current `main` | Joint          | NOT STARTED | RM-700                         | Changes since `6992007` reconciled without unrelated overwrite.                     |
| RM-720 | Joint code/behavior review          | Codex + Claude | NOT STARTED | RM-710                         | Boundaries, subscriptions, parity, dead code, docs, and risks jointly reviewed.     |
| RM-730 | Merge summary and rollback plan     | Codex          | NOT STARTED | RM-720                         | Summary covers changes, verification, bundles, data compatibility, risks, rollback. |
| RM-740 | Owner approval and merge to `main`  | Project owner  | NOT STARTED | RM-730                         | Explicit owner authorization is obtained before merge.                              |

# React Migration Plan & Progress Tracker

This document is the shared source of truth for migrating the member and admin
UIs from framework-free TypeScript + Tailwind CSS to React + Material UI (MUI) +
Redux Toolkit. It is both an implementation plan and the cross-session handoff
log for Codex, Claude, and the project owner.

Do not treat a task as complete merely because code exists. A task is complete
only when its acceptance criteria pass, its verification evidence is recorded,
and this document is updated.

> **Claude review — 2026-07-13.** Verified the Baseline Snapshot against the repo:
> 66 tests / 7 files green, UI 3,434 + data/domain 1,881 lines, two entries
> (`index.html`→`src/member.ts`, `admin-nano.html`→`src/admin.ts`), Vite 8,
> CI/deploy on Node 22, local Node 24.14.0 — all accurate. Primary change: added
> [§Operating Mode — Sequential Single-Writer Handover](#operating-mode--sequential-single-writer-handover-default)
> as the **default** execution protocol, because in this environment the two
> agents run one-at-a-time with the owner relaying between them, not concurrently.
> The parallel lanes/waves are retained as the dependency-ordering map. See new
> OD-05/OD-06 and the Session Log entry. Minor remarks in [§Claude Review Notes](#claude-review-notes--2026-07-13).

## Migration Status

| Field | Current value |
| --- | --- |
| Integration branch | `reactmigration` |
| Branch base | `6992007` (`main` at migration start) |
| Overall status | Implementation in progress |
| Current phase | Phase 0 and Phase 1 complete; Phase 2 in progress (RM-200 done) |
| Next milestone | RM-210 — Implement centralized MUI RTL theme |
| Last updated | 2026-07-13 |
| Primary agents | Codex and Claude |

### Status vocabulary

Use exactly one of these values in task tables:

- `NOT STARTED` — no implementation work has begun.
- `IN PROGRESS` — an agent owns the task and has active or unmerged work.
- `BLOCKED` — progress requires a documented decision or external action.
- `DONE` — acceptance criteria and required verification have passed.
- `DEFERRED` — explicitly removed from this migration with an explanation.

## Git Branch Strategy

`main` remains the stable pre-migration baseline and must not receive partial
React migration work. The long-lived `reactmigration` branch is the integration
branch for the entire migration. All completed migration work must converge
there and mature there before any merge to `main` is proposed. When Codex and
Claude need true parallel Git work, use short-lived branches named
`reactmig-<task-id>-<agent>` created from the latest `reactmigration` commit;
merge them back into `reactmigration` only after their scoped checks pass.
Never force-push shared migration branches, never merge `reactmigration` into
`main` without the project owner's explicit approval, and do not deploy a
migration preview as the production site. The final merge is allowed only after
all merge-readiness gates in this document are satisfied.

> **Resolved topology (OD-06, 2026-07-13):** work runs in a single shared working
> tree with one active agent, so the `reactmig-<task-id>-<agent>` task branches
> above are **not used** — commit once per task directly on `reactmigration`. The
> task-branch path is retained only as the parallel opt-in (see §Operating Mode ▸
> *Enabling true parallelism later*).

### Commit and integration rules

- Prefer one task or tightly related task group per commit.
- Prefix migration commits with the task ID, for example
  `RM-240: connect Firestore listeners to Redux`.
- Before starting, update from `reactmigration` and inspect the working tree.
- Preserve unrelated user changes and local-only files.
- An agent must not edit a file currently owned by another active task.
- Do not combine dependency/runtime upgrades with screen conversions in the
  same commit.
- Merge platform changes before feature branches that depend on them.
- Resolve conflicts by preserving accepted behavior, not simply by choosing the
  newest file wholesale.

## Operating Mode — Sequential Single-Writer Handover (default)

> Added by Claude (2026-07-13) at the owner's request. This section defines *how*
> the protocol below is executed and takes precedence over the parallel-wave
> guidance wherever they conflict. The lanes and waves further down remain valid
> as the **dependency-ordering map** — they say what may happen in what order, not
> that two agents run at once. Concurrent execution is an opt-in advanced mode
> (OD-05/OD-06), never the default.

**Environment reality.** There is one repository working tree; one agent runs at a
time; the project owner relays between Codex and Claude by hand. Agents cannot see
each other's uncommitted work. The only synchronization channels are (1) git
commits on `reactmigration`, (2) this document, and (3) the owner. Sequential
single-writer operation is therefore the lowest-risk default, and it neutralizes
the two largest collaboration risks in the Risk Register (concurrent edits to
shared files; conflicting edits to this tracker) by construction.

### Invariants

1. **One active agent.** At any moment exactly one agent is active. No task is ever
   owned or edited by both agents at once.
2. **Hand over at task boundaries.** Prefer to hand over only when the current
   task(s) are `DONE`. If you must stop mid-task, keep the task `IN PROGRESS` under
   *your* name and hand back to the **same** agent — the other agent must not adopt
   an in-progress task.
3. **Committed handoff** (amends *End of every session* step 4). Across an agent
   handoff, all work must be committed to `reactmigration` (single shared tree —
   the resolved OD-06 default; a pushed `reactmig-*` branch applies only under the
   parallel opt-in). A dirty working tree may be handed *back to the same agent*
   but never *across* agents, so the receiver always starts from a clean, named
   commit with no unattributed changes.
4. **Tracker travels with the code.** Update this document in the same commit as
   (or an immediately following commit to) the work it describes, so the plan and
   the tree never disagree at a handoff point.

### Finishing agent — emit a Handoff Instruction Block

When you finish and want to hand over, output this copy-pasteable block to the
owner in chat (this is the "exact instructions to hand over" the owner asked for):

```text
HANDOFF — <from-agent> ▸ <to-agent>

Completed this session: <task IDs> → DONE
Verification: <commands + results, e.g. typecheck ✓ / lint ✓ / 66 tests ✓ / build ✓>

Git state:
- branch: reactmigration
- HEAD:   <short hash>  "<commit subject>"
- pushed: <yes/no — remote if yes>
- working tree: clean

Owner, to hand over:
1. Move the tree (single shared tree — resolved OD-06):
   nothing to move — the tree is already at <hash>, clean; start the next agent in
   the same folder. (Parallel opt-in only: a separate clone would instead run
   `git fetch && git checkout reactmigration && git pull` to reach <hash>.)
2. Start <to-agent> and paste:
   "You are on Ranqur's reactmigration branch. Read REACT_MIGRATION_PLAN.md
    (top → active phase → latest Session Log). Confirm HEAD is <hash> and the tree
    is clean, then take <next task ID>. Set it IN PROGRESS under your name and
    append a Session Log entry before broad changes."

Next task: <id> — <one line: why it is next and its DONE dependencies are met>
Watch-outs for the next agent: <short list or "none">
```

### Receiving agent — preflight before touching code

1. Confirm branch is `reactmigration` (or the named task branch) and `git status`
   is clean.
2. Confirm `HEAD` equals the hash in the Handoff Block. If it differs, stop and
   tell the owner — do not proceed.
3. If `package-lock.json` changed since your last session, run `npm ci`.
4. Run the smallest useful baseline check for the area you are about to touch.
5. Only then set the next task `IN PROGRESS`, record yourself as owner, and append
   a Session Log entry.

### Enabling true parallelism later

Real concurrent work requires **separate worktrees or clones per agent** (each with
its own index/HEAD) plus per-task `reactmig-<task>-<agent>` branches, pushed and
merged back into `reactmigration` by a single integration committer. Do not attempt
concurrent work in one shared tree. Resolve OD-05/OD-06 before enabling it.

## Cross-Session Working Protocol

### At the beginning of every session

1. Confirm the current branch. It must be `reactmigration` or an approved
   `reactmig-*` task branch.
2. Read this document from the top through the active phase and latest session
   log entries.
3. Inspect `git status` and do not overwrite another agent's uncommitted work.
4. Select tasks whose dependencies are `DONE`.
5. Set the selected task to `IN PROGRESS`, record the agent as owner, and append
   a session-log entry before making broad changes.
6. Run the smallest useful baseline check for the files being changed.

### At the end of every session

1. Run all checks required by the task's acceptance criteria.
2. Update status, owner, evidence, and relevant decisions in this document.
3. Append a session-log entry with changed areas, verification, open risks, and
   the recommended next task.
4. State whether the work is committed, uncommitted, or on a task branch. Across
   an agent handoff it must be **committed** — see §Operating Mode invariant 3.
5. Leave no undocumented partial migration or hidden follow-up requirement.

### Handoff entry format

```text
### YYYY-MM-DD — <Agent> — <Task IDs>

- Branch/commit:
- Outcome:
- Files/areas changed:
- Verification:
- Decisions and risks:
- Recommended next action:
```

## Baseline Snapshot

The migration begins from the behavior and architecture at commit `6992007`.
This is the reference point for parity decisions.

| Item | Baseline |
| --- | --- |
| UI | Framework-free TypeScript DOM rendering + Tailwind CSS 4 |
| Bundler | Vite 8, two HTML entries |
| Production runtime | Static GitHub Pages assets; no Node server |
| Data | Firebase/Firestore browser SDK with `onSnapshot` subscribers |
| Business logic | Pure TypeScript under `src/domain/` |
| Local Node | `24.14.0` at planning time |
| CI/deploy Node | Node 22 |
| Tests | 66 passing tests in 7 files |
| UI source size | Approximately 3,434 TypeScript lines under `src/ui/` |
| Data/domain source | Approximately 1,881 TypeScript lines, intended for reuse |
| Known local-only file | `.claude/settings.local.json` is unrelated and must remain untouched |

### Baseline quality command

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### Baseline build sizes

Record these for comparison rather than treating them as hard budgets:

| Asset | Baseline gzip size |
| --- | ---: |
| Shared JavaScript bundle | 153.10 kB |
| Member JavaScript entry | 5.30 kB |
| Admin JavaScript entry | 9.55 kB |
| Shared CSS | 4.71 kB |

Vite currently reports that the uncompressed shared JavaScript chunk is above
500 kB. RM-040 will define an informed post-migration bundle budget after a
React/MUI production-build spike.

## Scope and Non-Goals

### In scope

- React application shells for both member and admin entries.
- MUI components and a centralized RTL theme.
- Redux Toolkit for shared serializable application state.
- A lifecycle-safe bridge from existing Firestore subscriptions into Redux.
- React versions of every current member and admin workflow.
- Node LTS, dependency, CI, lint, test, and build alignment.
- Removal of legacy DOM-rendering code and Tailwind after both cutovers.
- Updated architectural, contributor, setup, and progress documentation.

### Not in scope unless separately approved

- Changing the Firestore schema or distribution business rules.
- Replacing Firebase, introducing a custom server, SSR, or Cloud Functions.
- Introducing real user/admin authentication during this migration.
- Replacing the accepted hidden admin entry strategy.
- Product feature expansion or a broad visual redesign.
- Replacing the bundled Quran dataset or changing Quran text semantics.
- Merging to `main` or deploying production before the final owner-approved
  merge gate.

If React reveals a genuine data/domain defect, document it as a separate task
before changing those layers. Do not hide domain behavior changes inside UI
conversion work.

## Accepted Architecture Decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| AD-01 | Keep Vite and build a client-side React application. | The app is static and does not benefit from a server framework. |
| AD-02 | Preserve separate member and admin HTML entries. | It maintains the current deployment and access shape while allowing independent cutovers. |
| AD-03 | Preserve hash-based routes and existing URLs. | GitHub Pages does not provide SPA history fallbacks. |
| AD-04 | Use current stable React, MUI, Redux Toolkit, and React-Redux versions compatible with Node 24 LTS. | This is the requested stack and avoids legacy Redux patterns. |
| AD-05 | Use Redux for shared serializable data and statuses, not every UI interaction. | It replaces the current global mutable state without turning local form state into global state. |
| AD-06 | Do not use RTK Query for Firestore. | Firestore already supplies realtime subscriptions, caching, and local-write events. |
| AD-07 | Keep all Firebase imports inside `src/data/`. | The enforced data boundary is working and remains UI-agnostic. |
| AD-08 | Use MUI's Emotion engine with RTL cache/plugin configuration. | Arabic layout must work for normal and portalled components. |
| AD-09 | Keep specialized CSS for Quran typography, reading scale, safe areas, and icon masks. | These are application-specific and need not be forced into MUI components. |
| AD-10 | Target the latest Node 24 LTS patch, not Node 26 Current. | A supported LTS line is more appropriate for CI and tooling stability. Reconfirm the exact patch when RM-100 starts. |
| AD-11 | Migrate member first, admin second, then remove Tailwind/legacy UI. | The two-entry design permits a lower-risk staged conversion. |

## Target Architecture

```text
src/
├── app/
│   ├── providers/        Redux, MUI/RTL, error boundary
│   ├── routing/          shared hash-routing support
│   └── store/            store, typed hooks, slices, selectors, sync lifecycle
├── components/           shared React/MUI components
├── features/
│   ├── member/           member routes and components
│   ├── admin/            admin routes and components
│   └── reader/           browse/assigned Quran reader
├── content/              retained
├── data/                 retained Firebase boundary
├── domain/               retained pure business logic
└── theme/                MUI theme + retained specialized CSS/fonts
```

The exact folder names may change during RM-200, but the dependency direction
must remain:

```text
React UI -> Redux/selectors -> data subscription/write adapters -> Firestore
React UI -> domain pure functions
domain -X-> React, Redux, data, or Firebase
```

## State Ownership Model

### Redux state

- Roster entities and listener status.
- Khatmas and listener status.
- Assignments indexed by khatma and subscription status.
- Global content and listener status.
- Shared async operation status only where multiple components consume it.
- Optionally the selected member ID if this simplifies app initialization.

### Local React state

- Form drafts and validation messages.
- Open menus, dialogs, accordions, and tabs local to a route.
- Reader navigation state and transient loading state.
- Confirmation prompts and button-local pending state.

### Browser persistence

- Remembered member identity.
- Reading scale.
- Last-read page.
- Per-khatma du3a acknowledgement.

### Never store in Redux

- Firestore snapshots, references, or SDK objects.
- Unsubscribe functions.
- DOM nodes or MUI component instances.
- Derived values that selectors or domain functions can calculate.
- Every keystroke solely for debugging/time travel.

## Collaboration and Parallel Work Lanes

These are proposed default owners. Either agent may take a task, but must first
update the owner field. The file boundaries are more important than the names.

> **Read against §Operating Mode.** By default only one agent is active at a time,
> so "Can run alongside" and the waves below describe *safe dependency ordering*,
> not simultaneous execution. Treat a lane as *who is the natural owner when this
> task's turn comes up in the sequence*, and hand the task's turn — not the whole
> lane — to that owner. Simultaneous lane work needs OD-05/OD-06 resolved first.

| Lane | Proposed primary | Scope/files | Can run alongside |
| --- | --- | --- | --- |
| A — Runtime/platform | Codex | `package*.json`, Node pin, Vite, TS, ESLint, Vitest, workflows | UI inventory and design-token work |
| B — Theme/shared UI | Claude | MUI theme, RTL setup, shared components, visual parity inventory | Redux/store and listener work |
| C — Member/reader | Codex | `features/member`, `features/reader`, member tests | Admin screens after shared foundations stabilize |
| D — Admin | Claude | `features/admin`, admin component tests | Member/reader conversion |
| E — Integration/QA/docs | Joint, one committer at a time | entries, removal, full verification, docs | Scoped test writing in non-overlapping files |

### Parallel work waves

1. **Wave 1:** Codex handles Node/dependencies while Claude completes the UI
   parity inventory and MUI token mapping.
2. **Wave 2:** Codex builds Redux/Firestore synchronization while Claude builds
   the RTL theme and shared UI primitives.
3. **Wave 3:** Codex migrates member/reader while Claude migrates admin. Start
   only after providers, routing, shared types, and component contracts settle.
4. **Wave 4:** One agent performs entry cutovers and legacy removal while the
   other adds missing integration tests and updates documentation.
5. **Wave 5:** Joint review and emulator/staging validation, with one agent
   designated to make integration fixes at a time.

### Collision avoidance

- Only Lane A edits shared configuration during Phases 1–2.
- Only Lane B edits the central MUI theme while RM-210 is active.
- Route contracts and store state shapes require a recorded decision before
  either feature lane changes them.
- Member and admin code must live in separate feature directories.
- Shared-component API changes after Wave 3 begins require both feature lanes
  to be notified in the session log.

## Work Breakdown and Tracker

### Phase 0 — Baseline, inventory, and governance

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-000 Create migration plan and branch rules | Codex | DONE | — | — | This document exists and names `reactmigration` as the integration branch. |
| RM-010 Confirm baseline health on migration branch | Codex | DONE | RM-000 | P0-A | 2026-07-13: typecheck, lint, 66 tests, and production build passed on `reactmigration`. |
| RM-020 Build route-by-route UI parity inventory | Claude | DONE | RM-000 | P0-A | 2026-07-13: [`REACT_MIGRATION_UI_INVENTORY.md`](REACT_MIGRATION_UI_INVENTORY.md) covers all 11 member+admin hash routes plus the identity gate and completion overlay, every action, loading/empty/error/not-found states, the 4 localStorage persistence keys, and responsive/RTL behavior; adds a parity-risk oracle (§4) and baseline-quirk list (§5). Derived from source at `d3b277d`. |
| RM-030 Record React migration architecture addendum | Unassigned | NOT STARTED | RM-020, RM-260 | — | `ARCHITECTURE.md` describes the implemented React/state boundaries without erasing historical intent. |
| RM-040 Establish bundle/performance budgets | Codex | NOT STARTED | RM-120, RM-200 | — | Baseline and React/MUI spike sizes are recorded; accepted member/admin initial-load budgets are documented. |

**Phase 0 exit:** RM-000, RM-010, and RM-020 are `DONE`; no unrecorded baseline
failure exists.

### Phase 1 — Node, dependencies, and developer tooling

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-100 Pin Node 24 LTS consistently | Codex | DONE | RM-010 | P1-A | 2026-07-13: pinned Node 24.18.0 in `.nvmrc`, package metadata, CI, deploy, and docs; aligned `@types/node` to 24.13.3; clean install and full baseline suite passed on the pinned runtime. |
| RM-110 Audit and group existing dependency updates | Codex | DONE | RM-100 | — | 2026-07-13: [`REACT_MIGRATION_DEPENDENCY_AUDIT.md`](REACT_MIGRATION_DEPENDENCY_AUDIT.md) classifies all 15 direct packages; eight same-major refreshes grouped for RM-120, TypeScript 7 and Node 26 types rejected on compatibility grounds, and Tailwind removal deferred to RM-620. No manifest/lockfile change. |
| RM-115 Map Tailwind tokens/components to MUI | Claude | DONE | RM-020 | P1-A | 2026-07-13: [`REACT_MIGRATION_THEME_MAP.md`](REACT_MIGRATION_THEME_MAP.md) — token table maps all 11 active colors (+1 dead) to `palette`, both fonts (Tajawal not-bundled flagged) + type scale/weights + reading scale to `typography`/retained, radii→`shape`, spacing (4px-unit reconciliation) + breakpoints (md/lg→`breakpoints.values`), every legacy component→MUI (§7), and retained CSS (§8). Derived from `theme.css`/compiled CSS + grep at `38fbe43`. |
| RM-120 Install React/MUI/Redux toolchain | Codex | DONE | RM-110 | — | 2026-07-13: installed React 19.2.7, MUI/Emotion/RTL, Redux Toolkit 2.12.0, React-Redux 9.3.0, React Router 7.18.1, Vite React plugin, types, and component-test dependencies; applied RM-110 safe refreshes; pinned reviewed install scripts; clean `npm ci` and the full baseline suite passed on Node 24.18.0. |
| RM-130 Configure TypeScript, Vite, ESLint, and Vitest for React | Codex | DONE | RM-120 | — | 2026-07-13: enabled `react-jsx`, Vite React/Fast Refresh, Hooks/refresh lint rules, and separate Node/jsdom Vitest projects; clean install and full suite passed with 67 tests. |
| RM-140 Update CI/deploy tooling | Codex | DONE | RM-100, RM-130 | — | 2026-07-13: CI and deploy use `.nvmrc`; both run named TS/TSX typecheck, React-aware lint, legacy + React tests, and the two-entry production build before integration/deployment. Full pinned-runtime suite passed with 67 tests. |
| RM-150 Verify clean toolchain installation | Codex | DONE | RM-140 | — | 2026-07-13: fresh `npm ci`, dependency-tree validation, typecheck, lint, 66 legacy tests, 1 React component test, and the two-entry production build passed on Node 24.18.0; production audit is clean. |

**Phase 1 exit:** one Node LTS version is used everywhere; dependency changes
are documented; the legacy application still builds and passes tests.

### Phase 2 — React, MUI, routing, and Redux foundations

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-200 Create React app structure and branch-only preview entries | Codex | DONE | RM-130 | P2-A | 2026-07-13: member/admin React roots render at dev-only preview URLs; entry-isolation tests and the production build prove only the two legacy HTML entries reach `dist/`. |
| RM-210 Implement centralized MUI RTL theme | Claude | NOT STARTED | RM-115, RM-130 | P2-A | Theme maps accepted tokens; `dir=rtl`, theme direction, Emotion cache, portals, fonts, and `CssBaseline` verified. |
| RM-220 Implement typed hash routing | Codex | NOT STARTED | RM-200 | P2-B | Existing member/admin URLs and fallback behavior are preserved; route tests pass. |
| RM-230 Create Redux store, typed hooks, and base slices | Codex | NOT STARTED | RM-200 | P2-B | Store contains only serializable planned state; selectors and state types have tests. |
| RM-240 Bridge Firestore subscriptions into Redux | Codex | NOT STARTED | RM-230 | — | Roster, content, khatma, and dynamic assignment listeners dispatch updates and errors; all listeners clean up correctly, including under Strict Mode. |
| RM-250 Integrate existing write functions and operation feedback | Codex | NOT STARTED | RM-230 | P2-C | UI-facing actions call existing data functions; pending/success/failure behavior is consistent; no Firebase import escapes `src/data/`. |
| RM-260 Verify foundation behavior | Joint | NOT STARTED | RM-210, RM-220, RM-240, RM-250 | — | Fast Refresh, navigation, initial snapshots, remote updates, local optimistic updates, error handling, and listener cleanup are tested. |

**Phase 2 exit:** a themed React preview can navigate and react to Firestore
updates without duplicate listeners or changes to the data/domain contract.

### Phase 3 — Shared React components and app shells

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-300 Build shared providers, error boundary, and feedback states | Claude | NOT STARTED | RM-210, RM-230 | P3-A | Reusable app providers, loading, empty, error, retry, and snackbar patterns exist. |
| RM-310 Build responsive member/admin shells and navigation | Claude | NOT STARTED | RM-210, RM-220 | P3-A | Bottom navigation on mobile, right rail on large screens, safe areas, active routes, and Arabic labels match requirements. |
| RM-320 Build shared MUI form/display primitives | Claude | NOT STARTED | RM-210 | P3-B | Buttons, cards, fields, select, stepper, badges/chips, progress views, and confirmation pattern cover legacy use cases. |
| RM-330 Port charts and custom icon override support | Claude | NOT STARTED | RM-210 | P3-B | Donut/segment visuals and file-based icon overrides work without legacy DOM builders. |
| RM-340 Port browser-persistence hooks | Codex | NOT STARTED | RM-200 | P3-B | Identity, reading scale, last page, and du3a acknowledgement behaviors are typed and tested. |
| RM-350 Build shared React test harness | Codex | NOT STARTED | RM-230, RM-300 | — | Tests can render with Redux/MUI/router providers and deterministic fake subscription data. |

**Phase 3 exit:** feature work can compose stable shared contracts without
editing legacy DOM helpers or duplicating provider setup.

### Phase 4 — Member application migration

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-400 Migrate identity gate and member switching | Codex | NOT STARTED | RM-240, RM-310, RM-340 | P4-A | Roster loads live; empty/error states work; selection persists; switch cleans listeners and returns to gate. |
| RM-410 Migrate khatma list and khatma landing routes | Codex | NOT STARTED | RM-240, RM-310, RM-320 | P4-A | Only relevant active khatmas appear; progress, assignments, warnings, history, loading, and not-found behavior match baseline. |
| RM-420 Migrate personal and settings routes | Codex | NOT STARTED | RM-310, RM-340 | P4-B | Personal insight, reading scale, navigation, and remembered settings match baseline. |
| RM-430 Migrate completion/du3a flow | Codex | NOT STARTED | RM-240, RM-340 | P4-B | Reciter/non-reciter variants, custom content, local acknowledgement, and navigation suppression match baseline. |
| RM-440 Migrate Quran reader | Codex | NOT STARTED | RM-220, RM-250, RM-320, RM-340 | P4-C | Browse/assigned modes, static page loading, surah/juz/page navigation, reading scale, finish action, released-chunk error, and last page work. Firestore ticks do not reset page or scroll. |
| RM-450 Add member component/integration tests | Codex | NOT STARTED | RM-400, RM-410, RM-420, RM-430, RM-440 | — | Critical route, realtime, identity, completion, and reader-state behaviors are automated. |
| RM-460 Member parity review | Joint | NOT STARTED | RM-450 | — | RM-020 member checklist passes on mobile and desktop RTL; unresolved differences are documented and approved. |

**Phase 4 exit:** the React member preview has functional parity, preserves
reader state during realtime updates, and passes its automated/manual checks.

### Phase 5 — Admin application migration

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-500 Migrate admin shell and Home dashboard | Claude | NOT STARTED | RM-240, RM-250, RM-310, RM-320 | P5-A | Metrics, warnings, distribution/redistribution actions, confirmations, same-day rules, and errors match baseline. |
| RM-510 Migrate Roster route | Claude | NOT STARTED | RM-250, RM-320 | P5-A | Search, add/update/delete, capacity, enabled state, uniqueness validation, and confirmations work. |
| RM-520 Migrate Khatmas list/create/continue route | Claude | NOT STARTED | RM-250, RM-320 | P5-B | Scope configuration, series continuation, members, per-member capacity, validation, and draft preservation work. |
| RM-530 Migrate Khatma detail route | Claude | NOT STARTED | RM-250, RM-320 | P5-B | Progress, assignments, rename, release, removal, warning clearing, completion, delete, and history work. |
| RM-540 Migrate admin Settings route | Claude | NOT STARTED | RM-250, RM-320 | P5-C | Global du3a edit/save/error behavior and reading settings match baseline. |
| RM-550 Prove form-draft stability under realtime updates | Claude | NOT STARTED | RM-500, RM-510, RM-520, RM-530, RM-540 | — | Automated tests show unrelated snapshots do not overwrite touched fields or close active interactions. |
| RM-560 Add admin component/integration tests | Claude | NOT STARTED | RM-550 | — | Critical CRUD, distribution, validation, confirmation, listener, and error flows are automated. |
| RM-570 Admin parity review | Joint | NOT STARTED | RM-560 | — | RM-020 admin checklist passes on mobile and desktop RTL; unresolved differences are documented and approved. |

**Phase 5 exit:** the React admin preview has functional parity and realtime
updates do not disrupt forms or in-progress admin operations.

### Phase 6 — Cutover, cleanup, and end-to-end validation

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-600 Cut over member entry to React | Joint | NOT STARTED | RM-460 | — | `index.html` mounts the production React member app; production build and member smoke checks pass. |
| RM-610 Cut over admin entry to React | Joint | NOT STARTED | RM-570, RM-600 | — | Hidden admin HTML mounts the React admin app; no route or build-input regression. |
| RM-620 Remove legacy UI and Tailwind | Joint | NOT STARTED | RM-610 | — | Legacy DOM renderers/helpers and Tailwind dependencies/config are removed; retained CSS is framework-independent; no dead imports. |
| RM-630 Optimize and document bundles | Codex | NOT STARTED | RM-620, RM-040 | P6-A | Route-level splitting and imports are reviewed; final sizes are recorded against accepted budgets; regressions are explained. |
| RM-640 Run emulator cross-client validation | Joint | NOT STARTED | RM-610 | P6-A | Two member/admin clients demonstrate remote realtime updates, writes, distribution, completion, reload, reconnect, and cleanup behavior. |
| RM-650 Run accessibility, RTL, and responsive QA | Claude | NOT STARTED | RM-620 | P6-A | Keyboard/focus, labels, contrast, Arabic direction, portals, senior-friendly sizing, mobile safe areas, and desktop rail pass. |
| RM-660 Run authorized staging/live-project smoke test | Project owner + one agent | NOT STARTED | RM-640, RM-650 | — | Only after explicit owner authorization: production-like Firebase config validates rules and reads/writes without deploying to production. |
| RM-670 Update all project documentation | Joint | NOT STARTED | RM-620, RM-630 | — | README, architecture, requirements technology note, progress, setup, test, and contributor guidance match the final code. |

**Phase 6 exit:** both production entries use React; legacy UI/Tailwind are gone;
the app is validated end-to-end without changing `main` or production.

### Phase 7 — Merge readiness and controlled handoff to main

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-700 Run final clean quality suite | Codex | NOT STARTED | RM-630, RM-640, RM-650, RM-670 | — | Clean install plus typecheck, lint, all tests, and production build pass on pinned Node and CI. |
| RM-710 Review migration delta against current main | Joint | NOT STARTED | RM-700 | — | Any main changes since `6992007` are reconciled intentionally; no unrelated migration overwrite. |
| RM-720 Complete joint code/behavior review | Codex + Claude | NOT STARTED | RM-710 | — | Both agents review boundaries, subscriptions, UI parity, dead code, docs, and open risks; findings resolved or owner-accepted. |
| RM-730 Prepare merge summary and rollback plan | Codex | NOT STARTED | RM-720 | — | Summary includes changes, verification, bundle impact, data compatibility, known risks, and rollback steps. |
| RM-740 Obtain explicit owner approval and merge to main | Project owner | NOT STARTED | RM-730 | — | Owner explicitly authorizes merge; only then may `reactmigration` be merged to `main`. |

## Merge-Readiness Gates

Every box must be checked before RM-740:

- [ ] Both member and admin parity reviews are complete.
- [ ] Existing domain/data tests remain green and new React tests are green.
- [ ] Clean install, typecheck, lint, tests, and production build pass on Node 24 LTS.
- [ ] Firestore listeners start once, report errors, and clean up correctly.
- [ ] Remote Firebase changes update open clients without manual refresh.
- [ ] Reader page and scroll state survive unrelated realtime updates.
- [ ] Admin form drafts survive unrelated realtime updates.
- [ ] Mobile/desktop RTL, accessibility, and senior-friendly interaction checks pass.
- [ ] Final bundle sizes are measured and accepted.
- [ ] No unintended Firebase schema, rule, or domain behavior change exists.
- [ ] Legacy DOM UI and Tailwind have been removed or an exception is documented.
- [ ] Documentation describes the implemented architecture and exact setup.
- [ ] `main` remains untouched by partial migration work.
- [ ] Rollback plan is documented and credible.
- [ ] The project owner explicitly approves the final merge.

## Verification Matrix

| Change type | Minimum scoped checks | Required before integration |
| --- | --- | --- |
| Node/dependencies/config | Clean install, typecheck, lint, tests, build | Full baseline suite |
| Redux slice/selectors | Unit tests, typecheck, lint | Full test suite |
| Firestore subscription bridge | Listener lifecycle tests, error tests, Strict Mode test | Emulator realtime smoke |
| Shared MUI component/theme | Component tests, RTL/portal check, visual responsive check | Member and admin smoke |
| Member feature | Feature tests and affected domain tests | Member parity checklist |
| Admin feature | Feature tests and affected domain tests | Admin parity checklist |
| Reader | Reader tests, navigation/persistence checks | Mobile manual reader pass |
| Entry/cutover/removal | Typecheck, lint, all tests, build | Full emulator and bundle pass |
| Documentation only | Link/path review and `git diff --check` | No full suite unless code also changed |

## Risk Register

| Risk | Likelihood / impact | Mitigation | Owner/status |
| --- | --- | --- | --- |
| Reader resets or scroll jumps after Redux updates | Medium / High | Narrow selectors, stable component keys, local reader state, regression tests | RM-440 |
| Duplicate Firestore listeners under Strict Mode/HMR | Medium / High | Central subscription lifecycle, idempotent start, cleanup tests | RM-240 |
| Admin drafts overwritten by snapshots | Medium / High | Keep drafts local, distinguish pristine/touched values, targeted tests | RM-550 |
| MUI RTL defects in dialogs/selects/icons | Medium / Medium | RTL Emotion cache, theme direction, portal QA, directional-icon review | RM-210/RM-650 |
| React/MUI bundle growth harms older phones | Medium / Medium | Measure early, route split, direct imports, avoid unused icon package | RM-040/RM-630 |
| Tailwind and MUI conflict during transition | Low / Medium | Preview isolation, CssBaseline review, remove Tailwind only after both cutovers | RM-210/RM-620 |
| Moderate npm advisories in Firebase development tooling | Low / Medium | Production audit is clean; latest `firebase-admin`/`firebase-tools` still carry nine transitive advisories and npm proposes breaking downgrades, so monitor upstream rather than force-fix | RM-120 documented / RM-150 rechecked: 0 production vulnerabilities, 9 moderate development findings |
| Two agents edit shared files concurrently | Medium / High | Lane ownership, task branches, session log, one integration committer | Ongoing |
| Migration accidentally changes domain/data behavior | Low / High | Preserve boundaries, parity tests, separate task for any discovered defect | Ongoing |
| `main` advances while migration is long-lived | Medium / Medium | RM-710 reconciliation, periodic awareness without partial migration merges | RM-710 |
| Hidden admin URL remains non-auth security | Existing accepted risk | Do not misrepresent React as a security improvement; revisit separately if desired | Deferred/non-goal |

## Open Decisions

Record decisions here before dependent implementation proceeds.

| ID | Decision needed | Needed by | Owner | Status/resolution |
| --- | --- | --- | --- | --- |
| OD-01 | Exact temporary preview-entry mechanism | RM-200 | Codex | RESOLVED 2026-07-13 — use `/react-preview.html` and `/admin-react-preview.html` only on the migration branch's Vite development server; keep both files out of the explicit production inputs so normal build, preview, and deploy paths publish only the legacy entries until cutover. |
| OD-02 | Final accepted member/admin bundle budgets | RM-040/RM-630 | Project owner + Codex | OPEN |
| OD-03 | Exact MUI visual-parity tolerance versus intentional Material refresh | RM-115/RM-460 | Project owner + Claude | OPEN |
| OD-04 | Final merge method (merge commit, squash, or reviewed PR policy) | RM-740 | Project owner | OPEN |
| OD-05 | Execution mode: sequential single-writer (default) vs opt-in parallel worktrees | Before Phase 1 code | Project owner | RESOLVED 2026-07-13 — sequential single-writer is the default (owner-directed); see §Operating Mode. |
| OD-06 | Git topology under sequential mode: single shared working tree (commit to `reactmigration`, no per-task branches) vs separate clone/worktree per agent (task branches + push/pull) | RM-100 | Project owner | RESOLVED 2026-07-13 — single shared working tree; commit once per task directly on `reactmigration`, no `reactmig-*` branches while work stays sequential. Task branches return only if OD-05 later flips to parallel. |

## Claude Review Notes — 2026-07-13

Minor findings from the plan review. None block Phase 0; each is a small
correction or clarification for the owning agent to fold in.

1. **Baseline re-verified.** `npm test` → 7 files / 66 tests green on Node 24.14.0.
   All Baseline Snapshot figures (line counts, entries, Vite 8, CI Node 22) match
   the repo. RM-010's `DONE` is accurate.
2. **RM-030 has no owner.** It is listed `Unassigned`. Give it an owner (it is
   documentation that pairs naturally with whoever lands RM-260, or mark it
   `Joint`) so it is not silently skipped.
3. **RM-040 placement.** It sits in the Phase 0 table but depends on RM-120/RM-200
   (Phases 1–2), so it cannot start until the toolchain and preview exist. The
   Phase 0 exit correctly excludes it — noting here so no one treats it as a
   Phase 0 blocker. Consider relocating it to Phase 2 for readability.
4. **Resolved by RM-100 — `@types/node` was on the 26 line.** At review time,
   `package.json` pinned `@types/node ^26.1.0`
   while AD-10 targets Node 24 LTS and `engines.node` is currently the loose
   `>=20`. RM-100 should *downgrade* `@types/node` to the Node 24 major (not just
   "align") and tighten `engines`, so types match the pinned runtime.
5. **Local verification capability (Claude).** The Firestore emulator runs locally
   (Java present) and the app is drivable end-to-end via the browser-preview
   tools. So the data-driven and parity/emulator acceptance checks — RM-260,
   RM-440, RM-550, RM-640, RM-650 — are locally verifiable rather than
   assertion-only. Useful when assigning verification ownership.

## Session Log

### 2026-07-13 — Codex — RM-200 → DONE

- Branch/commit: `reactmigration`, implemented from
  `1a66c823f54427e90f787643d9e2db167e9da0ab`; task commit pending at log-update
  time.
- Outcome: created isolated member/admin React roots and development preview
  pages without changing either production HTML entry or legacy bootstrap.
  RM-200 acceptance criteria pass.
- Files/areas changed: added `src/app/` roots/bootstrap/entries,
  `react-preview.html`, `admin-react-preview.html`, root and entry-isolation
  tests; extended centralized Arabic preview copy, Vite entry metadata, README
  preview guidance, OD-01, and this tracker.
- Verification on the available Node `24.14.0` runtime: typecheck and lint passed;
  all 10 test files / 71 tests passed; both preview HTML pages and both TSX entry
  modules returned HTTP 200 from Vite; the production build passed and emitted
  only `index.html` and `admin-nano.html` (neither React preview was present in
  `dist/`). Prettier passed for the implementation files, and
  `git diff --check` passed.
- Decisions and risks: OD-01 is resolved with dev-server-only preview HTML files
  excluded from the explicit production input map and protected by regression
  tests. The local shell is behind the repository's pinned Node `24.18.0`; CI and
  deploy remain pinned to `24.18.0`, and this task changes no dependencies or
  runtime APIs.
- Recommended next action: hand off to Claude for RM-210; its RM-115/RM-130
  dependencies are `DONE`, and the new roots are ready for the centralized MUI
  RTL provider. RM-220 and RM-230 can follow after that handoff.

### 2026-07-13 — Codex — RM-200 → IN PROGRESS

- Branch/commit: `reactmigration` at
  `1a66c823f54427e90f787643d9e2db167e9da0ab`; clean working tree confirmed
  before the tracker claim.
- Outcome: claimed RM-200 after confirming its RM-130 dependency is `DONE`;
  implementation has not begun at log-update time.
- Files/areas changed: this tracker only.
- Verification: React/jsdom component baseline passed (1 file / 1 test) on the
  available Node `24.14.0` runtime. The repository pins Node `24.18.0`, which
  remains required for final acceptance verification.
- Decisions and risks: OD-01 (the exact branch-only preview-entry mechanism) is
  still open and must be resolved as part of RM-200 without replacing the
  production `index.html` and `admin-nano.html` entries.
- Recommended next action: inspect the existing Vite entry/build/deploy wiring,
  resolve OD-01, then add isolated member/admin React roots and tests.

### 2026-07-13 — Codex — RM-150 → DONE

- Branch/commit: `reactmigration`, implemented from
  `bfd3d4efd5a124431dd4c1593c381c21bddbfe7f`; task commit pending at log-update
  time.
- Outcome: the Phase 1 toolchain is reproducible from a clean install on the
  pinned runtime, and all RM-150 acceptance gates pass. Phase 1 is complete.
- Files/areas changed: this tracker only; application source, configuration,
  manifests, and the lockfile are unchanged.
- Verification on Node `24.18.0` / npm `11.16.0`: fresh `npm ci` installed 1,040
  packages; `npm ls --depth=0`, typecheck, lint, 7 legacy test files / 66 tests,
  1 React component test file / 1 test, the combined 8 files / 67 tests, and the
  two-entry production build passed. Production audit reports 0 vulnerabilities.
- Decisions and risks: full audit reproduces the nine known moderate transitive
  findings in the current `firebase-admin`/`firebase-tools` development tree;
  npm still proposes the breaking `firebase-tools@14.23.0` downgrade, so no
  forced fix was applied. `npm outdated` lists only the intentional Node-types-26
  and TypeScript-7 holds from RM-110. The existing 509.63 kB shared-chunk warning
  remains assigned to RM-040/RM-630.
- Recommended next action: take RM-200; RM-130 is `DONE`, so the member/admin
  branch-only React preview entries can be created without replacing production
  entries.

### 2026-07-13 — Codex — RM-150 → IN PROGRESS

- Branch/commit: `reactmigration` at
  `bfd3d4efd5a124431dd4c1593c381c21bddbfe7f`, with a clean working tree at
  preflight; RM-140 is `DONE`, so the dependency is satisfied.
- Outcome: claimed RM-150 under Codex; clean toolchain installation verification
  is in progress.
- Files/areas changed: this tracker only.
- Verification: preflight confirmed the requested branch and exact HEAD;
  `npm ls --depth=0` passed. The default shell reports Node `24.14.0` / npm
  `11.9.0`, so RM-150 acceptance checks will run on the pinned Node `24.18.0`.
- Decisions and risks: use the pinned runtime for all acceptance evidence and
  recheck the nine known moderate transitive advisories in the Firebase
  development-tooling tree.
- Recommended next action: run a fresh install and the Phase 1 exit suite on
  pinned Node `24.18.0`, then record the results and close RM-150 if all gates
  pass.

### 2026-07-13 — Codex — RM-140 → DONE

- Branch/commit: `reactmigration`, implemented from
  `58f8c79f048b7cc881fb60716d2463a7a15485ae`; task commit pending at log-update
  time.
- Outcome: CI and the deployment build job both use Node `24.18.0` through
  `.nvmrc` and run explicit TS/TSX typecheck, React-aware lint, legacy + React
  tests, and production-build gates. The Firestore-rules deployment job remains
  pinned through the same `.nvmrc`.
- Files/areas changed: `.github/workflows/ci.yml`,
  `.github/workflows/deploy.yml`, and this tracker.
- Verification on checksum-verified Node `24.18.0` / npm `11.16.0`: fresh
  `npm ci` installed 1,040 packages; `npm ls --depth=0`, typecheck, lint, 8 test
  files / 67 tests, and the two-entry production build passed. Static workflow
  assertions, workflow Prettier check, and `git diff --check` passed.
- Decisions and risks: the workflows keep explicit commands so their gates stay
  visible in GitHub Actions; those commands consume RM-130's TSX, Hooks/refresh,
  and separate Node/jsdom Vitest configuration. The existing >500 kB shared
  chunk warning remains assigned to RM-040/RM-630.
- Recommended next action: take RM-150; RM-140 is now `DONE`, so its clean
  toolchain verification can proceed.

### 2026-07-13 — Codex — RM-140 → IN PROGRESS

- Branch/commit: `reactmigration` at
  `58f8c79f048b7cc881fb60716d2463a7a15485ae`, with a clean working tree at
  preflight; RM-100 and RM-130 are `DONE`, so both dependencies are satisfied.
- Outcome: claimed RM-140 under Codex; CI and deployment workflow alignment with
  the React-aware toolchain is beginning.
- Files/areas changed: this tracker only before broad workflow changes.
- Verification on checksum-verified Node `24.18.0` / npm `11.16.0`: fresh
  `npm ci` installed 1,040 packages and the pre-change `npm run typecheck`
  baseline passed.
- Decisions and risks: both workflows already read the pinned version from
  `.nvmrc`; the exact React-aware checks and duplication boundary still need to
  be verified before editing the workflows.
- Recommended next action: audit and update `.github/workflows/ci.yml` and
  `.github/workflows/deploy.yml`, then validate their commands locally.

### 2026-07-13 — Codex — RM-130 → DONE

- Branch/commit: `reactmigration`, implemented from
  `3c162dc8a4630999ba4e1ae0317ce14c82bbd493`; task commit pending at log-update
  time.
- Outcome: TypeScript now compiles TSX with the automatic React runtime; Vite's
  React plugin transforms JSX and supplies Fast Refresh while Tailwind remains
  enabled for legacy coexistence; ESLint applies the recommended React Hooks and
  Vite refresh rules to TS/TSX and extends both architecture guardrails to TSX;
  Vitest keeps legacy tests in Node and runs component tests in jsdom with
  jest-dom and automatic Testing Library cleanup.
- Files/areas changed: `tsconfig.json`, `vite.config.ts`, `eslint.config.js`,
  `vitest.config.ts`, `package.json`, `package-lock.json`,
  `tests/setup/react.ts`, `tests/tooling/react-tooling.test.tsx`, and this
  tracker.
- Verification on checksum-verified Node `24.18.0` / npm `11.16.0`: fresh
  `npm ci` installed 1,040 packages; `npm ls --depth=0`, typecheck, lint, 8 test
  files / 67 tests, and the two-entry production build passed. A Vite
  development transform contained both the React refresh registration wrapper
  and `/@react-refresh` HTML preamble; ESLint's resolved TSX configuration
  contained the Hooks and refresh rules. Prettier check and `git diff --check`
  passed.
- Decisions and risks: the production member/admin entries and bundle sizes are
  unchanged; the existing >500 kB shared-chunk warning remains assigned to
  RM-040/RM-630. `npm ci` still reports the nine known moderate findings in the
  existing Firebase development tree, already assigned to RM-150.
- Recommended next action: take RM-140; its RM-100 and RM-130 dependencies are
  now `DONE`, so CI and deploy can be aligned with the React-aware checks.

### 2026-07-13 — Codex — RM-130 → IN PROGRESS

- Branch/commit: `reactmigration` at
  `3c162dc8a4630999ba4e1ae0317ce14c82bbd493`, with a clean working tree;
  RM-120 is `DONE`, so the dependency is satisfied.
- Outcome: claimed RM-130 under Codex; React-aware TypeScript, Vite, ESLint, and
  Vitest configuration work is beginning.
- Files/areas changed: this tracker only before broad configuration changes.
- Verification: checksum-verified Node `24.18.0` and npm `11.16.0` selected from
  `C:\tmp\node-v24.18.0-win-x64`; the pre-change `npm run typecheck` baseline
  passed.
- Decisions and risks: preserve both legacy production entries and their current
  behavior; configuration proof should exercise TSX, Fast Refresh wiring,
  hooks/JSX linting, and a jsdom component test without beginning RM-200 app
  structure work.
- Recommended next action: inspect the current tool configurations, add the
  smallest React-specific configuration and proof fixture, then run the full
  Node/dependencies/config verification suite.

### 2026-07-13 — Codex — RM-120 → DONE

- Branch/commit: `reactmigration`, starting from `4b71a55` with a clean working
  tree; RM-110 is `DONE`, so the dependency is satisfied.
- Outcome: added React/React DOM 19.2.7; MUI and icons 9.2.0; Emotion cache,
  React, and styled packages; Stylis plus its RTL plugin; Redux Toolkit 2.12.0;
  React-Redux 9.3.0; React Router DOM 7.18.1; Vite's React plugin 6.0.3; React
  declarations; Testing Library DOM/React/jest-dom/user-event; and jsdom 29.1.1.
  Applied all eight RM-110 same-major refreshes. Tailwind remains installed for
  coexistence, and React configuration remains scoped to RM-130.
- Reproducibility/security: downloaded the official Node 24.18.0 Windows archive
  to a temporary location and verified its SHA-256 against Node's published
  `SHASUMS256.txt`; npm 11.16.0 generated the lock. Reviewed and exact-version
  pinned the four required transitive install hooks (`@firebase/util@1.15.1`,
  `esbuild@0.28.1`, `protobufjs@7.6.5`, `re2@1.24.1`); npm reports no unreviewed
  scripts. A fresh pinned-runtime `npm ci` installed 1,017 packages successfully.
- Verification on Node `24.18.0`: `npm ls --depth=0` clean; `npm run typecheck`
  passed; `npm run lint` passed; `npm test` passed (7 files / 66 tests);
  `npm run build` passed with the existing >500 kB chunk warning; production
  `npm audit --omit=dev` reported 0 vulnerabilities; `npm outdated` reports only
  the intentional Node-types-26 and TypeScript-7 holds documented by RM-110.
- Advisory note: full `npm audit` reports nine moderate transitive findings,
  confined to the existing `firebase-admin`/`firebase-tools` development tree.
  Both direct packages are current and npm proposes breaking downgrades, so no
  forced fix was applied; the Risk Register assigns a recheck to RM-150.
- Files/areas changed: `package.json`, `package-lock.json`, and this tracker only;
  no application source or React configuration changed.
- Recommended next action: take RM-130 to enable TSX/Fast Refresh, React linting,
  and jsdom component tests using the now-reproducible toolchain.

### 2026-07-13 — Codex — RM-110 → DONE

- Branch/commit: `reactmigration`, starting from `d12d291` with a clean working
  tree. The handoff prompt contained the literal `<hash>` placeholder; `d12d291`
  was accepted as the intended handoff because it is the current clean HEAD and
  contains the latest RM-115 theme-map/tracker commit.
- Outcome: added [`REACT_MIGRATION_DEPENDENCY_AUDIT.md`](REACT_MIGRATION_DEPENDENCY_AUDIT.md),
  classifying all 15 existing direct dependencies. Eight same-major refreshes
  are grouped for RM-120; five registry-current/compatibility-pinned packages are
  retained; TypeScript 7 and Node 26 types are explicitly rejected; Tailwind and
  its Vite plugin remain through coexistence and are removed at RM-620. RM-110
  made no `package.json` or `package-lock.json` change.
- Verification: direct-package coverage check reported 15 declared / 15 audited
  with no missing or extra rows; registry evidence came from
  `npm outdated --json --long` and targeted `npm view` engine/peer metadata;
  local imports, configs, scripts, and workflows were inspected for actual use;
  `npm run typecheck` passed; documentation link/path review and
  `git diff --check` passed.
- Environment/risk note: `npm ls --depth=0` exited successfully but reported
  several extraneous transitive WASM packages in the local install. This shell
  is Node `24.14.0` / npm `11.9.0`, not the pinned Node `24.18.0`; RM-120 must
  create and verify its lockfile with a clean install on the pinned runtime.
- Recommended next action: take RM-120 and apply the audit's Group A refreshes
  while installing the React/MUI/Redux packages, then run the full dependency
  verification suite before RM-130.

### 2026-07-13 — Claude — RM-115 → DONE

- Branch/commit: `reactmigration`, started from `38fbe43` (RM-020 committed; clean
  tree confirmed). Docs-only task; no `src/` code changed.
- Outcome: Built the Tailwind→MUI token & component map
  [`REACT_MIGRATION_THEME_MAP.md`](REACT_MIGRATION_THEME_MAP.md). Maps the Tailwind
  v4 CSS-first `@theme` (source of truth — no JS config) into a MUI `createTheme`
  spec: §2 colors→`palette` (11 active + 1 dead, alpha tints, contrastText), §3
  typography (font families + **Tajawal-not-bundled** flag, type scale, weights,
  reading scale as retained), §4 radii→`shape`, §5 spacing (4px-unit vs MUI 8px
  reconciliation + layout landmarks), §6 breakpoints (only md/lg used →
  `breakpoints.values` override), §7 every legacy component→MUI (buttons,
  surfaces, forms, nav/chrome), §8 retained CSS (AD-09), §9 8 decisions/risks
  feeding OD-03/RM-210, §10 acceptance mapping. RM-115 set `DONE`.
- Files/areas changed: added `REACT_MIGRATION_THEME_MAP.md`; updated this tracker
  (RM-115 status+evidence, Migration Status next-milestone, this entry). No
  `src/`, config, or dependency changes.
- Verification: docs-only per the Verification Matrix → `git diff --check` clean;
  all file/path references verified against the tree. Token facts grep-verified:
  `--color-primary-strong` unused (0 refs); `--font-ui` Tajawal not bundled
  (no `@font-face`/link); `--color-warn` == `--color-accent` (`#b45309`);
  theme-color utility usage counts taken from `src/ui`. Baseline suite untouched.
- Decisions and risks: R1–R8 in §9 — chiefly (R4) bundle-or-drop Tajawal without
  adding a Google Fonts runtime dependency; (R3) warn/accent share a hex; (R6)
  set MUI `spacing:4` + Tailwind-px breakpoints for numeric parity; (R1) two
  palettes coexist until Tailwind removal at RM-620. All are RM-210/OD-03 inputs,
  not decisions taken here.
- Recommended next action: Phase-1 platform work is Codex's (RM-110 dependency
  audit → RM-120 install React/MUI/Redux → RM-130 tooling). Claude's next build
  task, **RM-210** (central MUI RTL theme), depends on RM-130 **and** this map, so
  it can't start until the toolchain lands. Suggest **handing off to Codex** now
  (emit a Handoff Instruction Block) so Phase 1 can proceed; Claude resumes at
  RM-210 in Wave 2.

### 2026-07-13 — Claude — RM-020 → DONE

- Branch/commit: `reactmigration`, started from `d3b277d` (clean tree confirmed,
  matched Codex's RM-100 handoff block). Docs-only task; no `src/` code changed.
- Outcome: Built the route-by-route UI parity inventory
  [`REACT_MIGRATION_UI_INVENTORY.md`](REACT_MIGRATION_UI_INVENTORY.md) — the
  migration's parity oracle. Covers all 11 hash routes plus the identity gate and
  completion overlay (member: gate, khatmas list, khatma landing, assigned reader,
  browse reader, personal, settings, completion overlay; admin: home, roster,
  khatmas+create, khatma detail, settings) with
  actions, loading/empty/error/not-found states, the 4 localStorage keys
  (`memberId`, `readingScale`, `lastReadPage`, `du3aAck.{id}`), and responsive/
  RTL behavior. Adds §4 parity-risk oracle (P1–P11, cross-referenced to
  RM-240/440/550/etc.), §5 baseline quirks to preserve, and §7 acceptance
  mapping. RM-020 set `DONE`; Phase 0 exit now satisfied (RM-000/010/020 DONE).
- Files/areas changed: added `REACT_MIGRATION_UI_INVENTORY.md`; updated this
  tracker (RM-020 status+evidence, Migration Status phase/next-milestone, this
  entry). No `src/`, config, or dependency changes.
- Verification: docs-only per the Verification Matrix → `git diff --check` clean;
  all inventory file/path references verified against the tree; unused-string
  claims (§5.4) confirmed by grep (0 UI references). Baseline suite untouched
  (no code changed).
- Decisions and risks: Inventory is source-derived at `d3b277d`, complete but not
  yet witnessed live — RM-460/RM-570 are where each `☐` is checked against the
  running React app (emulator-backed). Flagged as a decision for RM-240/RM-300:
  keep the current silent shell-error behavior (§1.7) or add a global error
  surface — if changed, record it as an intentional delta, not parity.
- Recommended next action: Claude continues with **RM-115** (Tailwind→MUI token
  map), now unblocked; it consumes inventory §1–§3. Codex's RM-110 (dependency
  audit) can proceed in parallel-by-dependency. If handing to Codex instead, emit
  a Handoff Instruction Block first (this work should be committed to
  `reactmigration` as one RM-020 task boundary before any cross-agent handoff).

### 2026-07-13 — Codex — RM-100

- Branch/commit: `reactmigration`; committed as one RM-100 task boundary.
  Local-only `.claude/settings.local.json` remained untouched and is now
  explicitly ignored so sequential handoffs remain clean.
- Outcome: Pinned local development, package metadata, CI, and both deployment
  jobs to Node 24.18.0 LTS. Aligned `@types/node` to 24.13.3 and documented the
  exact local setup.
- Files/areas changed: `.nvmrc`, `package.json`, `package-lock.json`, CI and
  deploy workflows, `README.md`, `.gitignore`, and this tracker.
- Verification: Official Node sources identify 24.18.0 as the latest 24.x LTS.
  On Node 24.18.0: clean `npm ci` passed; typecheck passed; lint passed; 7 test
  files / 66 tests passed; production build passed. `git diff --check` passed.
- Decisions and risks: The existing Vite 509.63 kB chunk warning and npm's nine
  moderate audit findings remain for RM-040/RM-110; this task introduced no
  runtime dependency upgrade. The machine-wide Node installation was not
  changed; verification used an exact temporary 24.18.0 runner.
- Recommended next action: Claude takes RM-020, then RM-115. RM-020 is the last
  Phase 0 exit task and is already unblocked by RM-000.

### 2026-07-13 — Codex — RM-000, RM-010

- Branch/commit: `reactmigration` at base commit `6992007`; plan changes are
  currently uncommitted.
- Outcome: Created the detailed migration tracker, branch policy, collaboration
  lanes, task dependencies, acceptance criteria, risks, and merge gates.
- Files/areas changed: `REACT_MIGRATION_PLAN.md`; repository instruction pointer
  in `CLAUDE.md`.
- Verification: Branch confirmed. `git diff --check`, typecheck, lint, all 66
  tests in 7 files, and the Vite production build passed. The existing Vite
  warning for the 509.63 kB uncompressed shared chunk remains recorded for
  RM-040/RM-630.
- Decisions and risks: `main` must remain unchanged; `.claude/settings.local.json`
  is unrelated local state and was not modified.
- Recommended next action: Begin RM-020 and RM-100/RM-115 as the first parallel
  work wave.

### 2026-07-13 — Claude — plan review (no migration task claimed)

- Branch/commit: `reactmigration`; this review edits the plan only. No `RM-*`
  task started or changed in status; no `src/` code touched.
- Outcome: Reviewed the plan end-to-end and verified its baseline claims against
  the repo (66/7 tests green, line counts, entries, Vite/Node/CI). Added
  §Operating Mode — Sequential Single-Writer Handover as the default execution
  protocol (invariants, Handoff Instruction Block, receiving-agent preflight),
  amended End-of-session step 4 for committed handoffs, subordinated the parallel
  lanes/waves to that mode, added OD-05 (resolved: sequential default) and OD-06
  (open: git topology), and recorded five minor findings in §Claude Review Notes.
- Files/areas changed: `REACT_MIGRATION_PLAN.md` only.
- Verification: `npm test` → 7 files / 66 tests passed. Documentation change
  otherwise; no build/typecheck impact.
- Decisions and risks: OD-06 resolved by the owner in this session — single shared
  working tree, commit-per-task on `reactmigration`, no `reactmig-*` branches while
  sequential. OD-05 already resolved (sequential default). No open inputs remain
  before Phase 1 can start.
- Recommended next action: Codex takes RM-100 (Node 24 pin) as the first sequential
  task; Claude's RM-020/RM-115 (analysis/doc, no code overlap) can precede or
  follow it. Whoever finishes first emits a Handoff Instruction Block.

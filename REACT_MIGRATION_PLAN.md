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
| Overall status | Planning complete; implementation not started |
| Current phase | Phase 0 — Baseline and governance |
| Next milestone | Phase 1 — Runtime and dependency alignment |
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
| RM-020 Build route-by-route UI parity inventory | Claude | NOT STARTED | RM-000 | P0-A | Checklist covers every member/admin route, action, loading/empty/error state, persistence behavior, and responsive state. |
| RM-030 Record React migration architecture addendum | Unassigned | NOT STARTED | RM-020, RM-260 | — | `ARCHITECTURE.md` describes the implemented React/state boundaries without erasing historical intent. |
| RM-040 Establish bundle/performance budgets | Codex | NOT STARTED | RM-120, RM-200 | — | Baseline and React/MUI spike sizes are recorded; accepted member/admin initial-load budgets are documented. |

**Phase 0 exit:** RM-000, RM-010, and RM-020 are `DONE`; no unrecorded baseline
failure exists.

### Phase 1 — Node, dependencies, and developer tooling

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-100 Pin Node 24 LTS consistently | Codex | NOT STARTED | RM-010 | P1-A | Add version pin; align `engines`, local docs, `@types/node`, CI, and deploy workflow; exact latest Node 24 patch reverified. |
| RM-110 Audit and group existing dependency updates | Codex | NOT STARTED | RM-100 | — | Direct dependencies classified as keep/update/replace/remove; breaking changes noted; no blind all-major upgrade. |
| RM-115 Map Tailwind tokens/components to MUI | Claude | NOT STARTED | RM-020 | P1-A | Token table covers colors, typography, radii, spacing, breakpoints, component variants, and retained CSS. |
| RM-120 Install React/MUI/Redux toolchain | Codex | NOT STARTED | RM-110 | — | Add React, React DOM, MUI/Emotion/RTL, Redux Toolkit, React-Redux, routing, Vite React plugin, types, and test dependencies. Lockfile is reproducible. |
| RM-130 Configure TypeScript, Vite, ESLint, and Vitest for React | Codex | NOT STARTED | RM-120 | — | TSX builds, Fast Refresh works, lint recognizes hooks/JSX, and component test environment runs. |
| RM-140 Update CI/deploy tooling | Codex | NOT STARTED | RM-100, RM-130 | — | Both workflows use the pinned Node version and execute React-aware checks. |
| RM-150 Verify clean toolchain installation | Codex | NOT STARTED | RM-140 | — | Clean install, typecheck, lint, legacy tests, and production build pass on pinned Node. |

**Phase 1 exit:** one Node LTS version is used everywhere; dependency changes
are documented; the legacy application still builds and passes tests.

### Phase 2 — React, MUI, routing, and Redux foundations

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-200 Create React app structure and branch-only preview entries | Codex | NOT STARTED | RM-130 | P2-A | Member/admin React roots render without replacing production entries; preview mechanism cannot accidentally replace production deployment. |
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
| Two agents edit shared files concurrently | Medium / High | Lane ownership, task branches, session log, one integration committer | Ongoing |
| Migration accidentally changes domain/data behavior | Low / High | Preserve boundaries, parity tests, separate task for any discovered defect | Ongoing |
| `main` advances while migration is long-lived | Medium / Medium | RM-710 reconciliation, periodic awareness without partial migration merges | RM-710 |
| Hidden admin URL remains non-auth security | Existing accepted risk | Do not misrepresent React as a security improvement; revisit separately if desired | Deferred/non-goal |

## Open Decisions

Record decisions here before dependent implementation proceeds.

| ID | Decision needed | Needed by | Owner | Status/resolution |
| --- | --- | --- | --- | --- |
| OD-01 | Exact temporary preview-entry mechanism | RM-200 | Codex | OPEN |
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
4. **`@types/node` is on the 26 line.** `package.json` pins `@types/node ^26.1.0`
   while AD-10 targets Node 24 LTS and `engines.node` is currently the loose
   `>=20`. RM-100 should *downgrade* `@types/node` to the Node 24 major (not just
   "align") and tighten `engines`, so types match the pinned runtime.
5. **Local verification capability (Claude).** The Firestore emulator runs locally
   (Java present) and the app is drivable end-to-end via the browser-preview
   tools. So the data-driven and parity/emulator acceptance checks — RM-260,
   RM-440, RM-550, RM-640, RM-650 — are locally verifiable rather than
   assertion-only. Useful when assigning verification ownership.

## Session Log

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

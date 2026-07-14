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
| Current phase | Phase 0–2 complete; Phase 3 in progress (RM-300–RM-330 DONE; RM-340/RM-350 next) |
| Next milestone | Phase 3 — shared React providers, shells, and primitives (RM-300…RM-350) |
| Last updated | 2026-07-14 |
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

The baseline build already reported that the uncompressed shared JavaScript
chunk was above 500 kB. These figures remain the pre-migration comparison point;
they are not the accepted React budgets below.

### RM-040 React/MUI build spike and accepted budgets

Measured from source commit `67491ca` with Node 24.14.0 and Vite 8.1.4. The
explicit `npm run build:react-spike` command typechecks and builds only
`react-preview.html` and `admin-react-preview.html` into the ignored
`dist-react-spike/` directory with a manifest. It does not change the normal
production inputs or make the previews deployable.

The canonical figures come from `npm run check:bundle-budgets`, which traverses
each entry's static manifest graph and recompresses emitted HTML, JavaScript, and
CSS with Node zlib. It counts referenced emitted assets such as WOFF2 at their
already-compressed size. Vite's reporter uses a different gzip implementation
and displayed 302.34 kB member / 302.33 kB admin JavaScript for the same output;
the deterministic checker below is the budget authority.

| React/MUI spike | Entry JS gzip | Shared JS gzip | Initial JS gzip | Referenced assets | Conservative initial transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Member | 0.25 kB | 299.12 kB | 299.38 kB | 45.68 kB | 345.49 kB |
| Admin | 0.25 kB | 299.12 kB | 299.37 kB | 45.68 kB | 345.49 kB |

The conservative initial-transfer figure is the emitted HTML gzip size plus the
entire statically imported JS/CSS graph at gzip size plus referenced emitted
assets at raw size. It deliberately counts the Quran WOFF2 even though the
browser may defer the font until Quran text is visible. Dynamic route chunks and
the on-demand `public/quran/` JSON files are not initial load and are excluded.

| Surface | Initial JS gzip budget | Initial transfer budget | Spike headroom |
| --- | ---: | ---: | ---: |
| Member | **350 kB** | **400 kB** | 50.62 kB JS / 54.51 kB transfer |
| Admin | **375 kB** | **425 kB** | 75.63 kB JS / 79.51 kB transfer |

These are hard final-cutover ceilings, not targets to consume. Member is tighter
because it is the senior-facing, high-frequency surface; admin receives 25 kB
more headroom for its denser management screens. New routes should be lazy where
that keeps route-only code out of the static graph. RM-630 must run the checker,
record final sizes against both ceilings, review route splitting and direct MUI
imports, and explain any requested budget change instead of silently raising it.

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
| AD-12 | Enforce separate member/admin initial-load ceilings with an explicit non-deployable React spike build. | Static manifest traversal gives repeatable transfer evidence while preserving legacy-only production outputs until cutover. |

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
| RM-030 Record React migration architecture addendum | Claude | DONE | RM-020, RM-260 | — | 2026-07-13: [`ARCHITECTURE.md`](ARCHITECTURE.md) gained a "React Migration Architecture (branch-only)" section documenting the implemented `src/app/` layer, preserved dependency boundary (Firebase still only in `src/data/`), provider composition, the four-slice Redux store + state-ownership model, the reference-counted Firestore→Redux subscription bridge, the 16-mutation write adapter with local operation feedback, shared hash-routing contract, and MUI RTL theme — verified against shipped code. The legacy framework-free description is retained intact and explicitly marked as what production still ships. Doc-only checks passed: `git diff --check` clean, Prettier clean, internal anchors and referenced paths resolve. |
| RM-040 Establish bundle/performance budgets | Codex | DONE | RM-120, RM-200 | — | 2026-07-13: reproducible non-deployable React spike records member/admin at 299.38/299.37 kB initial JS gzip and 345.49 kB conservative transfer; accepted gates are member 350/400 kB and admin 375/425 kB, enforced by `npm run check:bundle-budgets`. Production inputs remain legacy-only; lint, 104 tests, production build, and the budget gate pass. |

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
| RM-210 Implement centralized MUI RTL theme | Claude | DONE | RM-115, RM-130 | P2-A | 2026-07-13: `createAppTheme` maps the theme-map §2–§6 tokens (palette + white `contrastText`, type scale, `shape` 12px, `spacing:4`, Tailwind-px breakpoints, `direction:'rtl'`); `AppThemeProvider` composes the `stylis-plugin-rtl` Emotion cache → `ThemeProvider` → `CssBaseline` → retained `GlobalStyles`, and forces `dir=rtl`/`lang=ar`. Verified in the branch preview: `dir=rtl`, primary `#0f766e`/12px/`mui-rtl` class, body `#faf7f0`, Amiri `.quran-text`, and a portalled RTL Select (into `body`). 13 new tests (token-parity vs `theme.css`, portal RTL) + full baseline suite green (typecheck, lint, 84 tests, two-entry build). |
| RM-220 Implement typed hash routing | Codex | DONE | RM-200 | P2-B | 2026-07-13: one discriminated-union route contract now serves both legacy and React member/admin apps; React previews use `HashRouter`, typed hooks, typed navigation, and typed links. All established hashes and non-rewriting fallbacks remain covered (19 focused route tests; 88 full-suite tests). |
| RM-230 Create Redux store, typed hooks, and base slices | Codex | DONE | RM-200 | P2-B | 2026-07-13: normalized roster, khatma, and per-khatma assignment slices plus nullable global content use serializable listener state/actions; typed store hooks and selectors are covered by 4 focused state/type/selector/serialization tests. Full suite passes with 92 tests. |
| RM-240 Bridge Firestore subscriptions into Redux | Codex | DONE | RM-230 | — | 2026-07-13: reference-counted global and per-khatma assignment bridges dispatch snapshots/plain errors into Redux; provider/hook lifecycle tests prove no overlapping listeners and complete Strict Mode cleanup. Full suite passes with 96 tests. |
| RM-250 Integrate existing write functions and operation feedback | Codex | DONE | RM-230 | P2-C | 2026-07-13: one typed adapter exposes all 16 existing mutations; `useWriteOperation` provides local pending/success/failure state, typed results/errors, retry/reset, latest-call-safe feedback, and injectable test overrides. Five focused tests plus the 101-test full suite pass; lint confirms no Firebase import escapes `src/data/`. |
| RM-260 Verify foundation behavior | Codex | DONE | RM-210, RM-220, RM-240, RM-250 | — | 2026-07-13: a composed provider/router/store/write test covers navigation, initial and remote snapshots, latency-compensated local writes, errors, refresh-style rerenders, and cleanup; a gated real-emulator smoke covers initial/client/remote listener flow; live Vite probes confirm both preview entries and Fast Refresh injection. Full suite passes with 103 tests plus the gated emulator smoke. |

**Phase 2 exit:** a themed React preview can navigate and react to Firestore
updates without duplicate listeners or changes to the data/domain contract.

### Phase 3 — Shared React components and app shells

| Task | Owner | Status | Depends on | Parallel group | Deliverable / acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| RM-300 Build shared providers, error boundary, and feedback states | Claude | DONE | RM-210, RM-230 | P3-A | 2026-07-13: shared `AppProviders` composes store → MUI RTL theme → error boundary → write-operations → snackbar → hash router in one injectable place, and MemberApp/AdminApp now render through it (both duplicated provider stacks removed). New feedback primitives `LoadingState`/`EmptyState`/`ErrorState` (optional retry)/`AsyncContent` (maps `ListenerStatus`→loading/empty/error/retry) under `src/components/feedback/`; a class `ErrorBoundary` with a themed RTL fallback + reset-on-retry and a queued `SnackbarProvider`/`useSnackbar` (one toast at a time, FIFO, click-away-safe, Arabic dismiss) under `src/app/providers/`; `feedback.*` copy added to `strings.ar.ts`. Verified: typecheck ✓, lint ✓, 117 tests (+13) with 1 gated emulator test skipped ✓, two-entry production build unchanged ✓; both React previews render live through the composition with no React errors and correct RTL. |
| RM-310 Build responsive member/admin shells and navigation | Claude | DONE | RM-210, RM-220 | P3-A | 2026-07-13: generic route-typed `AppShell`/`AppNav`/`NavIcon` (`src/components/navigation/`) reproduce the legacy shared tab bar as MUI — fixed bottom bar `< lg` promoting to a physical-right vertical rail `≥ lg` (RTL `insetInlineStart:0` + `borderInlineEnd` inner edge), retained `.tab-bar` safe-area inset + `.icon-mask` currentColor icons (default SVG; override probe stays RM-330), `aria-current` active tab in primary teal, 56px touch targets, Arabic labels. Thin `MemberShell`/`AdminShell` supply the data-driven tab lists + per-surface column max-widths and own the sole `main` landmark (`MemberApp`/`AdminApp` compose them; `PreviewShell`→`section`). Verified: typecheck ✓, lint ✓, 124 tests (+7) ✓, two-entry build unchanged (member 5.28/admin 9.38 kB gzip) ✓, bundle-budget gate ✓ (member 315.72/350, admin 315.70/375 kB JS); live preview confirms mobile bottom bar + desktop physical-right rail with correct RTL, active state, and 96px content reservation for both apps. |
| RM-320 Build shared MUI form/display primitives | Codex | DONE | RM-210 | P3-B | 2026-07-14: `src/components/primitives/` now covers compact/outlined/quiet/destructive/hash/hero actions; titled, untitled, nested, and clickable cards; controlled text/search/number/date/multiline fields, portalled select, checkbox, and slider; Arabic-digit bounded stepper; semantic chips/notices; labelled/clamped progress; and a controlled confirmation dialog. A FIFO `ConfirmationProvider`/`useConfirmation` supplies the app-wide async replacement for native confirms. Central MUI overrides own 12px control/16px card radii, disabled state, field/surface styling, and 8px progress bars. `ThemeProbe` was removed and both previews compose the real primitives. Verified: typecheck ✓, lint ✓, 133 tests (+9) ✓, two-entry production build ✓, bundle budgets ✓ (member 321.69/367.80 kB; admin 321.68/367.78 kB), and live mobile/desktop RTL + portal checks in both previews ✓. |
| RM-330 Port charts and custom icon override support | Claude | DONE | RM-210 | P3-B | 2026-07-14: `src/components/charts/` delivers `DonutChart` (legacy 96-viewBox ring geometry, Arabic-Indic hero label, track-only at 0%, clamped 0–100, 112/88px sizes) and `SegmentBar` (value-proportional fills with 2px gaps; zero-value segments drop from the bar but stay in the full text legend), colors resolved from the MUI palette via a semantic `primary\|accent\|neutral` union because the React tree loads no `--color-*` vars. `src/components/icons/` re-expresses the BASE_URL icon URLs + one-shot PNG-over-SVG HEAD probe as a subscribable store + `useIconUrl`; `NavIcon` consumes it (superseding RM-310's hardcoded SVG URL) and both React entries start the probe. The probe additionally requires an image content-type — Vite's dev server answers missing PNGs with its 200 `text/html` SPA fallback, which false-positives the legacy `ok`-only probe (pre-existing dev-only defect; production 404s correctly). Verified: typecheck ✓, lint ✓, 149 tests (+16) ✓, two-entry build unchanged ✓, budgets ✓ (member 322.52/350, admin 322.50/375 kB JS); live previews show RTL charts at mobile+desktop in both apps, and a dropped-in `personal.png` overrode both navs live, reverting on delete. |
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
| Duplicate Firestore listeners under Strict Mode/HMR | Medium / High | Central subscription lifecycle, idempotent start, cleanup tests | RM-240 DONE |
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
| OD-02 | Final accepted member/admin bundle budgets | RM-040/RM-630 | Project owner + Codex | RESOLVED 2026-07-13 — member: 350 kB initial JS gzip / 400 kB conservative initial transfer; admin: 375 kB / 425 kB. `npm run check:bundle-budgets` is the canonical gate; RM-630 records the final comparison and any justified exception. |
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

### 2026-07-14 — Claude — RM-330 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `4cae693`; task commit pending at log-update time.
- Outcome: ported both legacy chart builders and the icon-override system to
  React. `DonutChart` reproduces the legacy ring exactly (96 viewBox, stroke 10,
  radius 41, 12-o'clock start, track-only at 0%, clamped 0–100, default 112px /
  metrics 88px) with the Arabic-Indic hero percentage centered over it;
  `SegmentBar` reproduces the breakdown bar (2px gaps, zero-value fills hidden,
  12px radius, legacy h-3 height) above a full text legend (`label: count` in
  Arabic-Indic digits), so identity is never color-alone. Colors resolve from
  the MUI palette through a semantic `primary|accent|neutral` union — the
  legacy `var(--color-…)` strings would silently fail because the React tree
  never loads `theme.css`. The icon system became a subscribable module store:
  BASE_URL-derived SVG defaults, a one-shot idempotent HEAD probe upgrading to
  dropped-in PNGs, and `useIconUrl` re-rendering exactly the icons whose
  override lands (the legacy tree relied on route-change re-renders instead).
  `NavIcon` now consumes the store, superseding its RM-310 hardcoded SVG URL;
  both React entries start the probe like the legacy entries do.
- Files/areas changed: new `src/components/charts/{DonutChart,SegmentBar,index}`
  and `src/components/icons/{iconSource,useIconUrl,index}`; edited
  `src/components/navigation/{NavIcon,types}` (override-aware URL; `IconName`
  now from `@/components/icons`, removing the React tree's last legacy-icons
  type import); new `src/app/ChartsPreview.tsx` composed into
  `MemberApp`/`AdminApp`; `src/app/entries/{member,admin}.tsx` call
  `resolveIconOverrides()`; `strings.ar.ts` gained `preview.chartsHeading`; new
  `tests/components/{charts,icons}.test.tsx` (+16 tests) and a stale wording fix
  in `tests/components/navigation.test.tsx`. Legacy `src/ui/shared/charts.ts` +
  `src/ui/shared/icons.ts` and all production inputs untouched; no data/domain,
  dependency, or lockfile change.
- Verification: `npm run typecheck` ✓; `npm run lint` ✓; `npm test` ✓ — 27 files
  / 149 tests (+16) with the gated emulator test skipped; `npm run build` ✓ still
  emits only `index.html` + `admin-nano.html` (member 5.28 / admin 9.38 / shared
  153.54 kB gzip — +0.02 kB from the new preview string, same pattern as RM-300);
  `npm run check:bundle-budgets` ✓ — member 322.52 kB JS / 368.63 kB transfer vs
  350/400, admin 322.50 / 368.61 vs 375/425; Prettier clean on changed files;
  `git diff --check` clean. Live dev-server verification (both previews, RTL):
  three donuts (٠٪/٥٧٪/١٠٠٪ accessible names, track-only at 0%, `#0f766e` fill,
  88px), segment bar 12px high with 2px gaps and value-proportional
  `flex-grow: 342/48/214` fills, full Arabic legend; mobile 375px keeps the card
  inside the column above the bottom bar, desktop 1280px keeps it clear of the
  physical-right 96px rail. The override was proven end-to-end: a temporary real
  `public/icons/personal.png` flipped the personal mask to `.png` live in BOTH
  apps' navs, and deleting it reverted every mask to `.svg`; console shows only
  the expected offline-Firestore errors. (Preview screenshots still time out
  environmentally, as in RM-310 — computed-geometry/a11y queries are the
  evidence.)
- Decisions and risks: (1) **Probe hardening — intentional delta from legacy.**
  Vite's dev server answers a missing `icons/<name>.png` HEAD with its SPA HTML
  fallback (200 `text/html`), so an `ok`-only probe false-positives every icon
  in dev and points masks at an HTML document (observed live before the fix;
  the legacy probe has this dev-only defect today, while production hosting
  404s correctly). The React probe therefore also requires an `image/*`
  content-type — truthful in dev, a no-op in production — with a regression
  test; the legacy module stays untouched and its quirk dies with it at RM-620.
  (2) The donut's *accessible name* uses Arabic-Indic digits via the shared
  `formatPercent` (the legacy aria-label used Western digits); the visible
  label is unchanged and `khatmaPercent` is already whole-number, so this only
  aligns AT output with RM-320's `ProgressBar`. The hero span is `aria-hidden`
  so AT hears the value once (legacy exposed it twice). (3) Chart colors are a
  closed semantic union resolved from the palette, not free-form strings, so
  Phase 5 callers cannot reintroduce CSS-var drift. (4) Charts remain purely
  presentational — RM-500/RM-530 own real-data wiring (admin Home/detail use
  `DonutChart` at 88px + `SegmentBar` with done/pending/remaining).
- Recommended next action: hand to Codex for RM-340 (browser-persistence hooks)
  and RM-350 (shared React test harness) — both unblocked (deps RM-200/RM-230/
  RM-300 are `DONE`) and they complete Phase 3. Phase 4 member feature work then
  has every shared contract it needs.

### 2026-07-14 — Claude — RM-330 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `4cae693` (`RM-320:
  build shared MUI form and display primitives`).
- Outcome: claimed RM-330 (port charts + custom icon override support) after
  confirming its dependency RM-210 (MUI RTL theme) is `DONE`. No broad
  implementation changes yet.
- Files/areas changed: tracker claim only (RM-330 row → IN PROGRESS, Migration
  Status phase line, and this Session Log entry).
- Verification: confirmed branch `reactmigration`, exact HEAD `4cae693`, and a
  clean working tree per the handoff block; read the plan top → active Phase 3 →
  latest Session Log; `npm run typecheck` ✓ as the preflight baseline.
  `package-lock.json` is unchanged since RM-130, so no fresh install is
  required.
- Decisions and risks: scope is re-expressing `src/ui/shared/charts.ts` (donut +
  segment bar; theme-token colors; Arabic-digit text so identity is never
  color-alone) and `src/ui/shared/icons.ts` (BASE_URL icon URLs + one-shot
  PNG-over-SVG HEAD probe feeding `.icon-mask` spans) as shared React
  components. RM-310's `NavIcon` currently hardcodes the default SVG URL; this
  task supersedes that URL resolution with the override-aware source. Legacy
  modules stay untouched (production path unchanged), no data/domain changes,
  and any new user-facing copy goes through `strings.ar.ts`.
- Recommended next action: build chart + icon components under
  `src/components/` with focused tests, wire them into both branch previews,
  then run the shared-component verification matrix (typecheck, lint, tests,
  build, bundle budgets, live RTL preview check) and set RM-330 `DONE`.

### 2026-07-14 — Codex — RM-320 → DONE

- Branch/commit: `reactmigration`, implemented from clean RM-310 handoff commit
  `ec9c10e`; task commit pending at log-update time.
- Outcome: built the shared Phase 3 form/display layer. `AppButton` covers compact,
  outlined, quiet/destructive, hash-link, and 56px full-width hero actions;
  `SurfaceCard`/`NestedSurface` cover titled, untitled, nested, and clickable
  cards; `AppTextField`/`AppSelectField`/`AppCheckboxField`/`AppSliderField`
  cover every legacy field kind while callers retain local drafts; `NumberStepper`
  supplies bounded Arabic-digit +/- controls; `StatusChip`/`NoticeBanner` and
  `ProgressBar`/`ProgressView` preserve text alongside semantic color. A controlled
  `ConfirmationDialog` plus FIFO `ConfirmationProvider`/`useConfirmation` replaces
  native confirms with an async, RTL-safe app-wide pattern. `ThemeProbe` is gone;
  both branch previews now render a composition of the real primitives.
- Files/areas changed: new `src/components/primitives/` public barrel and
  implementation; new confirmation context/provider/hook under `src/app/providers/`
  and composition in `AppProviders`; new `src/app/PrimitivesPreview.tsx` wired into
  `MemberApp`/`AdminApp`; centralized component overrides in `src/theme/muiTheme.ts`;
  shared confirmation/stepper/preview copy in `src/content/strings.ar.ts`; new
  `tests/components/primitives.test.tsx` plus expanded theme, provider-composition,
  and root tests. Deleted temporary `src/app/ThemeProbe.tsx`. No data/domain,
  dependency, lockfile, production-entry, or legacy UI change.
- Verification: `npm run typecheck` ✓; `npm run lint` ✓; `npm test` ✓ — 24 files / 133
  tests pass (+9) with the gated emulator test skipped; `npm run build` ✓ and still
  emits only `index.html` + `admin-nano.html` (member 5.28/admin 9.38/shared 153.52
  kB gzip); `npm run check:bundle-budgets` ✓ — member 321.69 kB JS / 367.80 kB
  transfer vs 350/400, admin 321.68 / 367.78 vs 375/425; changed files are Prettier
  clean and `git diff --check` is clean. Live in-app-browser verification on both
  dev previews: mobile 390x844 cards fit at 358px above the 63px bottom nav;
  desktop 1280px retains the physical-right 96px rail; document, fields, select
  listbox, and confirmation dialog are RTL; card/dialog radius is 16px, controls
  12px, progress 8px; select and modal portal outside `#app`; only the expected
  offline-Firestore messages appear, with no React errors.
- Decisions and risks: these are presentational/local-interaction contracts only;
  Phases 4–5 still own all feature-screen wiring and draft lifecycle behavior.
  Progress always pairs color with visible/accessible text, confirmation requests
  queue one at a time and resolve false on cancellation/unmount, and no native
  confirm is introduced in the React tree. RM-330 still owns donut/segment charts
  and PNG-over-SVG icon overrides; this task does not overlap them. The React spike
  remains under budget with 28.31 kB member-JS and 32.20 kB member-transfer headroom.
- Recommended next action: hand to Claude for RM-330 (charts + custom icon override
  probe); RM-210 is `DONE`, and the new display primitives are ready to host its
  chart legends/status text. RM-340/RM-350 remain independently unblocked.

### 2026-07-14 — Codex — RM-320 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `ec9c10e` (`RM-310:
  build responsive member/admin shells and navigation`). The owner-supplied
  handoff used the placeholder `<new hash>`; the current clean RM-310 task commit
  is treated as the intended handoff point.
- Outcome: claimed RM-320 under Codex after confirming its RM-210 dependency is
  `DONE`; shared MUI form/display primitive work is beginning.
- Files/areas changed: tracker claim only before broad implementation changes.
- Verification: read this plan end-to-end plus the repository instructions;
  confirmed branch `reactmigration`, clean working tree, and current HEAD; the
  pre-change `npm run typecheck` baseline passes. `package-lock.json` has not
  changed since RM-130, so no fresh install is required.
- Decisions and risks: keep feature-screen wiring in Phases 4–5 and preserve the
  legacy behavior contract while replacing the temporary `ThemeProbe`. New
  user-facing copy must live in `src/content/strings.ar.ts`; components must be
  reusable, accessible, RTL-safe, and cover the legacy buttons, surfaces, form
  controls, steppers, badges/chips, progress views, and confirmation flow.
- Recommended next action: inventory every legacy primitive and its call sites,
  define a compact shared React API, implement it with focused component tests,
  replace `ThemeProbe` in both previews, then run the full shared-component
  verification matrix.

### 2026-07-13 — Claude — RM-310 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `7e91386`; task commit pending at log-update time.
- Outcome: built the responsive member/admin shells + navigation. A generic,
  route-type-parameterized layer under `src/components/navigation/` (`AppShell` =
  centered content column + rail reservation; `AppNav` = the bottom-bar⇄right-rail
  nav; `NavIcon` = `.icon-mask` span) reproduces the legacy shared `renderTabBar`
  as MUI: on mobile a fixed full-width **bottom** bar with a top border and the
  retained `.tab-bar` safe-area inset; at `lg` it promotes to a **physical-right
  vertical rail** (RTL: `insetInlineStart:0` + `borderInlineEnd` inner edge;
  `.tab-bar` drops the inset at 1024px). Tabs are real `<a href="#/…">` React
  Router links (keyboard-accessible, drive the hash router); the active tab carries
  `aria-current="page"` + primary teal, inactive tabs the muted color; 56px
  (3.5rem) touch targets; icons paint `currentColor` through the mask using the
  bundled SVG. Thin `MemberShell`/`AdminShell` supply the data-driven Arabic tab
  lists (twins of `src/ui/{member,admin}/nav.ts`) and per-surface column
  max-widths (member 576/672/768, admin 672/896); the shell content column is now
  the **sole `main` landmark**, so `PreviewShell` was demoted from `<main>` to
  `<section>`. `MemberApp`/`AdminApp` render their (unchanged) preview content,
  including `ThemeProbe`, through the shells.
- Files/areas changed: new `src/components/navigation/{AppShell,AppNav,NavIcon,
  types,index}`; new `src/app/member/MemberShell.tsx` +
  `src/app/admin/AdminShell.tsx`; edited `src/app/{member/MemberApp,admin/AdminApp}
  .tsx` (compose the shells) and `src/app/PreviewShell.tsx` (`main`→`section`); new
  `tests/components/navigation.test.tsx`. No new user-facing copy (existing
  `strings.nav.*` / `strings.admin.nav*` reused); no data/domain, dependency, or
  lockfile change; no Firebase import added. The icon-override probe is
  deliberately left to RM-330 — `NavIcon` hosts only the default SVG.
- Verification: `npm run typecheck` ✓; `npm run lint` ✓ (incl. react-hooks and the
  Firebase-boundary guardrail); `npm test` ✓ — 124 pass (+7 new) with the 1 gated
  emulator test skipped; `npm run build` ✓, still emitting only `index.html` +
  `admin-nano.html` at unchanged sizes (member 5.28/admin 9.38 kB gzip, shared
  153.47 kB); `npm run check:bundle-budgets` ✓ (member 315.72 kB JS / 361.83 kB
  transfer vs 350/400; admin 315.70 / 361.81 vs 375/425 — both under; the +16 kB
  since RM-040 is RM-300+RM-310 shared-tree growth with ample headroom). Live
  browser preview (dev-verify, both entries): mobile = fixed bottom bar, `row`, top
  border, teal active tab / muted rest, 56px targets, mask icons tinting to
  currentColor; desktop 1280px = rail fixed on the **physical right** (left 1184,
  full height, `column`, inner border on its left edge), content reserved via
  `padding-inline-start`→physical `padding-right: 96px` and centered at the correct
  max-width; `dir=rtl`; only the expected offline-Firestore console errors.
- Decisions and risks: RTL physical placement was verified empirically in-browser
  (logical `insetInlineStart`/`borderInlineEnd`/`paddingInlineStart` resolve
  correctly under the stylis RTL cache — not double-flipped), per the task's stated
  approach. The shell is pure chrome, NOT wired into any feature screen (Phases 4–5
  own route content); it frames `children`. `ThemeProbe` stays inside member/admin
  content until RM-320 swaps in real primitives. Preview-tool screenshots timed out
  (renderer capture issue); correctness was proven via the accessibility tree plus
  computed geometry/color/ARIA queries instead.
- Recommended next action: RM-320 (shared MUI form/display primitives, Claude) —
  dep RM-210 `DONE`; it replaces `ThemeProbe` and gives the feature phases their
  buttons/cards/fields/steppers/badges/confirmation pattern. RM-330 (charts + the
  icon-override probe that supersedes `NavIcon`'s URL resolution) and RM-340/RM-350
  (Codex: persistence hooks, shared test harness) are also unblocked.

### 2026-07-13 — Claude — RM-310 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `7e91386`.
- Outcome: claimed RM-310 (responsive member/admin shells + navigation) after
  confirming its dependencies RM-210 (MUI RTL theme) and RM-220 (typed hash
  routing) are `DONE`. No broad implementation changes yet.
- Files/areas changed: tracker claim only (RM-310 row → IN PROGRESS, Migration
  Status phase line, and this Session Log entry).
- Verification: confirmed branch `reactmigration`, exact HEAD `7e91386`, and a
  clean tree; ran `npm run typecheck` ✓ as the preflight baseline; read the plan
  top → active Phase 3 → latest Session Log handoff; confirmed both deps `DONE`;
  inspected the current React shells (MemberApp/AdminApp → `AppProviders` +
  `PreviewShell` + `ThemeProbe`), the typed routing (`routes.ts`/`hooks`/
  `RouteLink`), the legacy shared tab bar + member/admin tab lists (the parity
  source), the MUI RTL theme + stylis cache + retained `.tab-bar`/`.icon-mask`
  global styles, UI-inventory §1.2 (responsive chrome), and theme-map §6/§7.4.
- Decisions and risks: this builds shared Phase 3 shell/nav contracts only — it
  must NOT wire feature screens (Phases 4–5 own that) or touch data/domain. The
  responsive nav (bottom bar `< lg` ⇄ physical-right rail `≥ lg`), safe-area
  inset, active `aria-current` + primary color, and Arabic labels must match the
  legacy `renderTabBar` exactly. New copy (if any) goes through `strings.ar.ts`;
  existing nav labels are reused. Nav icons render via the retained `.icon-mask`
  span with the default SVG only — the PNG-over-SVG override probe stays RM-330's.
  RTL physical placement is verified in the browser preview, not asserted from
  reasoning.
- Recommended next action: build a generic `AppShell`/`AppNav`/`NavIcon` under
  `src/components/navigation/`, thin member/admin tab lists + shell wrappers under
  `src/app/{member,admin}/`, refactor MemberApp/AdminApp onto the shell, add
  component tests (structure/active-state/labels), run the full suite + build, and
  verify both previews in the browser at mobile and desktop widths; then set
  RM-310 `DONE`.

### 2026-07-13 — Claude — RM-300 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit `36c5dd3`;
  task commit pending at log-update time.
- Outcome: built the Phase 3 shared foundation. A single `AppProviders` now
  composes the whole provider stack — Redux store + Firestore subscriptions → MUI
  RTL theme + `CssBaseline` → error boundary → injectable write-operations →
  app-wide snackbar → hash router — in one place, and `MemberApp`/`AdminApp` render
  through it, deleting the two duplicated provider stacks. Added reusable feedback
  primitives under `src/components/feedback/`: `LoadingState` (accessible
  `role="status"` region), `EmptyState` (quiet, optional action — an empty result
  is not an error), `ErrorState` (MUI `Alert`/`role="alert"` + optional retry), and
  `AsyncContent`, which switches a Firestore `ListenerStatus` to loading / empty /
  error / retry so feature routes stop re-implementing the four states. Added a
  class `ErrorBoundary` (themed RTL fallback via `ErrorState`, reset-on-retry,
  `onError` hook) and a queued `SnackbarProvider`/`useSnackbar` (one toast at a
  time, FIFO, click-away-safe, RTL, Arabic dismiss label) under `src/app/providers/`,
  plus a `providers/index.ts` barrel. Feedback/crash/dismiss copy added to
  `strings.ar.ts` (`feedback.*`).
- Files/areas changed: new `src/components/feedback/{LoadingState,EmptyState,
  ErrorState,AsyncContent,index}`; new `src/app/providers/{AppProviders,ErrorBoundary,
  SnackbarProvider,useSnackbar,snackbarContext,index}`; edited `src/app/member/
  MemberApp.tsx` and `src/app/admin/AdminApp.tsx` (onto `AppProviders`); edited
  `src/content/strings.ar.ts` (`feedback.*`); new tests `tests/components/
  feedback.test.tsx` and `tests/app/{error-boundary,snackbar,shared-providers}.test.tsx`.
  No data/domain, dependency, or lockfile change; no Firebase import escapes
  `src/data/`.
- Verification: `npm run typecheck` ✓; `npm run lint` ✓ (clean, incl.
  react-hooks/react-refresh and the Firebase-boundary guardrail); `npm test` ✓ — 22
  files / 117 tests pass (+13 new) with the 1 gated emulator test skipped; `npm run
  build` ✓ and still emits only `index.html` + `admin-nano.html` at unchanged
  member/admin sizes (5.28/9.38 kB gzip), the shared chunk moving 153.36→153.47 kB
  gzip only because the legacy tree also imports the new `feedback` strings.
  Prettier clean on changed files; `git diff --check` clean. Live smoke: `npm run
  dev`, both `/react-preview.html` and `/admin-react-preview.html` render through
  `AppProviders` with no React errors and correct RTL (only the expected
  offline-Firestore connection errors appear, confirming the subscription bridge
  runs inside the composition).
- Decisions and risks: the primitives reuse the existing `ListenerStatus`/
  `OperationState` vocabulary instead of a parallel one and stay purely
  presentational (no store coupling beyond a type-only `ListenerStatus` import).
  They are intentionally NOT wired into any member/admin feature screen — Phases 4–5
  own that; `ThemeProbe` stays until RM-320 swaps in real primitives. `ErrorBoundary`
  complements, not replaces, per-operation `useOperation` feedback. The snackbar
  shows one message at a time by design (queued) to avoid stacked toasts. The 500 kB
  shared-chunk warning is unchanged and remains RM-040/RM-630's.
- Recommended next action: RM-310 (responsive member/admin shells + navigation,
  Claude) — its deps RM-210/RM-220 are `DONE` and it composes directly on
  `AppProviders` + these feedback states. RM-320 (shared form/display primitives) is
  the natural follow-on and will replace `ThemeProbe`. RM-340/RM-350 (Codex:
  persistence hooks, shared test harness) are also unblocked.

### 2026-07-13 — Claude — RM-300 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `36c5dd3`.
- Outcome: claimed RM-300 (shared providers, error boundary, and feedback states)
  after confirming its dependencies RM-210 (MUI RTL theme) and RM-230 (Redux store)
  are `DONE`. No broad implementation changes yet.
- Files/areas changed: tracker claim (RM-300 row → IN PROGRESS, Migration Status
  phase line, and this Session Log entry) only.
- Verification: confirmed branch `reactmigration`, exact HEAD `36c5dd3`, and a clean
  working tree; read the plan top → active Phase 3 → latest Session Log handoff;
  confirmed both dependencies `DONE`; inspected the implemented provider stack
  (`AppStoreProvider` → `AppThemeProvider` → `AppHashRouter`), the duplicated
  MemberApp/AdminApp compositions, the local operation-feedback contract
  (`useOperation`/`useWriteOperation`), the shared `ListenerStatus` shape, the MUI
  RTL theme, and retained global styles. Baseline check to run before broad changes.
- Decisions and risks: this task builds shared Phase 3 contracts only — it must not
  wire feedback/providers into member or admin feature screens (Phases 4–5 own that)
  and must not touch data/domain. New user-facing copy goes through
  `src/content/strings.ar.ts` (no hardcoded strings). Error boundary, snackbar, and
  feedback-state components must be RTL-correct and reuse the existing
  `OperationState`/`ListenerStatus` vocabulary rather than inventing a parallel one.
- Recommended next action: add feedback copy to `strings.ar.ts`; build reusable
  `LoadingState`/`EmptyState`/`ErrorState` (with retry) under `src/components/`, an
  `ErrorBoundary` and a snackbar provider/hook under `src/app/providers/`, and a
  shared `AppProviders` composition; refactor MemberApp/AdminApp onto it; add
  component tests; run the full suite + build; then set RM-300 `DONE`.

### 2026-07-13 — Codex — RM-040 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `67491ca`; task commit pending at log-update time.
- Outcome: added an explicit, non-deployable React/MUI production-build spike
  with a Vite manifest and deterministic manifest-graph budget checker. Recorded
  member/admin initial JavaScript at 299.38/299.37 kB gzip and conservative
  initial transfer at 345.49 kB each; accepted member ceilings are 350 kB JS /
  400 kB transfer and admin ceilings are 375/425 kB.
- Files/areas changed: `vite.react-spike.config.ts`; bundle-budget checker under
  `scripts/`; package scripts; TypeScript/ESLint/generated-output configuration;
  production-entry isolation test; README usage; this tracker (measurements,
  AD-12, OD-02 resolution, RM-040 status, and Session Log).
- Verification: `npm run lint` passed; `npm test` passed (18 files + 1 skipped,
  104 tests + 1 skipped); `npm run build` passed and still emitted only the two
  legacy HTML entries; `npm run check:bundle-budgets` passed both entries beneath
  both accepted ceilings; `git diff --check` passed. The tooling test explicitly
  verifies that only the separate spike config contains React build inputs.
- Decisions and risks: OD-02 is resolved. The known Vite warning remains because
  the current shared React chunk is 970.23 kB minified (Vite reports 302.09 kB
  gzip); the accepted gate measures the whole static entry graph, so changing
  chunk boundaries cannot conceal total initial-load growth. RM-630 still owns
  route splitting, direct-import review, final measurement, and any justified
  exception rather than a silent budget increase.
- Recommended next action: begin Phase 3 with RM-300 (shared providers, error
  boundary, and feedback states); RM-210 and RM-230 are `DONE`, and the new budget
  gate should be rerun after shared-shell or dependency changes that affect the
  initial graph.

### 2026-07-13 — Codex — RM-040 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `67491ca` before this
  tracker claim.
- Outcome: claimed RM-040 after confirming its RM-120 and RM-200 dependencies are
  `DONE`; implementation and budget analysis are beginning.
- Files/areas changed: tracker claim (RM-040 row + this Session Log entry) only;
  no broad implementation changes yet.
- Verification: preflight `npm run build` passed; the legacy production build
  emitted member 5.28 kB gzip, admin 9.38 kB gzip, shared JavaScript 153.36 kB
  gzip, and shared CSS 4.92 kB gzip, with the known 500 kB uncompressed shared-
  chunk warning.
- Decisions and risks: OD-02 remains open until the React/MUI spike is measured
  and informed member/admin initial-load budgets are documented.
- Recommended next action: measure comparable legacy and React/MUI preview asset
  graphs, define initial-load and performance budgets with reproducible evidence,
  and resolve OD-02.

### 2026-07-13 — Claude — RM-030 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `51118ee`; task commit pending at log-update time.
- Outcome: recorded the implemented React migration architecture in
  `ARCHITECTURE.md` as a new "React Migration Architecture (branch-only)" section,
  without erasing historical intent. The section documents: the new `src/app/`
  layer and its subtree; the preserved one-directional dependency boundary
  (Firebase confined to `src/data/`, enforced by the same ESLint Guardrail 1 that
  now also covers `src/app/`); the provider composition
  (`AppStoreProvider` → `AppThemeProvider` → `AppHashRouter`, `bootstrap` mounting
  under `StrictMode`); the four serializable Redux slices (roster, khatmas,
  per-khatma assignments, nullable content) with shared listener state, typed
  hooks, and selectors; the reference-counted, Strict-Mode/Fast-Refresh-safe
  Firestore→Redux subscription bridge with injectable sources and string-only
  errors; the frozen 16-mutation write adapter plus `useWriteOperation` local,
  latest-call-safe feedback (not Redux); the shared pure hash-route contract used
  by both legacy and React; and the centralized MUI RTL theme with retained CSS.
- Files/areas changed: `ARCHITECTURE.md` (new section + an Overview coexistence
  note + a Directory-Map pointer; existing legacy content unchanged); this tracker
  (RM-030 row → DONE with evidence, Next-milestone pointer, and this log entry).
  No source, data/domain, dependency, or lockfile change.
- Verification: this is a documentation-only change (Verification Matrix →
  "Documentation only"). `git diff --check` is clean; `npx prettier --check
  ARCHITECTURE.md` passes (the pre-existing non-conforming `REACT_MIGRATION_PLAN.md`
  was left as hand-maintained rather than bulk-reformatted, to keep the diff
  focused); both new internal anchors resolve to real headings; every referenced
  path (`src/app/`, `vite.config.ts`, `REACT_MIGRATION_PLAN.md`, `eslint.config.js`,
  `src/domain/types.ts`) exists. Content was cross-checked against the shipped
  files under `src/app/`, `eslint.config.js`, and `vite.config.ts`.
- Decisions and risks: the addendum is explicit that React is a **branch-only Vite
  dev preview** and that production still ships the legacy two-entry framework-free
  app until the Phase 6 cutover, so the doc does not overstate migration status.
  This resolves Claude Review Note #2 (RM-030 previously had no owner). Observed
  but out of scope: `vite.config.ts` links readers to `ARCHITECTURE.md#security`,
  but no `## Security` heading exists in `ARCHITECTURE.md` (a pre-existing dangling
  anchor) — flagged for a separate docs fix, not folded into this React-focused
  task.
- Recommended next action: begin Phase 3. RM-300 (shared providers, error
  boundary, feedback states) is the natural next Claude task — its dependencies
  RM-210 and RM-230 are `DONE`. RM-040 (bundle/performance budgets, Codex) is also
  now unblocked (RM-120 and RM-200 are `DONE`) if the owner prefers to close that
  Phase 0/2 straggler first.

### 2026-07-13 — Claude — RM-030 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `51118ee`.
- Outcome: claimed RM-030 (previously `Unassigned`, resolving Claude Review Note
  #2) to record the now-verified React, MUI/RTL theme, hash-routing, Redux store,
  Firestore→Redux subscription bridge, and local write-operation boundaries in
  `ARCHITECTURE.md`. No broad changes yet.
- Files/areas changed: tracker claim (RM-030 row + this Session Log entry) only.
- Verification: confirmed branch `reactmigration`, exact HEAD `51118ee`, and a
  clean working tree; read the plan top → active Phase 3 → latest Session Log
  handoff; confirmed both dependencies (RM-020 UI inventory, RM-260 foundation
  verification) are `DONE`; inspected the implemented `src/app/` tree (store,
  slices, subscription bridge, providers, routing, operations, roots) plus
  `eslint.config.js` and `vite.config.ts` so the addendum matches shipped code.
- Decisions and risks: this is documentation only (Verification Matrix →
  "Documentation only" row: link/path review + `git diff --check`, no full suite
  unless code also changes). The addendum must state that React is a branch-only
  dev preview and that production still ships the legacy two-entry framework-free
  app until the Phase 6 cutover — it must not erase or overstate the current
  architecture. The legacy layer description remains accurate and stays.
- Recommended next action: add the "React Migration Architecture (branch-only)"
  section to `ARCHITECTURE.md`, then run the documentation-only checks and set
  RM-030 `DONE`.

### 2026-07-13 — Codex — RM-260 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `a9a68db`; task commit pending at log-update time.
- Outcome: verified the complete Phase 2 foundation with a composed React test
  spanning the store provider, typed hash router, Firestore bridge, assignment
  lifecycle, and write-operation feedback. Added a gated real-emulator smoke
  that proves an initial roster snapshot, a client write, and a separate-client
  remote update all reach Redux. Added explicit Vite plugin-chain coverage and
  live dev-server evidence for Fast Refresh injection.
- Files/areas changed: added focused foundation integration and emulator smoke
  tests; extended the production-entry tooling test with the React/Fast Refresh
  plugin assertion; updated this tracker. No production source, data/domain
  contract, dependency, or lockfile changed.
- Verification: focused foundation/lifecycle/tooling suite passed (6 files / 17
  tests); gated Firestore emulator smoke passed (1 file / 1 test) and shut down
  cleanly; live Vite probes returned 200 for both React previews and found the
  refresh preamble plus transformed-module refresh registration; `npm run
  typecheck` passed; `npm run lint` passed; `npm test -- --run` passed (18 files
  / 103 tests, with only the separately-passed gated emulator test skipped);
  `npm run build` passed and emitted only `index.html` and `admin-nano.html` as
  production entries. Changed test files pass Prettier.
- Decisions and risks: the deterministic composed test models Firestore's
  latency-compensated local snapshot while the write promise remains pending;
  the emulator smoke independently proves the actual data boundary and Redux
  bridge. The in-app browser binding was unavailable because its local runtime
  hit a sandbox permission error, so live runtime proof used Vite HTTP/transform
  probes while navigation behavior remained covered interactively in jsdom.
  The existing shared-chunk warning remains assigned to RM-040/RM-630.
- Recommended next action: take RM-030 to document the now-verified React,
  routing, Redux, subscription, and local-operation boundaries in
  `ARCHITECTURE.md`; both of its dependencies are `DONE`.

### 2026-07-13 — Codex — RM-260 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `a9a68db`.
- Outcome: claimed RM-260 after confirming all dependencies are `DONE`; no
  implementation changes have been made yet.
- Files/areas changed: tracker claim and this Session Log entry only; no broad
  changes yet.
- Verification: confirmed the requested HEAD is `a9a68db`; confirmed the
  working tree was clean; read the plan through active Phase 2 and the latest
  Session Log handoff; baseline `npm test -- --run` passed (17 files / 101
  tests).
- Decisions and risks: sequential single-writer mode remains active. RM-260
  must add evidence for Fast Refresh, navigation, initial snapshots, remote
  updates, local optimistic updates, error handling, and listener cleanup
  without weakening the legacy two-entry production boundary.
- Recommended next action: inspect the Phase 2 implementation and focused tests,
  close RM-260 coverage gaps, then run its complete acceptance checks.

### 2026-07-13 — Codex — RM-250 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `f87431d`; task commit pending at log-update time.
- Outcome: exposed all 16 existing roster, content, khatma, assignment, and
  distribution mutations through one typed React-facing adapter. Added a local
  operation hook with consistent idle/pending/success/failure state, typed
  results, preserved Error subclasses, retry/reset support, and latest-call-safe
  feedback; an injectable provider keeps future feature tests off Firestore.
- Files/areas changed: added `src/app/operations/` adapter, context/provider,
  generic operation hook, typed write hook, and public exports; added focused
  write/feedback tests; updated this tracker. Existing `src/data/` and legacy UI
  behavior were not changed.
- Verification: focused write-operation suite passed (1 file / 5 tests);
  `npm run typecheck` passed; `npm run lint` passed; `npm test` passed (17 files /
  101 tests); `npm run build` passed and emitted only `index.html` and
  `admin-nano.html` as production entries. Changed code and tests pass Prettier;
  `git diff --check` passed.
- Decisions and risks: transient operation feedback remains local rather than in
  Redux, matching the state-ownership plan; every invocation still reaches the
  existing data function, while only the newest overlapping invocation controls
  visible feedback. Typed data-layer errors remain available for route-specific
  copy such as released-chunk and same-day-distribution messages. No Firebase
  import exists outside `src/data/`; no dependency or lockfile change was needed.
  The existing shared-chunk size warning remains assigned to RM-040/RM-630.
- Recommended next action: take RM-260 jointly to verify the complete Phase 2
  foundation; RM-210, RM-220, RM-240, and RM-250 are now all `DONE`.

### 2026-07-13 — Codex — RM-250 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `f87431d`.
- Outcome: claimed RM-250 under Codex to expose the existing data-layer write
  functions through UI-facing actions with consistent pending, success, and
  failure feedback.
- Files/areas changed: tracker claim and this Session Log entry only; no broad
  implementation changes yet.
- Verification: confirmed branch `reactmigration`, exact HEAD
  `f87431defde49f75fa83a27839870a7565ecc562`, and a clean working tree; read the
  plan through active Phase 2 and the latest Session Log handoff; confirmed
  dependency RM-230 is `DONE`; focused pre-change store baseline passed (1 file /
  4 tests).
- Decisions and risks: preserve the existing `src/data/` Firebase boundary and
  serializable Redux state; operation feedback must remain consistent without
  duplicating domain or write behavior in React-facing code. `package-lock.json`
  is unchanged by the RM-240 handoff, so no fresh install was required.
- Recommended next action: inventory write signatures and current legacy call
  sites, define the typed UI-facing operation contract, then add focused tests
  for pending, success, failure, and retry/concurrency behavior.

### 2026-07-13 — Codex — RM-240 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `f32e325`; task commit pending at log-update time.
- Outcome: connected the existing roster, global-content, khatma, and assignment
  subscriptions to Redux through a reference-counted lifecycle bridge. Both
  React previews now mount the Redux/store provider; later feature components
  can retain assignments dynamically with a typed hook.
- Files/areas changed: added the Firestore subscription bridge, production source
  adapter, provider context, Redux provider, and assignment-subscription hook
  under `src/app/`; wired the member/admin preview roots; added focused bridge,
  Strict Mode, cleanup, snapshot, and error tests; updated this tracker.
- Verification: scoped bridge/provider/root/store suite passed (4 files / 10
  tests); `npm run typecheck` passed; `npm run lint` passed; `npm test` passed
  (16 files / 96 tests); `npm run build` passed and emitted only `index.html` and
  `admin-nano.html` as production entries. Changed code and tests pass Prettier;
  `git diff --check` passed.
- Decisions and risks: the three global listeners share one reference count;
  assignments are reference-counted independently by khatma and removed from
  Redux after their final consumer releases them. Cleanup functions are
  idempotent, post-cleanup callbacks are ignored, Strict Mode never overlaps
  underlying listeners, missing global content maps to `null`, and subscription
  failures store plain messages only. Firebase imports remain confined to
  `src/data/`; no dependency or lockfile change was needed. The existing
  shared-chunk size warning remains assigned to RM-040/RM-630.
- Recommended next action: take RM-250 to expose the existing write functions
  with consistent operation feedback; its RM-230 dependency is already `DONE`.

### 2026-07-13 — Codex — RM-240 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `f32e325`.
- Outcome: claimed RM-240 under Codex to bridge the existing Firestore roster,
  content, khatma, and dynamic assignment subscriptions into Redux with
  lifecycle-safe cleanup.
- Files/areas changed: tracker claim and this Session Log entry only; no broad
  implementation changes yet.
- Verification: confirmed branch `reactmigration`, exact HEAD
  `f32e325fe4675b084550a9eaa4a8a627a8230853`, and a clean working tree; read the
  plan through active Phase 2 and the latest Session Log handoff; confirmed
  dependency RM-230 is `DONE`; scoped pre-change store baseline passed (1 file /
  4 tests).
- Decisions and risks: preserve the `src/data/` Firebase boundary and serializable
  Redux state; centralize subscription ownership so repeated starts and Strict
  Mode remounts cannot leak or duplicate listeners. `package-lock.json` is
  unchanged from the preceding RM-230 task, so no fresh install was required.
- Recommended next action: inspect the current subscription contracts and Redux
  slice actions, then implement listener lifecycle coordination and focused
  cleanup/error/update tests.

### 2026-07-13 — Codex — RM-230 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `18c662d`; task commit pending at log-update time.
- Outcome: created the Redux store foundation with typed React-Redux hooks,
  normalized base slices, listener lifecycle state, and selectors for all
  planned shared Firestore-backed state.
- Files/areas changed: added `src/app/store/` with the store, typed hooks,
  roster/khatma/content/assignment slices, shared listener state, selectors,
  and public exports; added focused store tests; updated this tracker.
- Verification: focused store suite passed (1 file / 4 tests); `npm run
  typecheck` passed; `npm run lint` passed; `npm test` passed (14 files / 92
  tests); `npm run build` passed and emitted only `index.html` and
  `admin-nano.html` as production entries.
- Decisions and risks: collection snapshots are normalized while preserving
  Firestore order; assignments are isolated by khatma so RM-240 can own dynamic
  listener lifecycles independently. Redux holds domain values, status strings,
  and error messages only—no snapshots, references, unsubscribe functions,
  `Error` objects, maps, sets, or browser-persistence values. No dependency or
  lockfile change was needed. The existing build chunk-size warning remains
  tracked by RM-040 and does not block RM-230.
- Recommended next action: take RM-240 to connect the existing roster, content,
  khatma, and dynamic assignment subscriptions to these slice actions; its
  RM-230 dependency is now `DONE`.

### 2026-07-13 — Codex — RM-230 → IN PROGRESS

- Branch/commit: `reactmigration` at clean handoff commit `18c662d`.
- Outcome: claimed RM-230 to create the Redux store, typed hooks, base slices,
  selectors, and state-type tests.
- Files/areas changed: tracker claim and this Session Log entry only; no broad
  implementation changes yet.
- Verification: confirmed branch `reactmigration`, exact HEAD `18c662d`, and a
  clean working tree; read the plan through active Phase 2 and the latest
  Session Log handoff; confirmed dependency RM-200 is `DONE`.
- Decisions and risks: preserve the accepted state-ownership model and keep the
  store limited to serializable planned state; no new risk identified yet.
- Recommended next action: run the smallest relevant baseline checks, inspect
  existing data/domain contracts, then implement and verify RM-230.

### 2026-07-13 — Codex — RM-220 → DONE

- Branch/commit: `reactmigration`, implemented from clean handoff commit
  `ce684ae`; task commit pending at log-update time.
- Outcome: implemented typed React hash routing for both preview roots while
  preserving all member/admin legacy URLs and default fallback behavior.
- Files/areas changed: added shared route contracts, path/hash builders,
  `AppHashRouter`, typed current-route/navigation hooks, and typed link
  components under `src/app/routing/`; wired `MemberApp` and `AdminApp` to expose
  the parsed route on their preview surfaces; converted the legacy member/admin
  route modules to compatibility exports backed by the same contract; added
  focused React routing coverage and strengthened root tests.
- Verification: `npm run typecheck` passed; `npm run lint` passed; focused route
  suite passed (4 files / 19 tests); `npm test` passed (13 files / 88 tests);
  `npm run build` passed and still emitted only the two production legacy HTML
  entries (`index.html`, `admin-nano.html`).
- Decisions and risks: unknown hashes select the established default route
  without rewriting browser history. Route objects are discriminated unions, so
  feature code navigates and links without assembling strings. The legacy and
  React surfaces deliberately share pure parsers/builders during migration to
  prevent URL drift. No dependency or lockfile change was required. The existing
  build chunk-size warning remains tracked by RM-040; it does not block RM-220.
- Recommended next action: take RM-230 (Redux store, typed hooks, and base
  slices), whose RM-200 dependency is already `DONE`.

### 2026-07-13 — Codex — RM-220 → IN PROGRESS

- Branch/commit: `reactmigration` at `ce684ae`; clean handoff confirmed before
  claiming the task.
- Outcome: claimed RM-220 to implement typed hash routing for the React member
  and admin previews while preserving existing URLs and fallback behavior.
- Files/areas changed: tracker claim and this Session Log entry only; no broad
  implementation changes yet.
- Verification: scoped pre-change baseline passed:
  `npm test -- tests/ui/router.test.ts tests/ui/admin-routes.test.ts tests/app/react-apps.test.tsx`
  (3 files / 15 tests).
- Decisions and risks: `package-lock.json` is unchanged since the prior Codex
  handoff, so `npm ci` was not required. Existing legacy route contracts and
  fallback semantics will be inventoried before selecting the typed route API.
- Recommended next action: implement RM-220 and add route-contract tests for
  both React preview roots.

### 2026-07-13 — Claude — RM-210 → DONE

- Branch/commit: `reactmigration`, implemented from
  `3c082a5daa0f62dbe4f36d46e7ddd297529c0b43`; task commit pending at log-update
  time.
- Outcome: the centralized MUI RTL theme is implemented and wired into both RM-200
  preview roots. RM-210 acceptance criteria pass (tokens, `dir=rtl`, theme
  direction, Emotion cache, portals, fonts, `CssBaseline` — all verified).
- Files/areas changed (Lane B only): added `src/theme/muiTheme.ts` (token→
  `createTheme` map + `tokens` export), `src/theme/rtlCache.ts` (`prefixer` +
  `rtlPlugin` Emotion cache, key `mui-rtl`), `src/theme/globalStyles.ts` (retained
  AD-09 CSS: Amiri `@font-face`, `--font-ui`/`--font-quran`/reading-scale vars,
  `.quran-text`, `.icon-mask`, `.tab-bar`), `src/app/providers/AppThemeProvider.tsx`
  (CacheProvider ▸ ThemeProvider ▸ CssBaseline ▸ GlobalStyles + forces
  `dir`/`lang`), `src/app/ThemeProbe.tsx` (preview-only theme demo), and
  `src/types/stylis.d.ts` (minimal ambient `stylis` types). Wired the provider +
  probe into `MemberApp`/`AdminApp`. Added `tests/theme/mui-theme.test.ts` and
  `tests/theme/app-theme-provider.test.tsx`. `theme.css` left byte-unchanged.
- Verification on Node `24.14.0` (repo pins `24.18.0` — rerun there for the final
  gate): `npm run typecheck`, `npm run lint`, `npm test` (12 files / **84 tests**,
  +13 vs RM-200's 71), and `npm run build` (two-entry; `dist/` still emits only
  `index.html` + `admin-nano.html`) all passed. Live branch-preview evidence via
  the dev server (both `react-preview.html` and `admin-react-preview.html`):
  `html[dir=rtl][lang=ar]`; body bg `#faf7f0`, ink `#1f2a24`, `margin:0`
  (CssBaseline); primary button `#0f766e` / `#fff` / `border-radius:12px` /
  `direction:rtl` / `mui-rtl-*` class; `.quran-text` in `"Amiri Quran"` at 25.6px
  (1.6rem × reading-scale 1), `text-align:justify`; and an opened Select whose
  listbox is portalled **outside `#app` into `body`**, carries the `mui-rtl-*`
  class, and computes `direction:rtl`. Console clean (the only errors are the
  legacy `index.html`'s offline-Firestore noise, not the React tree). The
  screenshot tool timed out environmentally; structure/'computed-style checks
  (the harness-preferred method) stand as the evidence.
- Decisions and risks:
  - **Fonts / theme-map R4 (resolved for RM-210):** kept the current `--font-ui`
    stack verbatim (Tajawal preferred, `system-ui` fallback) as
    `typography.fontFamily='var(--font-ui)'` — exact parity, **no third-party font
    runtime added**. Bundled the already-local Amiri Quran `@font-face` so Quran
    text renders. The self-host-Tajawal-vs-formally-drop call remains an **OD-03**
    input for the owner; the app still renders `system-ui` for users without
    Tajawal installed, exactly as today.
  - **Two-copy palette (R1):** the palette + retained rules are duplicated between
    `muiTheme.ts`/`globalStyles.ts` and the still-legacy `theme.css` `@theme`
    during transition. `theme.css` is byte-unchanged (legacy path unaffected);
    `tests/theme/mui-theme.test.ts` parses `theme.css` and fails loudly if the two
    ever drift. Both collapse to one at RM-620.
  - **`shape.borderRadius` = 12 (button)**; card 16px / pill radii are applied
    per-component in **RM-320**, not here (kept the task boundary clean). No
    component `styleOverrides` were added — RM-320 owns those.
  - **`@types/stylis` FOLLOW-UP (Lane A / Codex):** `stylis` ships no types and
    `@types/stylis` is absent, so RM-210 added a minimal local `src/types/stylis.d.ts`
    rather than churn `package.json`/the lockfile on a non-pinned runtime in a
    theme commit. If Lane A later adds `@types/stylis`, **delete that file** (the
    two would clash on `prefixer`). Low priority; not a blocker.
  - **`ThemeProbe`** is a temporary preview-only demo (dev entries only, excluded
    from production) and is expected to be replaced when RM-320 lands real
    primitives.
- Recommended next action: hand off to Codex for **RM-220** (typed hash routing)
  and **RM-230** (Redux store) — both depend only on RM-200 (`DONE`) and are
  unblocked. Claude's Phase 3 shell/primitive tasks (RM-300/310/320) now have the
  theme foundation they need. Emitting a Handoff Instruction Block below.

### 2026-07-13 — Claude — RM-210 → IN PROGRESS

- Branch/commit: `reactmigration` at
  `3c082a5daa0f62dbe4f36d46e7ddd297529c0b43`; clean working tree confirmed before
  the tracker claim (matches Codex's RM-200 handoff hash).
- Outcome: claimed RM-210 (centralized MUI RTL theme) under Claude after
  confirming both dependencies — RM-115 (Tailwind→MUI token map) and RM-130
  (React tooling) — are `DONE`. Implementation not yet begun at log-update time.
- Files/areas changed: this tracker only before broad changes.
- Preflight/verification: branch, exact HEAD, and clean tree confirmed per
  §Operating Mode receiving-agent preflight; `npm run typecheck` passed; the React
  toolchain (React 19.2.7, MUI 9.2.0, Emotion 11.14, `stylis-plugin-rtl` 2.1.1,
  Redux Toolkit) is present in the shared tree. Local shell is Node `24.14.0`; the
  repo pins `24.18.0`, which remains required for final acceptance evidence.
- Plan for the task (consumes `REACT_MIGRATION_THEME_MAP.md` §2–§8): add a pure
  `createTheme` mapping (palette/typography/`shape`/`spacing:4`/breakpoints px +
  `direction:'rtl'`), an RTL Emotion cache (`prefixer` + `rtlPlugin`, key
  `mui-rtl`), an `AppThemeProvider` (CacheProvider ▸ ThemeProvider ▸ CssBaseline ▸
  retained `GlobalStyles`), and wire it into the RM-200 member/admin preview
  roots. Font decision (theme-map R4): keep the current `--font-ui` stack verbatim
  (parity, no third-party font runtime) and bundle the already-local Amiri Quran
  `@font-face`; the self-host-Tajawal-vs-drop call stays an OD-03 input.
- Decisions and risks: only Lane B edits the central theme while RM-210 is active
  (collision rule). The React preview does not import `theme.css`, so retained CSS
  (AD-09 §8) ships as React `GlobalStyles`; the palette/retained rules temporarily
  duplicate `theme.css` until RM-620 (accepted R1 pattern), and `theme.css` is left
  byte-unchanged so the legacy path is unaffected.
- Recommended next action: implement the theme/provider, add theme + provider +
  portal RTL tests, verify in the browser preview, then close RM-210 and hand to
  Codex for RM-220/RM-230.

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

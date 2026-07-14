# React Migration Plan and Governance

This is the stable plan for migrating the member and admin UIs from
framework-free TypeScript and Tailwind CSS to React, Material UI, and Redux
Toolkit. It is not routine startup context; [`NOW.md`](NOW.md) routes agents to
the portions needed by a task.

## Scope

In scope:

- React shells and routes for both member and admin entries.
- Centralized MUI RTL theme and reusable components.
- Redux Toolkit for shared serializable application data and statuses.
- Lifecycle-safe adapters around existing Firestore subscriptions and writes.
- React parity for every current member and admin workflow.
- Node LTS, dependencies, CI, lint, tests, build, accessibility, and bundle work.
- Legacy DOM/Tailwind removal only after both React cutovers.
- Final documentation and owner-controlled merge readiness.

Not in scope without separate approval:

- Firestore schema or distribution-rule changes.
- Replacing Firebase; adding a server, SSR, or Cloud Functions.
- Authentication or a replacement admin-access strategy.
- Product expansion, broad visual redesign, or Quran data/semantic changes.
- Merging to `main` or deploying before the final owner-approved gate.

If the migration exposes a data/domain defect, record a separate task before
changing those layers.

## Baseline and budgets

- Migration base: `6992007`.
- Baseline UI: framework-free TypeScript DOM rendering with Tailwind CSS 4.
- Deployment: static GitHub Pages with separate member/admin HTML entries.
- Reused layers: Firebase/Firestore under `src/data/`; pure logic under
  `src/domain/`; content and Quran data under `src/content/`.
- Baseline suite at migration start: typecheck, lint, 66 tests, production build.

Canonical React budget command: `npm run check:bundle-budgets`.

| Surface | Initial JS gzip ceiling | Initial-transfer ceiling |
| ------- | ----------------------: | -----------------------: |
| Member  |                  350 kB |                   400 kB |
| Admin   |                  375 kB |                   425 kB |

These are hard cutover ceilings. RM-630 records final sizes and must explain any
proposed change rather than silently raising a limit.

## Accepted architecture decisions

| ID    | Decision                                                                  |
| ----- | ------------------------------------------------------------------------- |
| AD-01 | Keep Vite and use client-side React; no server framework.                 |
| AD-02 | Preserve separate member and admin HTML entries.                          |
| AD-03 | Preserve hash routes and existing URLs for GitHub Pages.                  |
| AD-04 | Use stable React/MUI/Redux versions compatible with Node 24 LTS.          |
| AD-05 | Use Redux for shared serializable data/statuses, not every interaction.   |
| AD-06 | Do not use RTK Query for Firestore realtime subscriptions.                |
| AD-07 | Keep every Firebase import inside `src/data/`.                            |
| AD-08 | Use MUI Emotion with an RTL cache/plugin, including portals.              |
| AD-09 | Retain specialized CSS for Quran type, scale, safe areas, and icon masks. |
| AD-10 | Use Node 24 LTS rather than Node Current.                                 |
| AD-11 | Migrate member, then admin, then remove legacy UI/Tailwind.               |
| AD-12 | Enforce separate member/admin budgets with a non-deployable React spike.  |

## Target dependency direction

```text
React UI -> Redux/selectors -> data subscription/write adapters -> Firestore
React UI -> pure domain functions
domain -X-> React, Redux, data, or Firebase
```

Target areas:

```text
src/
├── app/          providers, routing, store, subscription lifecycle
├── components/   shared React/MUI components
├── features/     member, admin, and reader routes/components
├── content/      retained content and Quran data
├── data/         retained Firebase boundary
├── domain/       retained pure business logic
└── theme/        MUI theme plus retained specialized CSS/fonts
```

Redux owns roster, khatmas, assignments, global content, listener statuses, and
only genuinely shared operation state. Local React state owns form drafts,
validation, route-local interactions, reader navigation, dialogs, and transient
feedback. Browser persistence owns member identity, reading scale, last page,
and per-khatma du3a acknowledgement.

Never place Firestore SDK objects, snapshots, unsubscribe functions, DOM nodes,
MUI instances, or cheaply derived values in Redux.

## Git and execution mode

- `main` remains the stable pre-migration branch.
- `reactmigration` is the long-lived integration branch.
- Default mode is sequential single-writer in the one shared working tree.
- Prefer one task or tightly related task group per commit, prefixed by task ID.
- Do not edit files owned by another in-progress task.
- A dirty tree may return to the same agent, but never crosses from Codex to
  Claude or vice versa.
- Cross-agent handoff requires a clean commit on `reactmigration` and an exact
  handoff hash.
- Never force-push shared migration branches or merge to `main` without explicit
  owner approval.

True parallel work is opt-in only and requires separate worktrees/clones,
`reactmig-<task>-<agent>` branches, and one integration committer. Never run two
writers in the same working tree.

Natural ownership lanes remain:

| Area                               | Primary                     |
| ---------------------------------- | --------------------------- |
| Runtime/platform and member/reader | Codex                       |
| Theme/shared UI and admin          | Claude                      |
| Entry cutover, QA, review, docs    | Joint, one writer at a time |

## Context-efficient task protocol

At session start:

1. Read [`NOW.md`](NOW.md).
2. Read only the named `tasks/RM-xxx.md` record.
3. Confirm dependencies/status in the relevant phase of
   [`TRACKER.md`](TRACKER.md).
4. Inspect branch/status and the exact handoff commit.
5. Read only reference sections named by the task record.
6. Claim the task in the tracker, update its task record, rewrite `NOW.md`, and
   run the smallest useful baseline check before broad changes.

At completion:

1. Run the task's required checks.
2. Put detailed outcome, changed areas, decisions/risks, and verification in the
   task record.
3. Set the tracker row to `DONE` with only concise evidence.
4. Rewrite `NOW.md` with the completed commit, next task, watch-outs, and exact
   read set.
5. Commit the tracker/task/NOW updates with the implementation before handing to
   the other agent.

Do not append chronological session entries. Git is the historical source of
truth. The archive is opt-in investigative context.

### Handoff block

```text
HANDOFF — <from-agent> ▸ <to-agent>

Completed: <task ID> → DONE
Verification: <commands and results>

Git state:
- branch: reactmigration
- HEAD: <short hash> "<subject>"
- pushed: <yes/no>
- working tree: clean

Read set for the next session:
1. docs/react-migration/NOW.md
2. docs/react-migration/tasks/<next-task>.md
3. the named TRACKER phase and exact reference sections from the task record

Next task: <ID and one-line reason>
Watch-outs: <short list or none>
```

## Verification matrix

| Change type                   | Scoped checks                                                 | Required before integration       |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------- |
| Node/dependencies/config      | Clean install, typecheck, lint, tests, build                  | Full baseline suite               |
| Redux/selectors               | Unit tests, typecheck, lint                                   | Full test suite                   |
| Firestore subscription bridge | Lifecycle/error/Strict Mode tests                             | Emulator realtime smoke           |
| Shared MUI/theme              | Component tests, RTL/portal, responsive visual check          | Member/admin smoke                |
| Member feature                | Feature and affected domain tests                             | Member parity checklist           |
| Admin feature                 | Feature and affected domain tests                             | Admin parity checklist            |
| Reader                        | Navigation, persistence, reader tests                         | Mobile manual reader pass         |
| Cutover/removal               | Typecheck, lint, all tests, build                             | Emulator and bundle pass          |
| Documentation only            | Link/path review, formatter if applicable, `git diff --check` | No full suite unless code changed |

## Active risks

| Risk                                             | Mitigation / owner                                                |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Reader page or scroll resets after Redux updates | Narrow selectors, stable keys, local state, RM-440 tests.         |
| Duplicate Firestore listeners                    | Central lifecycle and cleanup tests; RM-240 `DONE`.               |
| Admin drafts overwritten by snapshots            | Pristine/touched local drafts and RM-550 tests.                   |
| MUI RTL defects in portals/icons                 | RTL cache, logical properties, RM-650 QA.                         |
| Bundle growth on older phones                    | Budget gate, lazy routes, direct imports, RM-630.                 |
| Tailwind/MUI transition conflicts                | Isolated previews; remove Tailwind only at RM-620.                |
| Firebase tooling dev advisories                  | Production audit clean; monitor rather than force breaking fixes. |
| Two agents edit the shared tree                  | Sequential single-writer and committed handoffs.                  |
| Accidental domain/data behavior change           | Preserve boundaries; record separate defect tasks.                |
| `main` advances during migration                 | Reconcile intentionally at RM-710.                                |
| Hidden admin URL remains unauthenticated         | Accepted existing risk; React is not a security change.           |

## Open and resolved owner decisions

| ID    | Decision                                                        | Needed by             | Status                                  |
| ----- | --------------------------------------------------------------- | --------------------- | --------------------------------------- |
| OD-01 | Dev-only React preview entries, excluded from production inputs | RM-200                | RESOLVED                                |
| OD-02 | Member 350/400 kB and admin 375/425 kB budgets                  | RM-040/RM-630         | RESOLVED                                |
| OD-03 | Visual-parity tolerance versus intentional Material refresh     | RM-460                | RESOLVED — intentional refresh (RM-460) |
| OD-04 | Final merge method: merge commit, squash, or reviewed PR        | RM-740                | OPEN                                    |
| OD-05 | Sequential single-writer versus parallel worktrees              | Before implementation | RESOLVED — sequential default           |
| OD-06 | Shared-tree commits versus per-task branches                    | Before implementation | RESOLVED — shared `reactmigration` tree |

## Merge-readiness gates

Every item must pass before RM-740:

- [ ] Member and admin parity reviews are complete.
- [ ] Existing domain/data and new React tests are green.
- [ ] Clean install, typecheck, lint, tests, build, and CI pass on Node 24 LTS.
- [ ] Firestore listeners start once, surface errors, and clean up.
- [ ] Remote changes update open clients without refresh.
- [ ] Reader page and scroll state survive unrelated realtime updates.
- [ ] Admin form drafts survive unrelated realtime updates.
- [ ] Mobile/desktop RTL, accessibility, senior sizing, and portals pass.
- [ ] Final bundle sizes are measured and accepted.
- [ ] No unintended schema, rule, or domain behavior change exists.
- [ ] Legacy DOM UI and Tailwind are removed or an exception is approved.
- [ ] Final setup, architecture, contributor, and progress docs are accurate.
- [ ] `main` received no partial migration work.
- [ ] Rollback plan is credible.
- [ ] The project owner explicitly approves the merge.

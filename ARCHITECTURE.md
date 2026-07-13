# Architecture

How the Quran Khatma Tracker is organized, and the conventions that keep it easy
for a future collaborator to pick up. This reflects the design mandated by
[REQUIREMENTS.md](REQUIREMENTS.md) §3.

## Overview

- A **static, framework-free** TypeScript app built by Vite into two HTML
  entries (member + admin) that share all code under `src/`.
- The browser talks **directly to Firestore** (client SDK). There is no server
  and no Cloud Functions — the admin's browser runs all privileged logic.
- Code is split into **layers with a strict, one-directional dependency rule**,
  enforced by ESLint so the boundaries can't quietly erode.

> **React migration in progress (`reactmigration` branch).** A React + MUI +
> Redux Toolkit foundation now coexists with the framework-free app under a new
> [`src/app/`](src/app/) layer, but **production still ships the legacy
> two-entry app described below** — the React roots are branch-only Vite dev
> previews, not yet a production entry. The `data`, `domain`, `content`, and
> `theme` layers below are shared unchanged. See
> [§React Migration Architecture](#react-migration-architecture-branch-only) for
> the implemented React/state boundaries and
> [REACT_MIGRATION_PLAN.md](REACT_MIGRATION_PLAN.md) for phase-by-phase progress.

## Layers

```
        content/  ── strings + Quran text (no logic)
           │
theme/     │        ui/  ── rendering + event wiring (no business logic)
  │        │         │  │
  │        ▼         ▼  ▼
  └──▶  domain/ ◀── data/  ── Firestore reads/writes (the ONLY Firebase importer)
        (pure)
```

| Layer           | Path           | Responsibility                                                        | May import                           |
| --------------- | -------------- | --------------------------------------------------------------------- | ------------------------------------ |
| **Data-access** | `src/data/`    | Every Firestore read/write, as typed functions + realtime subscribers | `firebase/*`, `domain` types         |
| **Domain**      | `src/domain/`  | Pure logic: distribution algorithm, progress math, types              | nothing (must stay pure)             |
| **Content**     | `src/content/` | All Arabic UI strings + the bundled Quran dataset                     | (data only)                          |
| **Theme**       | `src/theme/`   | Design tokens (CSS) + the reading-scale helper                        | —                                    |
| **UI**          | `src/ui/`      | Build DOM, wire events, call `data` + `domain`                        | `data`, `domain`, `content`, `theme` |

### Enforced boundaries (guardrails)

These are real ESLint rules in [`eslint.config.js`](eslint.config.js), not just
conventions — `npm run lint` fails if they're broken:

1. **Firebase is importable only inside `src/data/`.** Every other layer must go
   through the typed data-access functions. This keeps Firestore details in one
   place and makes the rest of the app testable without a database.
2. **The domain layer must stay pure** — it cannot import `firebase`, `data`, or
   `ui`. This guarantees the assignment algorithm and calculations are unit-
   testable in isolation and free of side effects.

---

## Directory Map

```
src/
├── data/          firebase.ts (init), roster.ts, khatmas.ts, assignments.ts, distribution.ts
├── domain/        types.ts, distribution.ts, series.ts, progress.ts, assignment.ts, rotation.ts
├── content/       strings.ar.ts, quran/
├── theme/         theme.css, reading.ts
└── ui/
    ├── shared/    router.ts, nav.ts, components.ts, charts.ts, icons.ts
    ├── member/    render.ts, pages/khatmas.ts, reader.ts
    └── admin/     render.ts, ctx.ts, routes.ts, nav.ts, pages/{home,khatma,khatmas,roster,settings}.ts
```

> On the `reactmigration` branch this tree also carries the React foundation:
> `src/theme/` additionally holds the MUI theme (`muiTheme.ts`, `rtlCache.ts`,
> `globalStyles.ts`), and a new top-level `src/app/` layer holds all React
> composition. See [§React Migration Architecture](#react-migration-architecture-branch-only).

---

## Firestore Data Model

Collections and their document shapes (typed in [`src/domain/types.ts`](src/domain/types.ts)):

### 1. `roster/{personId}` (Person)

Represents a global reader in the community roster.

- `name`: string (unique)
- `completedPages`: number[] (deduplicated pages read over lifetime; consulted by distribution to prefer new coverage)
- `pagesPerDay`: number (capacity check per round)
- `enabled`: boolean (active/paused flag)
- `createdAt`: number (epoch ms)

### 2. `khatmas/{khatmaId}` (Khatma)

Represents a single open-ended, numbered group reading session.

- `seriesId`: string (stable identifier across series)
- `seriesName`: string (e.g. "أهل القرآن")
- `seriesNumber`: number (e.g., 1, 2, 3...)
- `totalPages`: number
- `scope`: PageScope (`{ kind: 'full' | 'range' | 'chapters', ... }`)
- `memberIds`: string[] (list of participants)
- `status`: 'active' | 'completed'
- `remainingPages`: number[] (pool of pages not yet assigned, sorted ascending)
- `roundCount`: number (number of distribution rounds triggered)
- `lastDistributionDate`: optional string (ISO YYYY-MM-DD)
- `duaReciterId`: optional string (assigned du3a reader)
- `completedAt`: optional number (epoch ms)
- `createdAt`: number (epoch ms)

### 3. `khatmas/{khatmaId}/assignments/{memberId}` (Assignment)

Represents a member's reading assignment history for a specific khatma.

- `memberId`: string
- `rounds`: RoundChunk[]
- `doneByRound`: Record<number, number> (round number -> completedAt epoch ms)
- `missedStreak`: number (consecutive missed rounds)

**`RoundChunk`**:

- `round`: number (round identifier)
- `date`: string (ISO YYYY-MM-DD)
- `pages`: number[] (pages assigned for this round)
- `released`: optional true (marks that pages were returned to the pool due to a miss)

---

## Key Subsystems

### 1. Distribution & Rollover Engine

The distribution logic is split into a pure planning phase and an atomic transaction phase:

- **Pure Plan** (`planDistribution`):
  1. Settles prior rounds. Pending chunks stay with their reader, block a new assignment, and increment `missedStreak`; only an explicit admin release returns them to the sorted pool. Done chunks clear the streak.
  2. Orders active roster members with clean members before flagged members, while rotating first-choice priority by `seriesNumber` on each khatma cycle.
  3. Serves from the oldest active khatma pool, preferring pages each member has not completed before. Loose pages and whole juz use lifetime coverage; a specifically configured surah remains explicit admin intent.
  4. If a pool drains, it triggers rollover: khatma N is sealed and N+1 is spawned. A chunk never spans khatmas; the boundary member receives a short chunk from N and the next member starts N+1.
- **Database Transaction** (`runDistribution`):
  Performs a single Firestore transaction for one selected khatma: reads it and its assignments, checks the same-day idempotency guard, executes `planDistribution`, and applies updates atomically (writing N+1 and its initial assignments if rollover is triggered). Redistribution uses the same transaction but first recalls only the stored `loosePages` portion of pending chunks; unit allocations remain held.

### 2. Admin routed SPA

The admin dashboard is structured as a single-page app utilizing hash-based routing (`#/home`, `#/roster`, etc.).

- **Router** (`createRouter`): general hash-routing framework shared with the member app.
- **Routed Pages** (`src/ui/admin/pages/`): Modules render specific screens and dispatch transactional writes directly to Firestore.

### 3. Icon Override System

Supports zero-code custom iconography for low-friction customization:

- `resolveIconOverrides()` probes the static assets folder at startup via lightweight `HEAD` requests checking for `public/icons/{name}.png`.
- If a PNG is found, it overrides the default SVG asset.
- Mask styles are written using `currentColor` so both SVGs and transparent PNGs automatically inherit active theme styling (primary/secondary highlight tints).

### 4. Custom SVG Charts

Charts are hand-rolled using simple, theme-aware SVGs to maintain a zero-dependency build setup:

- **Donut Chart** (`donutChart`): Draws two SVG circles. The foreground circle uses `stroke-dasharray` and `stroke-dashoffset` to represent completion percentage.
- **Segmented Bar** (`segmentBar`): Builds a single flexbox container containing block divs colored with CSS theme variables to show Done vs. Pending vs. Remaining pages.

---

## React Migration Architecture (branch-only)

The `reactmigration` branch is migrating the member and admin UIs from the
framework-free DOM code above to **React + Material UI (MUI) + Redux Toolkit**.
This section records the boundaries that are already implemented and verified
(Phase 2 foundation, task RM-260). It documents the target shape; it does **not**
change what production ships.

**Status — what is and isn't live:**

- **Production is unchanged.** `npm run build` still emits only the two legacy
  entries (`index.html`, `admin-nano.html`) rendered by the framework-free
  `src/ui/` code. The sections above remain the accurate description of the
  deployed app.
- **React is a branch-only preview.** The React roots mount from
  `react-preview.html` / `admin-react-preview.html`, which Vite serves during
  development only. They are deliberately absent from the production build inputs
  (see `entryFiles` in [`vite.config.ts`](vite.config.ts)), so the build cannot
  publish them until the Phase 6 cutover.
- The full plan, task tracker, and phase gates live in
  [REACT_MIGRATION_PLAN.md](REACT_MIGRATION_PLAN.md); accepted decisions are its
  Accepted Architecture Decisions table (AD-01…AD-11).

### The `src/app/` layer

All React composition lives under a new `src/app/` layer. The shared
`data`, `domain`, `content`, and `theme` layers are reused as-is.

```
src/app/
├── entries/       member.tsx, admin.tsx        dev-only preview mounts
├── bootstrap.tsx  createRoot(#app) inside <StrictMode>
├── member/        MemberApp.tsx                member root (composition)
├── admin/         AdminApp.tsx                 admin root (composition)
├── providers/
│   ├── AppStoreProvider.tsx   Redux <Provider> + owns global subscriptions
│   └── AppThemeProvider.tsx   RTL Emotion cache → MUI theme → CssBaseline
├── routing/       routes.ts (contract), AppHashRouter.tsx, hooks.ts, RouteLink.tsx
├── store/         store.ts, slices, selectors, hooks, Firestore→Redux bridge
└── operations/    writeOperations.ts (adapter), useWriteOperation.ts, provider
```

### Dependency direction (unchanged boundary)

React slots **above** the existing layers; the one-directional rule is preserved.

```text
React UI (src/app/**)
  ├──▶ Redux store / selectors ──▶ data subscription + write adapters ──▶ Firestore
  └──▶ domain pure functions
domain ─X─▶ React, Redux, data, or Firebase   (still pure)
```

**Firebase stays confined to `src/data/`.** `src/app/` never imports
`firebase/*`; it reaches Firestore only through the typed `src/data/` functions
(subscribers for reads, mutation functions for writes). This is the _same_
ESLint guardrail described under [Enforced boundaries](#enforced-boundaries-guardrails) —
`src/app/` is covered by Guardrail 1 exactly like `src/ui/`, so `npm run lint`
fails if a React module imports Firebase directly.

### App composition & providers

Each root composes the same provider stack, then renders its routed screen:

```text
<AppStoreProvider>      Redux store + Firestore subscription bridge (context)
  <AppThemeProvider>    RTL Emotion cache → ThemeProvider → CssBaseline → GlobalStyles
    <AppHashRouter>     React Router HashRouter over the shared route contract
      <screen/>
```

- **`bootstrap.tsx`** mounts the root into `#app` inside `<StrictMode>`, so every
  subscription and effect is deliberately double-invoked in development to prove
  cleanup is correct.
- **`AppThemeProvider`** creates the `stylis-plugin-rtl` Emotion cache once at
  module scope (caches are reusable singletons) and forces `dir="rtl"` /
  `lang="ar"` on `<html>`. Portalled components (Select, Dialog) inherit RTL
  because the cache wraps the whole tree.

### Redux store & state ownership

The store (`createAppStore`) holds four slices, all **serializable**:

| Slice         | Shape                                          | Notes                                                             |
| ------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `roster`      | `createEntityAdapter<Person>` + listener       | normalized, Firestore order preserved                             |
| `khatmas`     | `createEntityAdapter<Khatma>` + listener       | normalized                                                        |
| `assignments` | `{ byKhatmaId: Record<id, adapter+listener> }` | one independent entity collection per khatma, keyed by `memberId` |
| `content`     | `{ value: GlobalContent \| null, listener }`   | nullable global content                                           |

- **Listener state** is shared (`listenerState.ts`): every Firestore-backed slice
  carries `{ status: 'idle' | 'loading' | 'ready' | 'error', error: string | null }`.
  Only human-readable strings enter Redux — never `Error` or Firestore objects.
- **Typed access** is through `useAppDispatch` / `useAppSelector` / `useAppStore`
  (`store/hooks.ts`) and memoized selectors (`store/selectors.ts`); components do
  not read `state.*` shapes directly.

State ownership follows the plan's model:

| Concern                                                                      | Home                    |
| ---------------------------------------------------------------------------- | ----------------------- |
| Roster, khatmas, assignments, global content, and their listener status      | **Redux**               |
| Form drafts, open dialogs/menus/tabs, reader navigation, per-button pending  | **Local React state**   |
| Remembered member, reading scale, last-read page, du3a acknowledgement       | **Browser persistence** |
| Snapshots, refs, unsubscribe fns, `Error` objects, DOM nodes, derived values | **Never in Redux**      |

### Firestore → Redux subscription bridge

`createFirestoreSubscriptionBridge(store, sources)` (`store/firestoreSubscriptionBridge.ts`)
connects the `src/data/` callback subscriptions to store dispatches. It is the
single owner of listener lifecycle for React:

- **Reference-counted.** The three global listeners (roster, content, khatmas)
  share one consumer count opened by `AppStoreProvider`; assignments are counted
  **independently per khatma** and retained on demand via
  `useAssignmentsSubscription(khatmaId)`. A listener starts on the first consumer
  and closes only when the last releases.
- **Strict-Mode / Fast-Refresh safe.** Release functions are idempotent, and
  callbacks arriving after cleanup are ignored, so double-invoked effects and HMR
  cycles never leak or duplicate a Firestore listener (Risk Register: duplicate
  listeners → mitigated here).
- **Injectable sources.** Production wires the real `subscribe*` functions
  (`store/firestoreSubscriptionSources.ts`); tests pass deterministic substitutes
  through the same `FirestoreSubscriptionSources` interface, so store behavior is
  testable without Firestore.
- **Errors are flattened** to plain strings before dispatch; a subscription that
  fails sets `listener.status = 'error'` with a message.

### Writes & operation feedback

- **`writeOperations`** (`operations/writeOperations.ts`) is a frozen adapter that
  re-exports all **16** existing `src/data/` mutations (roster, content, khatma,
  assignment, and distribution writes) to React. It adds **no** business logic —
  it is a typed surface over the data boundary.
- **`WriteOperationsProvider`** supplies the adapter via context and lets tests
  inject fakes without touching Firestore.
- **`useWriteOperation(name)`** selects one typed mutation and wraps it in
  `useOperation`, giving a local `idle → pending → success → failure` feedback
  contract with typed results, preserved `Error` subclasses (so route-specific
  copy like released-chunk / same-day-distribution messages survives), plus
  `execute` (retry is simply re-invoking it) and `reset`. Feedback is
  **latest-call-safe** (only the newest overlapping
  invocation updates visible state) and lives in **local component state, not
  Redux** — transient operation status is not shared serializable data.

### Routing

- **One shared route contract** (`routing/routes.ts`): discriminated-union
  `MemberRoute` / `AdminRoute` types with total, pure parsers and path/hash
  builders. Both the legacy app and the React app import these same functions, so
  the two surfaces cannot drift on URLs during the migration.
- React uses `AppHashRouter` (React Router `HashRouter`) with typed hooks
  (`useMemberRoute` / `useAdminRoute`) and typed links (`RouteLink`).
- All established hashes (`#/home`, `#/roster`, `#/khatma/:id`, `#/khatma/:id/read`,
  `#/quran/:page`, …) are preserved, and an unknown hash resolves to the surface's
  default **without rewriting history** — GitHub Pages has no SPA fallback (AD-03).

### Theme

The centralized MUI RTL theme lives in `src/theme/` (`muiTheme.ts`, `rtlCache.ts`,
`globalStyles.ts`) and maps the legacy design tokens onto MUI's `palette`,
`typography`, `shape`, `spacing`, and `breakpoints` with `direction: 'rtl'`.
Application-specific CSS (Quran typography, reading scale, safe areas, icon
masks) is retained rather than forced into MUI (AD-09). **Tailwind remains
enabled** in `vite.config.ts` until both entries have cut over to React; it is
removed in Phase 6 (RM-620) so the transition never runs with a half-removed
stylesheet layer.

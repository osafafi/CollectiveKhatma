# Architecture

How the Quran Khatma Tracker is organized, and the conventions that keep it easy
for a future collaborator to pick up. This reflects the design mandated by
[REQUIREMENTS.md](REQUIREMENTS.md) §3.

## Overview

- A **static React + TypeScript** app built by Vite into two HTML entries
  (member + hidden admin) that share code under `src/`.
- The browser talks **directly to Firestore** (client SDK). There is no server
  and no Cloud Functions — the admin's browser runs all privileged logic.
- Code is split into **layers with a strict, one-directional dependency rule**,
  enforced by ESLint so the boundaries can't quietly erode.

> Both production entries mount React. Migration cleanup and validation status
> lives in [the migration tracker](docs/react-migration/TRACKER.md).

## Layers

```
        content/  ── strings + Quran text (no logic)
           │
theme/     │        app/components ── React rendering + event wiring
  │        │         │  │
  │        ▼         ▼  ▼
  └──▶  domain/ ◀── data/  ── Firestore reads/writes (the ONLY Firebase importer)
        (pure)
```

| Layer           | Path              | Responsibility                                                        | May import                           |
| --------------- | ----------------- | --------------------------------------------------------------------- | ------------------------------------ |
| **Data-access** | `src/data/`       | Every Firestore read/write, as typed functions + realtime subscribers | `firebase/*`, `domain` types         |
| **Domain**      | `src/domain/`     | Pure logic: distribution algorithm, progress math, types              | nothing (must stay pure)             |
| **Content**     | `src/content/`    | All Arabic UI strings + the bundled Quran dataset                     | (data only)                          |
| **Theme**       | `src/theme/`      | MUI/RTL theme, retained global styles, reading scale                  | MUI, React types                     |
| **Application** | `src/app/`        | Entries, routing, Redux, operations, member/admin features            | `data`, `domain`, `content`, `theme` |
| **Components**  | `src/components/` | Reusable React UI primitives, navigation, charts, feedback            | `content`, `theme`                   |

### Enforced boundaries (guardrails)

These are real ESLint rules in [`eslint.config.js`](eslint.config.js), not just
conventions — `npm run lint` fails if they're broken:

1. **Firebase is importable only inside `src/data/`.** Every other layer must go
   through the typed data-access functions. This keeps Firestore details in one
   place and makes the rest of the app testable without a database.
2. **The domain layer must stay pure** — it cannot import Firebase, data access,
   application, component, or theme code. This keeps calculations isolated and
   free of side effects.

---

## Directory Map

```
src/
├── app/           entries, providers, routing, store, operations, persistence, member/, admin/
├── components/    primitives, navigation, charts, icons, feedback
├── data/          firebase.ts, roster.ts, khatmas.ts, assignments.ts, distribution.ts, content.ts
├── domain/        types.ts, distribution.ts, series.ts, progress.ts, assignment.ts, rotation.ts, validation.ts
├── content/       strings.ar.ts, quran/
└── theme/         muiTheme.ts, rtlCache.ts, globalStyles.ts, reading.ts, fonts/
```

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
- `capacities`: optional Record<memberId, `{ pages, surahs, juz }`> (per-member ADDITIVE per-round capacity; absent ⇒ the member's roster `pagesPerDay`. Copied forward at rollover)
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
- `loosePages`: optional number[] (the subset of `pages` from loose-page capacity; the only portion a same-day redistribution recalls — whole surahs/ajzā' stay held)
- `redistributedPages`: optional number[] (loose pages recalled by a later redistribution, retained as audit history)
- `released`: optional true (marks that pages were returned to the pool due to a miss)

### 4. `content/global` (GlobalContent)

The single admin-editable content document.

- `du3aText`: string (du3a2 al-khatma shown on completion — REQUIREMENTS §7)

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

- **Router** (`src/app/routing/`): typed React Router hash contracts shared with
  the member app.
- **Routed Pages** (`src/app/admin/pages/`): React screens dispatch writes through
  typed operation adapters and read normalized Redux state.

### 3. Icon Override System

Supports zero-code custom iconography for low-friction customization:

- `resolveIconOverrides()` probes the static assets folder at startup via lightweight `HEAD` requests checking for `public/icons/{name}.png`.
- If a PNG is found, it overrides the default SVG asset.
- Mask styles are written using `currentColor` so both SVGs and transparent PNGs automatically inherit active theme styling (primary/secondary highlight tints).

### 4. Custom SVG Charts

Charts are hand-rolled using simple, theme-aware SVGs:

- **Donut Chart** (`DonutChart`): draws two SVG circles and a centered percentage.
- **Segmented Bar** (`SegmentBar`): renders proportional MUI-themed segments
  with a text legend.

---

## React Application Architecture

The member and admin UIs use **React + Material UI (MUI) + Redux Toolkit**. Both
production entries mount this application architecture.

- `npm run build` emits the member `index.html` and hidden `admin-nano.html`
  inputs, both backed by React entries.
- `react-preview.html` and `admin-react-preview.html` are development-only
  aliases excluded from deployable build inputs.
- Stable migration governance, phase gates, and accepted decisions live in
  [the compact migration plan](docs/react-migration/PLAN.md) (AD-01…AD-12), while
  current task status lives in [the tracker](docs/react-migration/TRACKER.md).

### The `src/app/` layer

All React composition lives under a new `src/app/` layer. The shared
`data`, `domain`, `content`, and `theme` layers are reused as-is.

```
src/app/
├── entries/       member.tsx, admin.tsx        production mounts
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
`src/app/` is covered by Guardrail 1, so `npm run lint`
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
`globalStyles.ts`) and defines the app's `palette`, `typography`, `shape`,
`spacing`, and `breakpoints` with `direction: 'rtl'`. Application-specific CSS
(Quran typography, reading scale, safe areas, icon masks) remains in
`globalStyles.ts` rather than being forced into component overrides (AD-09).

---

## Security

**There is no authentication in this app** — this is a deliberate, accepted
trade-off for a trusted community of senior users (REQUIREMENTS §3, §4, §8).
Understand exactly what that means:

- The Firebase web config ships in the **public client bundle**. It is not a
  secret and cannot be hidden.
- Firestore security rules ([`firestore.rules`](firestore.rules)) can therefore
  only **validate document shape and reject unknown paths** — they are **not an
  identity boundary**. Anyone who finds the config could write to the database.
- The admin app is protected only by an **unguessable URL** (`admin-nano.html`),
  never linked from the member app. This is obscurity, not access control.
- Member identity is a **trust-based** localStorage cache (`useRememberedMemberId`
  in [`src/app/persistence/browserPersistence.ts`](src/app/persistence/browserPersistence.ts));
  anyone could tap a wrong name, and the admin can correct mistaken marks.

Do not add features that assume these rules protect data by identity. If real
protection is ever needed, it requires introducing authentication (out of scope
for v1) and rewriting the rules around it.

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

---

## Firestore Data Model

Collections and their document shapes (typed in [`src/domain/types.ts`](src/domain/types.ts)):

### 1. `roster/{personId}` (Person)
Represents a global reader in the community roster.
* `name`: string (unique)
* `completedPages`: number[] (deduplicated pages read over lifetime)
* `pagesPerDay`: number (capacity check per round)
* `enabled`: boolean (active/paused flag)
* `createdAt`: number (epoch ms)

### 2. `khatmas/{khatmaId}` (Khatma)
Represents a single open-ended, numbered group reading session.
* `seriesId`: string (stable identifier across series)
* `seriesName`: string (e.g. "أهل القرآن")
* `seriesNumber`: number (e.g., 1, 2, 3...)
* `totalPages`: number
* `scope`: PageScope (`{ kind: 'full' | 'range' | 'chapters', ... }`)
* `memberIds`: string[] (list of participants)
* `anonymous`: boolean
* `status`: 'active' | 'completed'
* `remainingPages`: number[] (pool of pages not yet assigned, sorted ascending)
* `roundCount`: number (number of distribution rounds triggered)
* `lastDistributionDate`: optional string (ISO YYYY-MM-DD)
* `duaReciterId`: optional string (assigned du3a reader)
* `completedAt`: optional number (epoch ms)
* `createdAt`: number (epoch ms)

### 3. `khatmas/{khatmaId}/assignments/{memberId}` (Assignment)
Represents a member's reading assignment history for a specific khatma.
* `memberId`: string
* `rounds`: RoundChunk[]
* `doneByRound`: Record<number, number> (round number -> completedAt epoch ms)
* `missedStreak`: number (consecutive missed rounds)

**`RoundChunk`**:
* `round`: number (round identifier)
* `date`: string (ISO YYYY-MM-DD)
* `pages`: number[] (pages assigned for this round)
* `released`: optional true (marks that pages were returned to the pool due to a miss)

---

## Key Subsystems

### 1. Distribution & Rollover Engine
The distribution logic is split into a pure planning phase and an atomic transaction phase:
* **Pure Plan** (`planDistribution`):
  1. Settles prior rounds. Pending chunks are flagged as `released` and their pages return to the khatma's `remainingPages` pool (merged and sorted). The member's `missedStreak` increments. Done chunks clear the streak.
  2. Orders active roster members: clean members first (preserving roster order), then flagged members.
  3. Serves pages from the front of the oldest active khatma pool.
  4. If a pool drains, it triggers a rollover: the oldest khatma (N) is sealed, and a new khatma (N+1) is spawned. Boundary members receive partial pages from N and the rest from N+1 (split across two chunks).
* **Database Transaction** (`runDistribution`):
  Performs a single Firestore transaction: reads active khatmas and assignments, checks same-day idempotency guards, executes `planDistribution`, and applies updates atomically (writing N+1 and its initial assignments if rollover is triggered).

### 2. Admin routed SPA
The admin dashboard is structured as a single-page app utilizing hash-based routing (`#/home`, `#/roster`, etc.).
* **Router** (`createRouter`): general hash-routing framework shared with the member app.
* **Routed Pages** (`src/ui/admin/pages/`): Modules render specific screens and dispatch transactional writes directly to Firestore.

### 3. Icon Override System
Supports zero-code custom iconography for low-friction customization:
* `resolveIconOverrides()` probes the static assets folder at startup via lightweight `HEAD` requests checking for `public/icons/{name}.png`.
* If a PNG is found, it overrides the default SVG asset.
* Mask styles are written using `currentColor` so both SVGs and transparent PNGs automatically inherit active theme styling (primary/secondary highlight tints).

### 4. Custom SVG Charts
Charts are hand-rolled using simple, theme-aware SVGs to maintain a zero-dependency build setup:
* **Donut Chart** (`donutChart`): Draws two SVG circles. The foreground circle uses `stroke-dasharray` and `stroke-dashoffset` to represent completion percentage.
* **Segmented Bar** (`segmentBar`): Builds a single flexbox container containing block divs colored with CSS theme variables to show Done vs. Pending vs. Remaining pages.

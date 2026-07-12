# CLAUDE.md

## Repository Instruction Source

`CLAUDE.md` is the single source of repository instructions for ALL coding agents.
Keep project guidance here and do not create or maintain a duplicate `AGENTS.md`.

## Reference Commands

### Build & Validate
* **Typecheck**: `npm run typecheck`
* **Lint**: `npm run lint`
* **Test**: `npm test` (uses Vitest)
* **Build**: `npm run build`

### Local Emulator Flow
1. Start Emulators: `npm run emulators`
2. Seed Data: `npm run seed` (targets emulator only)
3. Start Dev Server: `npm run dev` (opens http://localhost:5173, admin panel is at `admin-nano.html`)

---

## Architecture Rules & Layers

Strict one-directional dependency rule enforced by ESLint:
* **`src/data/`**: The ONLY layer that can import `firebase/*` or `firebase/firestore`. Communicates with Firestore.
* **`src/domain/`**: Pure business logic (calculators, types, algorithms). MUST stay pure (no imports from `firebase`, `data`, or `ui`).
* **`src/content/`**: Raw Quran text/metadata, static surah maps, and Arabic strings ([strings.ar.ts](src/content/strings.ar.ts)). No business logic.
* **`src/theme/`**: CSS styling system and reading scale configuration.
* **`src/ui/`**: Builds DOM, handles events, and bridges UI to `data` and `domain`.

---

## File Map

```
src/
├── data/             firebase.ts (init), roster.ts, khatmas.ts, assignments.ts, distribution.ts
├── domain/           types.ts, distribution.ts, series.ts, progress.ts, assignment.ts, rotation.ts
├── content/          strings.ar.ts, quran/
├── theme/            theme.css, reading.ts
└── ui/
    ├── shared/       router.ts, nav.ts, components.ts, charts.ts, icons.ts
    ├── member/       render.ts, pages/khatmas.ts, reader.ts
    └── admin/        render.ts, ctx.ts, routes.ts, nav.ts, pages/{home,khatma,khatmas,roster,settings}.ts
```

---

## Firestore Schema & Invariants

### 1. `khatmas/{khatmaId}` (Khatma)
* `seriesId`: string (stable across the series)
* `seriesName`: string (e.g. "أهل القرآن")
* `seriesNumber`: number (sequential: 1, 2, 3...)
* `totalPages`: number
* `scope`: PageScope (`{ kind: 'full' | 'range' | 'chapters', ... }`)
* `memberIds`: string[]
* `capacities`: optional Record<memberId, `{ pages, surahs, juz }`> (per-member ADDITIVE per-round capacity — `surahs` is a specific surah id, 0=none; absent ⇒ roster `pagesPerDay` pages)
* `anonymous`: boolean
* `status`: 'active' | 'completed'
* `remainingPages`: number[] (pages not yet in any live chunk, ascending)
* `roundCount`: number (rounds run against this khatma)
* `lastDistributionDate`: optional string (ISO date YYYY-MM-DD)
* `duaReciterId`: optional string
* `completedAt`: optional number (epoch ms)
* `createdAt`: number (epoch ms)

### 2. `khatmas/{khatmaId}/assignments/{memberId}` (Assignment)
* `memberId`: string
* `rounds`: RoundChunk[]
* `doneByRound`: Record<number, number> (round number -> completedAt epoch ms)
* `missedStreak`: number (consecutive missed rounds)

### 3. `RoundChunk` (Nested in Assignment.rounds)
* `round`: number
* `date`: string (ISO date)
* `pages`: number[]
* `released`: optional true (missed chunk pages returned to pool)

### Verbatim Invariants
1. Every scope page is in exactly one of: a non-released chunk, or `remainingPages`.
2. Only a member's last chunk with `pages.length > 0` may be pending. Distribution does NOT auto-release it — an unread member is skipped; pages return to the pool only via the admin's manual `releaseMemberChunk` (or `removeMemberFromKhatma`).
3. `remainingPages` is always ascending. Coverage-aware distribution may select from anywhere in the pool; released pages merge back sorted.
4. `lastDistributionDate === today` ⇒ distribution for this series today is blocked.

---

## Distribution Algorithm (planDistribution)

1. **Settle previous round (no auto-reclaim)**: Per member, find the last non-empty chunk across all active khatmas. If **done**: reset `missedStreak` to 0 (member is *ready*). If **pending** (not done, not released): the member KEEPS the pages and is **skipped** this round, and `missedStreak + 1` (the ⚠ flag auto-escalates by rounds waited). No prior chunk / already released: *ready*, streak untouched.
2. **Order members**: Only *ready* members (enabled, not holding a pending chunk). Clean (`missedStreak === 0`) members come before flagged members; first-choice priority rotates by `seriesNumber`. Disabled members are skipped.
3. **Serve**: Each ready member takes their additive `MemberCapacity` — `pages` loose pages + the specific surah `surahs` (id; 0=none) + `juz` whole ajzā' (via `takeChunk` + `unitOfPage`) from the oldest pool. Loose pages and whole juz prefer pages absent from that member's lifetime `completedPages`, then fall back to previously covered pages. A specifically configured surah remains fixed admin intent. If the pool drains mid-round, **rollover** mints N+1 from `newKhatmaPool`. Chunks never span two khatmas.
4. **Completion check**: Any khatma with empty `remainingPages` and all its chunks either done or released becomes completed. A pending (held) chunk therefore blocks completion until it is done or the admin releases it.

Returning unread pages is a separate admin action: `releaseMemberChunk` marks the chunk `released`, merges its pages back (sorted), and resets the streak.

---

## Gotchas & Conventions
* **No Firestore Nested Arrays**: Saved round chunks are stored as `rounds: Array<{round, date, pages: number[], released?}>` which is standard flat array behavior (no nested arrays).
* **Per-member capacity is per-khatma**: stored in `Khatma.capacities` (additive pages+surahs+juz), not on the roster `Person` (whose `pagesPerDay` is only the fallback). Copied forward at rollover.
* **Manual page-return & N+1 while active**: the admin returns an unread member's pages (`releaseMemberChunk`) or removes a member (`removeMemberFromKhatma`, which returns their outstanding pages to the pool); and can create khatma N+1 in a series while N is still active (the engine already supports 1–2 active per series).
* **No Authentication**: Trust-based community model. Firestore rules validate document shape and paths only.
* **Hash Routing**: Uses client-side hash routing (`#/home`, `#/roster`, etc.) to run on GitHub Pages.
* **Base Asset URL**: Use `import.meta.env.BASE_URL` when building public URLs.
* **Icon Drop-in**: Drop `{name}.svg` or `{name}.png` in `public/icons/`. PNG automatically overrides SVG at runtime.

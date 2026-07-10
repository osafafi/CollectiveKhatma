# CLAUDE.md

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
2. Only a member's last chunk with `pages.length > 0` may be pending; distribution releases any pending previous chunk.
3. `remainingPages` is always ascending; distribution shifts from the front; releases merge back sorted (so released low pages are re-served first automatically — no priority queue needed).
4. `lastDistributionDate === today` ⇒ distribution for this series today is blocked.

---

## Distribution Algorithm (planDistribution)

1. **Settle previous round**: Per member, find the last non-empty chunk across all active khatmas in the series. If it is pending (not done, not released): release it (merge pages back into that khatma's `remainingPages` sorted), and set `missedStreak + 1`. If done: reset `missedStreak` to 0. If there is no prior chunk (new member) or it was already released: streak is untouched.
2. **Order members**: Clean members (`missedStreak === 0` after Step 1) first, in roster order; then flagged members. Disabled members are skipped entirely.
3. **Serve**: Shift `pagesPerDay` pages from the front of the oldest active khatma's pool. If the pool drains mid-round, trigger **rollover**: mint N+1 (seeded with full `newKhatmaPool`). Chunks never span two khatmas; the member at the boundary gets a short chunk from N, and subsequent members draw from N+1.
4. **Completion check**: Any khatma with empty `remainingPages` and all its chunks either marked done or released becomes completed.

---

## Gotchas & Conventions
* **No Firestore Nested Arrays**: Saved round chunks are stored as `rounds: Array<{round, date, pages: number[], released?}>` which is standard flat array behavior (no nested arrays).
* **No Authentication**: Trust-based community model. Firestore rules validate document shape and paths only.
* **Hash Routing**: Uses client-side hash routing (`#/home`, `#/roster`, etc.) to run on GitHub Pages.
* **Base Asset URL**: Use `import.meta.env.BASE_URL` when building public URLs.
* **Icon Drop-in**: Drop `{name}.svg` or `{name}.png` in `public/icons/`. PNG automatically overrides SVG at runtime.

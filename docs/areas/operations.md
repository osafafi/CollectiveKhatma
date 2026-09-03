# Operations brick

Owns: Firebase adapter, schema/rules, build, tests, emulator, deploy, CI.

Start files: `src/data/`, `firestore.rules`, `package.json`, `vite.config.ts`,
`.github/workflows/`.

Normal gate:

```text
npm run check
```

Focused test: `npm test -- tests/app/name.test.tsx`.
Bundle-sensitive change: `npm run check:bundle-budgets`.
Service-worker change: `npm run check:service-worker` after a build.

Firestore transaction/rule change: run domain tests, data callers, then the opt-in
emulator smoke with Firestore emulator running. Record if not run.

`npm run seed` writes only to the local Firestore emulator and skips roster or
khatma collections that already contain data. Roster and khatma names describe
their test intent in the Emulator UI. Its default dataset contains
`KhatmaRoundPreviewTest`, a planner-generated halfway state with late and pending
readers; `KhatmaRolloverTest`, settled immediately before rollover; and the
full-Quran `KhatmaRedistributionTest`, with completed, loose-page, accumulated
hold, mixed Surah/loose, disabled, and ready-without-pages cases. Every seeded
khatma covers pages 1–604; its remaining pool reflects the scenario state. Use
`npm run seed -- --dry-run` to build and summarize all scenarios without reading
or writing emulator data. Seeded assignment chunks include explicit lifecycle
status/run references, and matching `distributionRuns` records make revision,
completion, and current-run behavior inspectable in the Emulator UI.

Distribution schema: `distributionRuns/{runId}` records a confirmed series-wide
run with number, mode, open/closed status, revision, khatma ids, timestamps, and
optional rollover pair. Khatmas mirror `currentDistributionRunId` and
`distributionRevision`. New chunks carry `id`, `runId`, `status`, and lifecycle
timestamps; readers remain backward-compatible with legacy `released` and
`doneByRound` data.

Khatma create and update rules require full scope and 604 total pages. The data
adapter requires an ordinary new khatma to start with the exact 1–604 pool; an
atomic rollover may create N+1 with its first round already assigned, so its
persisted `remainingPages` is legitimately smaller at creation time. New UI and
rollover writes always create full-Quran khatmas.

Feedback schema: `content/feedback/messages/{feedbackId}` is append-only at
submission time. Each document stores `memberId`, `memberName`, `message`,
`isRead`, and numeric `createdAt`. Create rules require unread 10–500-character
messages; updates may change only `isRead`; deletes remove one message document.
The admin retains its listener on demand, so member clients do not subscribe to
the inbox.

Roster schema: `roster/{memberId}.holdPages` is an optional boolean for backward
compatibility with existing documents. New members start with `false`; member
and admin controls may update it, and completing assigned pages resets it.
Legacy roster documents without `completedPages` are normalized to an empty
array at the Firestore read boundary.

`npm run migrate:schema` performs a read-only production schema audit using the
web configuration in `.env` and reports counts without names or ids. Applying
safe additive defaults requires the explicit
`-- --apply --confirm=BACKFILL_SCHEMA` flags. Apply mode never deletes fields
and aborts before writing if it finds a partial/non-full khatma or an unsafe
roster page-history shape.

Hard rules:

- Only `src/data` imports Firebase.
- `firebase.ts` builds Firestore with `initializeFirestore`, not `getFirestore`,
  so it can set a local cache. `localCache.ts` picks the persistent IndexedDB
  cache when IndexedDB exists and the memory cache when it does not — Node (the
  emulator smoke test) and private-browsing modes, where forcing persistence
  stops the client from starting at all. The tab manager is the multi-tab one
  because member and admin share an origin and may be open together. This is
  what lets `onSnapshot` answer with no network; it costs ~21.9 kB gzip on both
  entries, which is why the bundle budgets moved in 2026-09.
- An empty persistent cache arrives as a **ready** empty snapshot, not as a
  pending one. Listener status alone therefore cannot tell "nothing is cached
  on this device" apart from "nothing exists"; UI that must distinguish them
  has to look at whether it has anything to show. Verified against the emulator
  with the backend stopped.
- Firestore rules validate path and shape. They do not prove identity.
- App is static. No server or Cloud Functions.
- Never touch live Firebase or deploy unless user gives explicit authority.
- Production has two entries: `index.html` and the hidden admin HTML.
- The member entry ships `manifest.webmanifest`, PNG icons for standard,
  maskable, Apple touch, and favicon use. All install asset URLs remain valid
  under Vite's configured base path.
- `vite-plugin-pwa` generates `dist/sw.js`, which precaches the member shell
  only: its HTML, manifest, hashed JS/CSS/fonts, and icons. The mushaf under
  `quran/` is not precached. The worker never calls `skipWaiting`, so a new
  build takes over the next time the app is opened fresh.
- The mushaf is cached at runtime rather than precached: the worker serves
  `quran/**.json` cache-first out of `quran-mushaf-v1`, and
  `src/app/member/install/mushafPrefetch.ts` sweeps the whole dataset in after
  first paint — 604 pages plus `surahs.json` and `index.json`, ~320 kB gzipped.
  The dataset is immutable, so nothing revalidates. Rewriting it with
  `npm run build:quran` means bumping `QURAN_CACHE_NAME` in
  `scripts/sw-routes.ts` and deleting the superseded cache by hand —
  `cleanupOutdatedCaches` prunes precaches, not this one.
  `npm run check:service-worker` fails the build if the route goes missing.
- The precache manifest is world-readable, so it must never name the hidden
  admin entry or the chunks only that entry reaches.
  `scripts/pwa-precache.ts` removes them from the graph in
  `dist/.vite/manifest.json`, and `npm run check:service-worker` fails the build
  if any reaches `sw.js`. `navigateFallback` is allowlisted to the base path
  alone so the admin entry keeps reaching the network and its name stays out of
  the worker.

Update this doc when commands, schema, rules, CI, entries, emulator, or deploy flow changes.

# Offline reading — progress plan

Branch: `feature/offline-reading`. Delete this file in the PR that lands the last
layer; `AGENTS.md` says plans do not live on `main`.

Goal: a member who loses connection mid-chunk keeps reading. Layers ship
independently and in order — each is a usable improvement on its own.

## Status

| Layer                         | State | Session |
| ----------------------------- | ----- | ------- |
| 1. Service worker + app shell | todo  | —       |
| 2. Quran text offline         | todo  | —       |
| 3. Assignment data offline    | todo  | —       |
| 4. "Finished" while offline   | todo  | —       |

Update the row (`todo` / `wip` / `done`) and the session date at the end of every
session, then commit. That table is the resume point.

## Measured facts

Established 2026-09-03 on `main` @ d44915e. Do not re-derive.

- Mushaf is text JSON, not images. 604 pages + `surahs.json` + `index.json` =
  **1.52 MB raw, ~320 KB gzipped**. (`du` says 2.7 MB — that is 4 KB block
  overhead across 604 tiny files, not payload.)
- Built shell `dist/assets` = 1.4 MB raw, incl. 164 KB of woff2
  (`AmiriQuran` 45 KB, `ScheherazadeNew` 118 KB).
- Member initial JS budget 367 KB gz, admin 373 KB gz, enforced in CI by
  `scripts/check-bundle-budgets.mjs`. It walks `dist/.vite/manifest.json` from
  the entry, so a service worker file is not counted against it.
- Vite **8.1.4 with rolldown**. `@vitejs/plugin-react` 6.
- Deploy: GitHub Pages, static, `BASE_PATH=/CollectiveKhatma/`.

## Why not localStorage

Asked and answered — it would fit (1.83 MB as UTF-16, under the ~5 MB origin
quota) but it does not solve the actual failure. Offline the browser cannot
fetch `index.html` or the bundle, so no JS runs and nothing ever reads
localStorage. A service worker is required for the app to boot at all; once it
exists the Cache API holds the same bytes asynchronously, with a disk-proportional
quota instead of 5 MB. Synchronous `getItem` + `JSON.parse` on ~2 MB would also
jank the reader on a mid-range phone.

## Layer 1 — Service worker + app shell

Prerequisite for every other layer. Precache hashed JS/CSS/fonts/icons so the
member app boots with no connection.

- [ ] Verify `vite-plugin-pwa` supports Vite 8 + rolldown. Its peer range has
      historically been `^6 || ^7`. **If it does not, hand-roll**: a ~100-line SW
      plus a small build step reading `dist/.vite/manifest.json`. Record the
      outcome here before writing code.
- [ ] Register the SW from the member entry only
      (`src/app/entries/member.tsx`).
- [ ] Update flow: new SW activates and the app prompts or silently takes over on
      next load. Do not leave members pinned to a stale bundle.
- [ ] Test: registration is skipped in dev/test so vitest and the emulator are
      unaffected.

**Security trap — do not miss.** There are two entries, and `admin-nano.html`'s
unguessable filename is the only gate on the admin panel
(`ARCHITECTURE.md#security`, `vite.config.ts` `ADMIN_ENTRY`). Any generated
precache manifest must **exclude the admin entry and its admin-only chunks**, or
the member app downloads a file that names the admin URL. Assert this in a test.

## Layer 2 — Quran text offline

- [ ] Cache-first for `quran/**`. The dataset is immutable and committed, so no
      revalidation — a versioned cache name means it downloads once, ever.
- [ ] Background prefetch of all 604 pages when idle, after first paint. Seed the
      member's assigned pages first so their own chunk is warm immediately.
- [ ] Decide: automatic, or behind a Settings toggle
      ("احفظ المصحف للقراءة بدون إنترنت"). Automatic is defensible at 320 KB gz.
- [ ] `src/content/quran/loader.ts` keeps its in-memory `Map`; the SW backs it.
      No loader API change expected.

Hook for prefetch shape already exists: `prefetchNeighbors` in
`src/app/member/reader/readerPaging.ts`.

## Layer 3 — Assignment data offline

Quran text alone is not enough — the assigned reader needs to know which pages
are mine.

- [ ] `src/data/firebase.ts`: `getFirestore(app)` →
      `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
      Keep the emulator branch working.
- [ ] `onSnapshot` then serves from IndexedDB offline; the store hydrates with
      last-known khatmas / assignments / roster.
- [ ] Fix the spinner-forever bug: `AssignedReaderPage.tsx` treats an empty
      khatma list as "loading" (`if (khatmas.length === 0) return <LoadingCard />`).
      Offline with no cache that never resolves. Needs a real offline state.
- [ ] Offline banner in the member shell, driven by connection state.

## Layer 4 — "Finished" while offline

`markRoundDone` (`src/data/assignments.ts`) uses `runTransaction`, which requires
a server round-trip and **never** works offline, persistence or not.

- [ ] Do **not** rewrite it as loose writes to ride Firestore's own write queue —
      that drops the released-chunk check and the assignment+roster atomicity.
- [ ] Instead: detect offline, queue the intent locally, replay on reconnect.
      `markRoundDone` is already idempotent, so replay is safe as written.
- [ ] UI: pending state, "سيُحفظ عند عودة الاتصال". Arabic copy goes in
      `src/content/strings.ar.ts`.
- [ ] Test the replay path, including a chunk released while the member was
      offline (`ReleasedChunkError`).

## Repo rules that bind this work

From `AGENTS.md` — the walls, abbreviated:

- Only `src/data/**` may import `firebase/*` (eslint-enforced). Layer 3 edits
  `firebase.ts`; the queue in Layer 4 must not leak Firebase into feature UI.
- Feature UI never imports `data`. Writes go through `src/app/operations`.
- Arabic UI copy lives in `src/content/strings.ar.ts`.
- Reader position must survive live snapshots (`useLastReadPage` is already
  localStorage, so it survives offline too).
- Every session ends with `npm run check` and the caveman delivery block.

Brick docs to update as layers land: `docs/areas/quran-data.md`,
`docs/areas/member-app.md`, `docs/areas/operations.md`.

## Session log

Append one line per session: date, layer, what actually changed.

- 2026-09-03 — plan created, branch cut, no code yet.

# Offline reading — progress plan

Branch: `feature/offline-reading`. Delete this file in the PR that lands the last
layer; `AGENTS.md` says plans do not live on `main`.

Goal: a member who loses connection mid-chunk keeps reading. Layers ship
independently and in order — each is a usable improvement on its own.

## Status

| Layer                         | State | Session    |
| ----------------------------- | ----- | ---------- |
| 1. Service worker + app shell | done  | 2026-09-03 |
| 2. Quran text offline         | todo  | —          |
| 3. Assignment data offline    | todo  | —          |
| 4. "Finished" while offline   | todo  | —          |

Update the row (`todo` / `wip` / `done`) and the session date at the end of every
session, then commit. That table is the resume point.

### Where this stands

**Done.** The member app now boots with no network. `vite-plugin-pwa` generates
`dist/sw.js`, which precaches the shell — HTML, manifest, hashed JS/CSS, both
Quran fonts, icons — 21 entries. Verified for real: with the preview server
stopped (`curl` refused), a reload still rendered the app. The hidden admin entry
and its exclusive chunk are excluded from the precache, proven by unit tests and
by `npm run check:service-worker`, which fails the build if either reaches
`sw.js`. Member bundle stayed at 363.25 kB gz against a 367 kB budget, because
registration is hand-written instead of pulling in `workbox-window`.

**Not done, and expected.** Offline the app still shows an empty roster —
Firestore has no local cache yet, so nothing knows which member is which. That is
Layer 3, and it is what makes the shell actually useful rather than merely
present.

**Next step: Layer 2.** Cache the mushaf text so an opened page survives a dead
connection. It is the smallest remaining layer (~320 kB gz for all 604 pages) and
independent of Layers 3 and 4 — start there.

### Files Layer 1 touched

- `vite.config.ts` — `VitePWA` block; `base` hoisted to a const for the
  navigate-fallback allowlist.
- `scripts/pwa-precache.ts` — new. Walks `dist/.vite/manifest.json` to find files
  only the admin entry reaches, and filters them out of the precache.
- `scripts/check-service-worker.ts` — new. Post-build gate on the real artifact.
- `src/app/member/install/serviceWorkerRegistration.ts` — new. Production-only
  registration.
- `src/app/entries/member.tsx` — calls it.
- `tests/tooling/pwa-precache.test.ts` — new, 6 tests.
- `package.json`, both workflows — wire `check:service-worker` into `check` and CI.
- `.claude/launch.json` — added a `preview` config, since the worker is
  production-only and `npm run dev` will never exercise it.

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

## Plain-language primer

### What a service worker actually is

A small, separate JavaScript file that the browser installs and keeps, even after
every tab of the site is closed. It is not part of the page. It has no DOM — it
cannot see or touch your React tree, and `document` and `window` do not exist
inside it.

Its real job is one thing: **it sits between the app and the network.** Every
time the app asks for a file — HTML, JavaScript, a font, a Quran page — the
request passes through the worker first, and the worker decides whether to answer
from its own cache or let it go to the network. That is why it can make the app
work offline: when the network is gone, it answers anyway.

The mental model that helps most: it is a **programmable proxy that lives inside
the browser**, on the user's phone, that you happen to write in JavaScript.

### Where it lives, who runs it

- **The file** is `dist/sw.js`, generated at build time and served like any other
  static file from GitHub Pages. We never wrote it by hand — `vite-plugin-pwa`
  produces it, and `vite.config.ts` says what goes in it.
- **The browser executes it**, not our server and not the page. We have no
  server, and that is fine: a service worker is purely client-side.
- **It lives per device, per origin.** Every member who opens the app gets their
  own copy installed on their own phone, along with its cache. Nothing is shared
  between members.
- **It outlives the page.** Close the tab and the worker stays installed. The
  browser starts and stops it on demand — it is not a process sitting there
  burning battery.
- **The first visit is never offline-capable.** The worker has to be downloaded
  and installed before it can help, so a member must open the app online once.
  From the second visit on, it works.
- **Scope** is the folder the worker is served from. Ours covers the whole app.
  This is also why it cannot be used to hide the admin panel from members: both
  entries live at the same origin.

### What it unlocks

Getting a service worker in place is the gate for a whole category of features.
It is genuinely a bigger deal than "the app opens offline":

- **Offline** — what we are using it for.
- **Speed** — cached files load from disk instead of the network, so the app
  starts fast even on a good connection.
- **Background sync** — queue a write made offline and let the browser flush it
  when the connection returns. Directly relevant to Layer 4.
- **Push notifications** — yes, but read the next section before planning
  anything around it.

### About notifications and reminders — the honest version

You asked specifically, and the answer has a real catch.

**Push notifications:** a service worker is _required_, but it is not
_sufficient_. Web push works by a **server** sending a message to the browser
vendor's push service, which wakes the worker on the phone. So push needs
something to do the sending, and this app is deliberately static — `AGENTS.md`
says "App is static. No server or Cloud Functions." Adding push means adding a
sender: a Cloud Function, a scheduled job, something. That is a real
architectural change, not a flag to flip.

Also worth knowing before promising it to anyone: on iPhone, web push only works
if the member has **added the app to their home screen**. In a plain Safari tab
it does not work at all. Our install card already nudges toward that, which
helps, but it will not be universal.

**Local reminders — "remind me at 8pm to read my pages":** this is the one people
assume is easy, and on the web it is the _hard_ one. There is no reliable way for
a website to schedule a notification to fire later while it is closed. The API
that would have done it never shipped broadly, and the background-wakeup
alternatives are Chromium-only and unreliable by design. So a dependable daily
reminder ends up going through the same server-side push path above — the phone
does not remind itself, something has to reach out to it.

**Short version:** this work puts the prerequisite in place. It does not deliver
notifications, and the remaining gap is a sender, not a worker.

### Why this cannot be tested with `npm run dev`

The worker only registers in production builds. In development a stale cache
would serve you yesterday's code and hide your own changes, which is maddening.
To see it work, build and run the `preview` launch config, not `dev`.

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

## Known pre-existing issue — `format:check` on Windows

`npm run check` ends with `prettier --check .`, and it fails on this machine on
files nobody in this work touched. It is not drift and not ours: the repo has no
`.gitattributes`, so Git checks files out with CRLF endings on Windows while
Prettier expects LF. Stashing every change and re-running reports **29** failing
files against 24 with the work applied — the count goes _down_, because
`vite.config.ts` got formatted along the way.

CI runs on Linux, where the same files are LF, so this does not fail the build.

**Do not "fix" it by running `prettier --write .`** — that rewrites most of the
repo and buries the real diff. If it becomes annoying, the correct fix is its own
change: add a `.gitattributes` with `* text=auto eol=lf`.

## Session log

Append one line per session: date, layer, what actually changed.

- 2026-09-03 — plan created, branch cut, no code yet.
- 2026-09-03 — Layer 1 done. `vite-plugin-pwa` 1.3.0 (its peer range does cover
  Vite 8, so the hand-rolled fallback was not needed). Shell precaches and boots
  offline; admin entry excluded and gated in CI. Full `npm run check` passes
  except `format:check`, which already failed on `main` — see the note below.

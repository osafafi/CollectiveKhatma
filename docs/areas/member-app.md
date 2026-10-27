# Member app brick

Owns: identity gate, khatma/Wird list and landing, assigned pages, daily Wird,
finish, completion, settings, and member-to-admin feedback submission.

Start files:

- Entry/routes: `src/app/entries/member.tsx`, `src/app/member/MemberApp.tsx`
- Khatma UI: `src/app/member/KhatmasListPage.tsx`, `KhatmaLandingPage.tsx`,
  `src/app/member/khatma/`
- Wird UI: `src/app/member/wird/`
- Reader: `src/app/member/reader/`
- Recitation: `src/app/member/recitation/` (engine, provider, Settings card)
- Completion: `src/app/member/MemberCompletionInterrupt.tsx`
- Feedback form: `src/app/member/MemberFeedbackSection.tsx`
- Persistence: `src/app/persistence/browserPersistence.ts`

Reads: store selectors. Writes: `useWriteOperation`. Never import `data`.

Tests: `member-identity`, `member-khatma-routes`, `member-reader`,
`member-completion`, `member-personal-settings`, `member-integration`,
`member-offline`, `finish-queue`, `recitation-engine`,
`member-recitation-settings`, `member-recitation`, `recitation-playlist`.

Hard rules:

- `src/app/entries/member.tsx` registers the offline service worker on window
  load, via plain `navigator.serviceWorker` rather than `virtual:pwa-register`,
  so `workbox-window` stays out of the member bundle. Registration is a
  no-op in development and tests. See `docs/areas/operations.md` for what the
  worker precaches.
- The same entry starts the background mushaf sweep. It is a no-op until a
  worker controls the page, so it never runs on a first visit, in development,
  or in tests, and it stands down for Data Saver and while offline. The
  assigned reader pushes the member's own chunk to the front of it.
- `MemberShell` renders the offline banner above the shell frame rather than
  inside the content column, because routed heroes cancel that column's padding
  to bleed to the top edge and would ride up over it. `useOnlineStatus` owns the
  signal (`navigator.onLine` plus the `online`/`offline` events) and the same
  hook drives the gate and the assigned reader.
- Offline the app runs on Firestore's persistent cache, so the roster, khatmas,
  and assignments are last-known rather than absent. An empty cache arrives as a
  ready-but-empty snapshot (see `docs/areas/operations.md`), so the identity gate
  and the assigned reader key their offline dead end on having nothing to show,
  not on listener status: the gate says nothing is saved on this device instead
  of "no members yet", and the assigned reader says it could not load your pages
  instead of claiming none are due. Online, an empty roster or khatma list is
  still reported as the real answer it is, and a failed khatma subscription
  reads as could-not-load rather than spinning.
- Persistent member listeners subscribe only to the selected member's active
  khatmas and active Wird completion logs. While the personal route is mounted,
  it additionally retains that
  member's completed-khatma assignment histories for read-only insights, then
  releases those historical listeners when the route unmounts. It likewise
  retains current and archived Wird logs involving the current or a past assignee.
- Active Wirds appear beside khatmas as gold-toned cards (gold `SurfaceCard`
  and `HeroHeader` tones) with an accent `ورد يومي` badge.
  A Quran Wird uses the assigned Quran reader over its fixed Surah/Juz page set;
  a custom-du'a Wird uses a text-reading view. Both expose
  `أتممت وردي اليومي` and the same rotating daily-du'a popup as khatma finishes.
- A Wird is available once per local calendar day and becomes available again
  automatically at local midnight, including in a tab left open overnight.
  Missed days create no backlog or warning. A paused member cannot open or
  complete the Wird until re-enabled, and it is not listed as pending. The
  finish button's own success state is keyed to the local day, so an open tab
  offers the new day's button after midnight.
- Wird completion uses the durable finish queue. The queue captures the local
  date, tap timestamp, content kind, and exact page snapshot so an offline finish
  credits what the member actually read even if the admin edits the Wird before
  replay. Completion is idempotent per member/Wird/date.
- The assigned reader opens on the page its link names
  (`#/khatma/{id}/read/{page}`), else on the page this member last had open in
  that khatma on this device, else on the first page — each only while that page
  is still assigned, so a redistribution that drops it opens the first page.
  Each page turn replaces (never pushes) the hash with the open page and saves
  it under `khatma.assignedReaderPage.${khatmaId}.${memberId}`, so a tab switch,
  a reload, or a closed app comes back to it. A finished round — recorded,
  finished on this screen, or queued offline — ignores and clears the saved page.
- Reader position survives unrelated live snapshots. A new round or a
  redistribution remounts the reader, which reopens by the rule above.
- Gold page tiles on the khatma landing card and on each personal-page entry are
  links that open the assigned reader on that page.
- Finishing a round goes through `useFinishRound`, never
  `useWriteOperation('markRoundDone')` directly. A transaction cannot run
  offline (see `docs/areas/operations.md`), so the tap is kept on the device and
  replayed when the connection returns — on the `online` event, on the tab
  becoming visible, and on a slow timer while anything is queued, because
  `online` does not fire when the browser never noticed the drop. Until it
  lands the member sees `queuedFinish`, deliberately not the success banner:
  nothing has reached the group yet. A tap whose pages were released while the
  member was away is dropped rather than retried.
- Released chunk cannot be marked done.
- Both completion buttons use `useFinishWithDailyDua`, which delegates to
  `useFinishRound`. An accepted or locally queued tap opens `DailyDuaProvider`'s
  gradient, scrollable `دعاء اليوم` dialog with one `تم` button and a fade in/out
  (reduced-motion aware). Failures and background replay do not open it.
- The daily prayer is independent of du3a2 al-khatma. Its provider sits above
  `MemberCompletionInterrupt`, so the final reader still sees it when the khatma
  screen replaces the reader. Dismissal does not acknowledge khatma completion.
- Daily selection uses the earliest valid assignment date among all chunks in
  that khatma-local round, including released history, so later adjustments and
  different completion days/timezones agree. Accumulated pages use the latest
  pending round. Calendar days advance a looping index from 2026-09-07; rounds
  on the same date share a prayer. Admin saves apply immediately to future taps;
  the open popup retains the text captured by its tap. The list comes only from
  Firestore (or its persistent offline cache); missing, invalid, or empty content
  disables the daily dialog. No daily prayer text is bundled with the app.
- Completion interrupts only the designated duaa reader and hides their normal
  nav until acknowledged. Other members, and khatmas without a designated reader,
  do not show the completion popup. The separate daily prayer is unchanged.
- Other members' warning levels are never shown.
- Feedback is trimmed, must contain 10–500 characters, and creates a fresh unread
  document with the selected member id and current name on every submission.
- Keys: `khatma.memberId`, `khatma.readingScale`, `khatma.lastReadPage` (browse
  reader), `khatma.assignedReaderPage.${khatmaId}.${memberId}` (assigned reader),
  `khatma.themeMode` (shared with the admin entry), `khatma.qari` (recitation
  voice, this device only), `khatma.du3aAck.${khatmaId}`,
  `khatma.pendingFinishes` (the offline finish queue, owned by
  `src/app/operations/finishQueue.ts` rather than by `browserPersistence`).
- `MemberHero` shows the member name app-wide (greeting variant on lists,
  title variant on Settings); the khatmas list also shows a read-only
  "previous" disclosure of completed khatmas the member took part in. It is
  collapsed by default so active and completed khatmas cannot read as one list;
  its rows are not links and show the series artwork, numbered series title,
  completion date, and duaa reader.
- The personal page groups every pending assignment from the selected member's
  active khatmas into its own linked gradient card. Each entry shows khatma
  artwork, the numbered series title, and the assigned page count, and opens
  that khatma's assigned reader where the member left off; its page tiles sit
  below the card link, never inside it. An empty message replaces the list when
  every current chunk is done.
- The personal page has a standalone gradient `احتفظ بصفحاتي` switch card.
  While enabled it shows an orange accumulation warning, and unread rounds are
  combined into one pending card and one assigned-reader page set. Finishing
  that accumulated set switches the preference off automatically.
- The personal page's Quran summary (`PersonalReadingInsights`) mirrors the
  reference donut layout and keeps its three gradient statistic tiles inside
  the same completion card. It derives every value from existing snapshots, with
  no persisted counters. Lifetime pages read count every credited page, repeats
  included, and never fall below the roster's unique `completedPages` (which
  still holds pages from khatmas that no longer list the member). Full khatmas =
  lifetime pages ÷ 604, rounded down, shown as the counter at the title row's
  far end. The ring and big number show progress toward the next khatma (rounded
  down, so 603 pages never reads 100%). The top-reader percentage still ranks
  the roster by unique pages. The tiles show completed group khatmas still
  listing the member, pages credited in the current local calendar month, and
  the longest run of local calendar days with a completed round. Released/empty
  rounds do not count, and multiple completions on one date count as one streak
  day.
- Quran Wird pages count on every daily completion, including rereads, toward
  lifetime/monthly pages, full-khatma equivalents, shields, and accomplishments.
  Custom-du'a completions add zero pages but do count as a reading day for the
  streak. The fourth statistic tile shows total completed Wird days.
- Achievement shields (`KhatmaShields.tsx`, rule `khatmaShieldProgress`): bronze
  at 1 full khatma, silver at 5, gold at 10. The track between shields fills
  with partial khatmas; the line below names the next shield and the whole
  khatmas left. Earned shields glint periodically (reduced motion: none).
- Settings order: appearance (light/dark toggle, the ONLY toggle location
  together with admin Settings) → reading size → recitation voice → avatar →
  app install → feedback. The install card invokes Chromium's retained native install prompt
  when available; otherwise it detects iOS/Android and Safari, Chrome, Samsung
  Internet, Firefox, or Edge to show matching home-screen steps. It is hidden
  while the app runs in standalone mode.
- Recitation runs on one engine (`recitationEngine.ts`) provided above every
  member route by `RecitationProvider`, which also hoists the voice preference
  and renders the only failure UI: one dialog saying recitation is not
  available on this device or connection. Offline, a host error, a
  non-audio response, no playback within 7s on every host, or a 12s mid-play
  stall all end there — never a crash, never a technical message — because
  some members' bundles reach only certain apps while `navigator.onLine` stays
  true. Closing it leaves the ayah paused if anything had played, else idle.
- The engine reaches `audio.play()` synchronously from the tap (iOS unlock),
  reuses one lazily created element, and never sets `crossOrigin`. The primary
  host is tried first; once the mirror answers, it is preferred for the rest of
  the session. The next ayah is prefetched into an in-memory blob (skipped
  under Data Saver, `audio/*` responses only) and released after use. Nothing
  is persisted.
- Every Quran reader (assigned, Quran Wird, free browse) shows a floating
  play button above the tab bar (`RecitationDock`); a du'a Wird has none. Play
  starts at the top of the visible page and opens the bar (verse, voice,
  previous/play-pause/next, close). Assigned and Wird readers play through the
  rest of their page list, walked by index; the browse reader stops after the
  last ayah of the surah it started in, even mid-page. A basmala item plays
  before every surah start the mushaf shows a bismillah line for.
- `useReaderRecitation` keeps reader and audio on one page: audio reaching
  another page turns the reader there (assigned/Wird via their own `go`,
  replacing the hash; browse replaces too and still saves the last-read page,
  so a long listen leaves Back one step out). A page turn the audio did not
  make is the member's: playing audio restarts at the top of that page, paused
  audio is forgotten. Leaving the reader, or any keyed remount of it (new round,
  redistribution, the Wird's midnight key), stops playback.
- Previous restarts the current ayah after 2s, else steps back one item; next
  on the last item ends the session. Both always play.
- The Settings recitation card lists the 15 voices as radios; tapping one saves
  it immediately (Alafasy until then). Each row previews Ayat al-Kursi; one
  preview plays at a time and it stops when the card closes or Settings
  unmounts.
- Reader chrome is the slim gradient hero; group progress opens and series
  history collapses by default on the khatma landing (local state). Inside
  group progress, pending readers have their own collapsed, count-labelled
  disclosure whose avatar/name rows open in a two-column grid. The current
  pages, group progress, history, and pending-reader headers use matching
  semantic icons.
- Below the current-round card (or the paused note), the khatma landing has a
  collapsed-by-default `صفحاتي في هذه الختمة` card (`MyPagesCard`) whenever the
  member has an assignment there. Its summary chip totals the pages they
  completed in this khatma; inside, one row per completed round shows the round
  and its exact page ranges, newest first. It derives from `completedReadingLog`
  over the member's own live assignment, so pending pages, released (recalled)
  chunks, and done marks an admin cleared never appear.
- Assigned-reader navigation follows RTL book direction: previous is on the
  right, next is on the left, and both enabled actions share the primary style.
- Every Quran page in both readers attaches a centered, content-width green tab
  to the reader header with its earliest surah's name and Western-digit number.
  On a shared boundary page, the later surah keeps its in-page heading.
- The free-browse reader keeps its surah and juz selects synchronized with the
  displayed page, including during previous/next navigation.
- The assigned reader opens with a compact grid header: the daily-pages title
  sits above the member avatar and name in the center, khatma artwork sits above
  the numbered series title at the left, and the right page-total tile matches
  the artwork height.

Update this doc when member routes, subscriptions, reader, finish, or persistence changes.

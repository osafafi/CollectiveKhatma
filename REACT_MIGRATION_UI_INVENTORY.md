# React Migration — Route-by-Route UI Parity Inventory (RM-020)

**Owner:** Claude · **Task:** RM-020 · **Status:** deliverable for Phase 0 exit.
**Baseline:** derived from source at `reactmigration` HEAD `d3b277d` (behavior of
commit `6992007` per the plan's Baseline Snapshot; no UI code has changed since).

This document is the **parity oracle** for the migration. It enumerates every
member and admin route with its actions, loading/empty/error states, persistence
behavior, and responsive/RTL behavior, so the React rebuild can be checked
screen-for-screen. It is consumed by:

- **RM-115** (Tailwind→MUI token map) — the component/state surface to cover.
- **RM-310/RM-320** (shells, primitives) — the chrome and control inventory.
- **RM-400–RM-440** (member) and **RM-500–RM-540** (admin) — the build targets.
- **RM-460** (member parity review) and **RM-570** (admin parity review) — the
  literal checklists to walk on mobile + desktop RTL.

> Derived from source, not from a live click-through. It is complete against the
> code but not yet *witnessed* running; RM-460/RM-570 are where each box is
> checked against the running React app (emulator-backed — see plan Review Note
> #5). Treat unchecked boxes below as "to verify during parity review".

## How to read this

- **Route** = hash path (both apps use hash routing — `AD-03`, GitHub Pages has
  no SPA fallback). Unknown hashes fall back to the app's default route.
- Each route lists **Actions**, then **States** (loading / empty / error /
  not-found as applicable), **Persistence**, and **Responsive/RTL**.
- `☐` = a parity item a reviewer must confirm in React. Copy is quoted from
  [`src/content/strings.ar.ts`](src/content/strings.ar.ts) by its key.
- "Draft" = a value held in an in-memory form-draft object that survives
  re-renders but is **not** localStorage (admin `AdminDraft`, member settings/
  reader instances). "Persisted" = localStorage (survives reload).

---

## 1. App shell & global parity (both apps)

### 1.1 HTML entries

| | Member | Admin |
| --- | --- | --- |
| File | [`index.html`](index.html) → [`src/member.ts`](src/member.ts) | [`admin-nano.html`](admin-nano.html) → [`src/admin.ts`](src/admin.ts) |
| Mount | `<div id="app">` | `<div id="app">` |
| `<html>` | `lang="ar" dir="rtl"` | `lang="ar" dir="rtl"` |
| Viewport | `width=device-width, initial-scale=1, viewport-fit=cover` | same |
| `theme-color` | `#faf7f0` | `#faf7f0` |
| `robots` | — | `noindex, nofollow` (hidden admin; do not link from member — `AD-02`, security is obscurity-only, an accepted non-goal) |
| Title | set at runtime: `strings.member.title` (`خَتْمة`) | `strings.admin.title` (`خَتْمة — لوحة التحكم`) |
| Boot | `initReadingScale()` + `resolveIconOverrides()` before render | same |

- ☐ `dir="rtl"` + `lang="ar"` on the root; MUI Emotion RTL cache produces the
  same physical layout (`AD-08`, RM-210).
- ☐ `viewport-fit=cover` + safe-area padding preserved (mobile notch).
- ☐ Runtime `document.title` per app.
- ☐ Admin entry stays unguessable/unlinked and `noindex`.

### 1.2 Responsive chrome — tab bar ⇄ side rail

Shared by both apps ([`src/ui/shared/nav.ts`](src/ui/shared/nav.ts),
[`renderTabBar`](src/ui/shared/nav.ts)).

- **Mobile (< `lg`)**: fixed **bottom** tab bar (`fixed inset-x-0 bottom-0`,
  top border). Content column has `pb-28` to clear it.
- **Large (≥ `lg`)**: promotes to a **right-side vertical rail** (RTL physical
  right: `lg:right-0 lg:h-full lg:w-24 lg:border-l`, `lg:top-0`). Content column
  gets `lg:pr-24` to reserve the rail and `lg:pb-8`.
- Tabs are native hash `<a>` links (keyboard-accessible; drive the router).
- Active tab: `aria-current="page"` + `text-primary`; inactive `text-muted`.
- Each tab = mask icon (`§1.5`) + label; min touch height `3.5rem`.
- Content column widths: member `max-w-xl md:max-w-2xl lg:max-w-3xl` (centered);
  admin `max-w-2xl lg:max-w-4xl`.

☐ Bottom bar on phone, right rail on desktop, RTL side correct, active state,
keyboard focus, safe-area clearance — verify both apps (RM-310, RM-650).

### 1.3 Persistence keys (localStorage) — survive reload

| Key | Written by | Read by | Value / notes |
| --- | --- | --- | --- |
| `khatma.memberId` | identity gate select; cleared by "switch person" | member boot ([`getRememberedMemberId`](src/ui/shared/identity.ts)) | roster doc id. Absent ⇒ show gate. |
| `khatma.readingScale` | settings slider (live on drag) | boot `initReadingScale`, settings slider | `1..5`, default `3`; applied as `<html data-reading-scale>`. Shared by both apps. |
| `khatma.lastReadPage` | browse reader on every navigation | browse reader start ([`getLastReadPage`](src/ui/member/reader.ts)) | `1..604`, default `1`. Browse mode only — assigned mode does **not** write it. |
| `khatma.du3aAck.${khatmaId}` | completion "Done" ([`ackDu3a`](src/ui/member/render.ts)) | completion overlay gate ([`du3aAcked`](src/ui/member/render.ts)) | `'1'`. Per-khatma; suppresses the completion overlay after acknowledgement. |

☐ All four behaviors reproduced as typed hooks (RM-340) with identical keys so
existing devices keep their identity/scale/last-page/ack after cutover.

### 1.4 Reactivity & lifecycle model (to reproduce in Redux, not literally)

- Framework-free today: Firestore `onSnapshot` listeners **and** `hashchange`
  both trigger a full re-render of nav + current route from live state.
- **Member** subscribes: roster, global content, khatmas (always); assignments
  **only** for the member's active khatmas (reconciled as khatmas change —
  [`reconcileAssignmentSubs`](src/ui/member/render.ts)).
- **Admin** subscribes: roster, global content, khatmas (always); assignments
  for **every active** khatma **plus** the khatma currently open on a detail page
  (which may be completed) — [`reconcileAssignmentSubs`](src/ui/admin/render.ts).
- Surah/juz data (names, page spans, page→unit maps) loaded once on admin boot.
- **Listener cleanup**: member tears down all subs on "switch person"; both
  reconcile (unsubscribe + drop state) when a khatma leaves the active set.

☐ RM-240: listeners start once, dedupe under Strict Mode/HMR, clean up. ☐ The
member's *dynamic* assignment subscription set (only my active khatmas) is
preserved. ☐ The admin's "active ∪ currently-open" subscription set is preserved.

### 1.5 Icon overrides ([`src/ui/shared/icons.ts`](src/ui/shared/icons.ts))

- Icons render as a CSS-mask `<span>` painted with `currentColor` (so they take
  the active/inactive tab color; only alpha matters).
- Default `public/icons/{name}.svg`; a `{name}.png` dropped beside it **wins**,
  probed once at startup via `HEAD` fetch; nav re-render picks it up (brief
  default-icon flash acceptable). Names: `quran|khatmas|personal|settings|home`.
- URLs built from `import.meta.env.BASE_URL` (GitHub Pages base).

☐ RM-330: mask+currentColor tinting and the PNG-overrides-SVG probe preserved.

### 1.6 "Today" & theme tokens

- "Today" = **local** calendar date `YYYY-MM-DD` ([`todayIso`](src/ui/shared/components.ts)).
  Drives the same-day distribution guard and chunk date stamps.
- Chart/segment colors come from theme tokens (`var(--color-…)`); identity is
  never color-alone (every donut/segment pairs with a written number) — keep for
  accessibility (RM-650).

### 1.7 Error-handling model (baseline — preserve or *intentionally* improve)

Every `subscribe*` accepts an optional `onError`. In the current UI:

- **Only** the member **identity gate** passes an error handler → shows
  `member.connectionError`.
- **All other** app-shell subscriptions (member `startApp`, admin `renderAdmin`)
  pass **no** `onError` — a listener failure is **silently swallowed**; the route
  simply stays on its loading/empty state.

☐ Decide in RM-240/RM-300 whether React keeps this (parity) or adds a global
error/retry surface (improvement). If improved, **record it** as an intentional
delta in RM-460/RM-570 — do not let it masquerade as parity.

---

## 2. Member app

Routes ([`src/ui/shared/router.ts`](src/ui/shared/router.ts)); default =
`khatmas`; unknown ⇒ `khatmas`.

| Route | Hash | Tab | Section |
| --- | --- | --- | --- |
| Identity gate | — (pre-route; no `memberId`) | none | 2.1 |
| Khatmas list | `#/khatmas` (default) | الختمات | 2.2 |
| Khatma landing | `#/khatma/{id}` | الختمات | 2.3 |
| Assigned reader | `#/khatma/{id}/read` | الختمات | 2.4 |
| Browse reader | `#/quran`, `#/quran/{page}` | المصحف | 2.5 |
| Personal | `#/personal` | صفحتي | 2.6 |
| Settings | `#/settings` | الإعدادات | 2.7 |
| Completion overlay | interrupt (any route) | none (nav hidden) | 2.8 |

The **Khatmas** tab is active for `khatmas`, `khatma`, and `khatmaRead` routes.

### 2.1 Identity gate

Shown whenever `khatma.memberId` is absent ([`renderIdentityGate`](src/ui/member/render.ts)).
Centered `max-w-xl` column, header (title + `member.tagline`), card
`member.choosePrompt`.

- **Actions:** ☐ tap a name → persist `khatma.memberId`, unsubscribe roster,
  enter app (`startApp`).
- **Loading:** ☐ `member.connecting` — "جارٍ الاتصال بقاعدة البيانات…".
- **Empty:** ☐ `member.emptyRoster` — "لا يوجد أعضاء بعد".
- **Error:** ☐ `member.connectionError` (the one place shell errors surface).
- **Persistence:** ☐ writes `khatma.memberId`.
- **Responsive:** ☐ no nav; centered column phone + desktop.

### 2.2 Khatmas list — `#/khatmas`

Heading `member.khatmasHeading` ("ختماتي"). One card per **active series**
([`activeSeriesGroups`](src/domain/series.ts)); the card targets the khatma
holding my pending chunk, else the latest.

- **Per card:** ☐ series title (`seriesTitle`), ☐ percent `٪`, ☐ progress bar,
  ☐ my line — one of: `member.awaitingDistribution` / `✓ member.doneToday` /
  "`member.todayHeading`: N `pagesWord`".
- **Actions:** ☐ tap card → `#/khatma/{id}`.
- **Empty:** ☐ `member.noKhatmas` — "لست مشتركًا في أي ختمة حالية."
- **Loading:** ⚠ **no dedicated loading state** — before khatmas load,
  `myActiveKhatmas` is `[]`, so the **empty** card shows transiently. (See
  §5 quirk.) ☐ Reproduce *exactly* or flag as an intentional improvement.
- **Responsive:** ☐ grid `md:grid-cols-2`.
- **Persistence:** none.

### 2.3 Khatma landing — `#/khatma/{id}`

[`khatmaLandingView`](src/ui/member/pages/khatmas.ts). Sections in order:
back link → title → round line (`roundWord` N · `startedWord` date) → [my warning]
→ [paused note | my round card] → group progress card → [history card].

- **Actions:**
  - ☐ back link → `#/khatmas`.
  - ☐ "read my pages" (`reader.readMyPages`) → `#/khatma/{id}/read` (only when a
    chunk exists and is not done).
  - ☐ **Finish** (`member.finishedToday`) → `markRoundDone`; disables while
    pending; on `ReleasedChunkError` shows `member.releasedNote`, else
    `member.saveError`; success → done banner (`✓ member.doneToday`).
- **States:**
  - ☐ My warning banner shown **only for me**, gentle copy `member.warningNote`,
    yellow vs red by `warningLevel(missedStreak)`.
  - ☐ Paused (member disabled) → `member.pausedNote`, no finish action.
  - ☐ Awaiting distribution (no readable chunk) → `member.awaitingDistribution`.
  - ☐ Group progress: percent + bar; "this round done X `ofWord` Y"; pending
    reader **names** (`⏳ …`) — never other members' warning levels.
  - ☐ History card (`member.historyHeading`) only if the series has completed
    khatmas; each line `title · completedOn date`.
  - **Not found:** ☐ khatmas loaded but not mine → `notFoundView`
    (`member.noKhatmas` + back). **Loading:** ☐ khatmas empty → `loadingCard`
    (`common.loading`).
- **Persistence:** none (finish writes Firestore + lifetime `completedPages`).

### 2.4 Assigned reader — `#/khatma/{id}/read`

[`showAssignedReader`](src/ui/member/render.ts) + reader `mode:'assigned'`.
Reads the member's current-round chunk (revisitable when done).

- **Chrome:** ☐ nav row (prev/next, disabled at ends w/ `opacity-40`), ☐ page
  indicator "`page` N · i `of` M".
- **Footer:** ☐ if done → done banner; else "`reader.finishedReading`" + finish
  button → `onFinish`→`markRoundDone`; error → `member.saveError`.
- **States:** ☐ still loading / not my khatma → `loadingOrBack` (`loadingCard`
  if khatmas empty, else `noPagesView`). ☐ paused or empty chunk →
  `noPagesView` (`reader.noPagesToday`) + back link. ☐ page body load error →
  `quran.loadError`; per-page "`common.loading`".
- **Reader lifetime:** ☐ instance keyed `khatmaRead:{id}:{round}` and **reused
  across unrelated Firestore ticks** — background updates must **not** rebuild it
  or reset scroll/page (RM-440 risk).
- **Persistence:** none (assigned mode never writes `lastReadPage`).

### 2.5 Browse reader (المصحف) — `#/quran`, `#/quran/{page}`

Reader `mode:'browse'` over all 604 pages.

- **Chrome:** ☐ title `reader.browseTitle`, ☐ nav row + indicator "`page` N `of`
  ٦٠٤", ☐ **surah** select (by name), ☐ **juz** select (1–30), ☐ page number
  input (`goToPage`).
- **Actions:** ☐ prev/next, ☐ surah jump, ☐ juz jump, ☐ page input jump. Each
  navigation ☐ writes `khatma.lastReadPage` and ☐ syncs URL via
  `navigate(#/quran/{page})`.
- **Start page:** ☐ deep-link `{page}` if valid, else `getLastReadPage()`.
- **States:** ☐ per-page "`common.loading`"; ☐ page load error `quran.loadError`;
  ☐ stale-navigation guard (a newer page wins, older result dropped); ☐ jump
  controls populate async and are **silently omitted on failure** (reading still
  works).
- **Reader lifetime:** ☐ instance keyed `quran`, reused across ticks; deep-link/
  back updates via `goToPage` (no-op if already there).
- **Persistence:** ☐ `khatma.lastReadPage` on every navigation.
- **Responsive:** ☐ sticky top chrome (`sticky top-0`), backdrop blur.

### 2.6 Personal (صفحتي) — `#/personal`

[`personalView`](src/ui/member/pages/personal.ts).

- **Content:** ☐ heading `personal.heading`, ☐ `member.greeting`, ☐ my name,
  ☐ insight card: "`member.lifetimeLead` N `member.lifetimeTail` (P٪)" + progress
  bar ([`lifetimePercent`](src/domain/progress.ts) of 604).
- **Actions:** ☐ "switch person" (`member.switchPerson`) → cleanup subs +
  `forgetMember()` + re-render → identity gate.
- **Empty:** ☐ name blank if roster not yet loaded (`me` undefined → `''`),
  count `0` → `٠٪`.
- **Persistence:** ☐ switch removes `khatma.memberId`.

### 2.7 Settings (الإعدادات) — `#/settings`

- **Content:** ☐ heading `nav.settings`, ☐ shared `settingsControl` — a native
  `<details>` popover ([`src/ui/shared/settings.ts`](src/ui/shared/settings.ts))
  with a 1–5 font-size range slider + sample line (`settings.sample`).
- **Actions:** ☐ slider live-applies + persists `khatma.readingScale` on input.
- **State preservation:** ☐ the settings control instance is created **once** in
  `startApp`, so its open/close state persists across re-renders.
- **Persistence:** ☐ `khatma.readingScale`.

### 2.8 Completion overlay (interrupt — any route)

[`completionOverlay`](src/ui/member/render.ts). Fires when one of my active
khatmas is complete **and** `!du3aAcked(khatmaId)`. **Takes over the whole view;
nav hidden; any reader torn down.**

- **Reciter (or unset reciter, or I am the reciter):** ☐ du3a screen —
  `member.khatmaComplete`, `member.du3aHeading`, the du3a text (live
  `content.du3aText` else `DEFAULT_DU3A_TEXT`), Done.
- **Non-reciter:** ☐ notice — `member.khatmaComplete`, "`member.reciterLead`:
  {name}", Done.
- **Actions:** ☐ Done (`common.done`) → `ackDu3a` (writes
  `khatma.du3aAck.{id}`) + re-render (returns to normal routes).
- **Persistence:** ☐ `khatma.du3aAck.{khatmaId}`.

---

## 3. Admin app

Routes ([`src/ui/admin/routes.ts`](src/ui/admin/routes.ts)); default = `home`;
unknown ⇒ `home`. Tabs: Home / Roster / Khatmas / Settings. The **Khatmas** tab
is active for both `khatmas` and `khatma`.

| Route | Hash | Section |
| --- | --- | --- |
| Home dashboard | `#/home` (default) | 3.1 |
| Roster | `#/roster` | 3.2 |
| Khatmas list + create | `#/khatmas` | 3.3 |
| Khatma detail | `#/khatmas/{id}` | 3.4 |
| Settings | `#/settings` | 3.5 |

Persistent header on every page: `admin.heading` ("لوحة تحكم المشرفة").
All admin form fields live in a persistent `AdminDraft`
([`src/ui/admin/ctx.ts`](src/ui/admin/ctx.ts)) so values **survive re-renders**
(RM-550 risk — snapshots must not clobber drafts).

### 3.1 Home dashboard — `#/home`

[`homePage`](src/ui/admin/pages/home.ts). Heading `admin.homeHeading`. One block
per active series → one sub-block per active khatma.

- **Per-khatma metrics:** ☐ donut (percent) + ☐ segment bar
  (`legendDone`/`legendPending`/`legendRemaining`) + ☐ facts line
  "`remaining` `pagesRemaining` · `roundWord` N [· `lastDistribution`: date]" +
  ☐ title link → detail.
- **Pending readers:** ☐ list of members with a current chunk + exact page
  **ranges** (`١–٣، ٥`); hidden when none.
- **Warnings:** ☐ yellow/red chips per flagged member (admin sees **all**);
  hidden when none.
- **Distribute action (per khatma):**
  - ☐ Not distributed today → primary `admin.distribute`; confirm
    `admin.confirmDistribute`.
  - ☐ Distributed today → `admin.distributedToday` note + secondary
    `admin.redistribute`; confirm `admin.confirmRedistribute`.
  - ☐ Busy → button disabled + `opacity-50` (prevents double-press).
  - ☐ Success status: `distributeSuccess`/`redistributeSuccess`, plus appended
    `rolloverNote` and/or `completedNote` when those happen.
  - ☐ Errors: `AlreadyDistributedError` → `alreadyDistributed`; scope failure or
    other → `distributeError`.
- **Empty:** ☐ no active series → `admin.noActive` ("لا توجد ختمات حالية.").
- **Same-day guard:** ☐ `lastDistributionDate === todayIso()` drives the
  distributed-today branch; redistribution bypasses the guard.
- **Persistence:** none persisted; `draft.busy`/`draft.status[khatmaId]` are
  transient in-memory.

### 3.2 Roster — `#/roster`

[`rosterPage`](src/ui/admin/pages/roster.ts). Heading `admin.rosterHeading`.

- **Search:** ☐ `searchField` (`admin.searchPlaceholder`), filters by name
  substring as-you-type; ☐ **caret/focus preserved** across the keystroke
  re-render ([`rerenderPreservingSearchFocus`](src/ui/admin/pages/roster.ts)).
- **Per-person row:** ☐ name (strike-through + muted if disabled), ☐
  `disabledBadge` when paused, ☐ pages/round **stepper** (± ; min 1) →
  `updatePerson`, ☐ `disable`/`enable` toggle → `updatePerson`, ☐ `remove` →
  confirm `admin.confirmRemove` → `removePerson`.
- **Add form:** ☐ name, ☐ note (optional), ☐ pages/round number, ☐ `addPerson`
  button. Validation: ☐ `nameRequired` (blank), ☐ `nameTaken`
  ([`isNameUnique`](src/domain/validation.ts)); resets fields on success.
- **States:** ☐ empty roster → `admin.emptyRoster`; ☐ query with no match →
  `admin.noMatches`.
- **Persistence:** draft (`newName/newNote/newPagesPerDay/search`) survives
  re-renders; not localStorage. ☐ Snapshot updates must not wipe the add-form
  draft mid-entry (RM-550).

### 3.3 Khatmas list + create — `#/khatmas`

[`khatmasPage`](src/ui/admin/pages/khatmas.ts). Heading `admin.navKhatmas`.
List-first; the create form is gated behind a button.

- **List:** ☐ all khatmas, **active first then completed**, each by `createdAt`
  desc; each line: title, ☐ status badge (`statusActive`/`statusCompleted`),
  ☐ percent (completed = 100) → link to detail. ☐ Empty → `admin.noActive`.
- **Create gate:** ☐ button `admin.createNewButton` reveals the form
  (`draft.showCreateForm`); ☐ `cancel` hides it.
- **Create form fields:**
  - ☐ Series name (`seriesNamePlaceholder`) + ☐ **continuation note** when the
    name matches an existing series ("`continuesSeries` N").
  - ☐ **Scope** select: `full` / `range` (from/to page inputs) / `surahs`
    (surah-**name** checklist, `max-h-56` scroll; "`common.loading`" until
    surahs load).
  - ☐ **Member picker** — checkboxes (disabled members labeled); empty roster →
    `emptyRoster`.
  - ☐ **Per-member capacity** (only for selected): pages + surah **name** select
    (first = `noSurah` "—") + juz. Defaults: solo reader ⇒ 1 juz; group member ⇒
    their roster `pagesPerDay` pages.
  - ☐ **Reciter** select (`reciterAuto` = rotation, else a selected member).
  - ☐ **Backfill**: created date (date input) + series number override.
  - ☐ Create (`admin.createButton`) → `createKhatma`.
- **Validation/errors:** ☐ `seriesNameRequired`, ☐ `selectMembers` (none
  chosen), ☐ `createError` (scope resolution / write failure).
- **Series logic:** ☐ matching name continues the series with the next number
  (`findSeriesByName`/`nextSeriesNumber`); new name ⇒ new `seriesId`, number 1;
  override wins when valid.
- **Persistence:** whole create form is draft-held; survives re-renders. Reset
  on successful create.

### 3.4 Khatma detail — `#/khatmas/{id}`

[`khatmaPage`](src/ui/admin/pages/khatma.ts). Sections: back link → header card
→ edit card → (active: members card + controls card | completed: completed
controls) → history card.

- **Header:** ☐ donut + title + status badge + facts line (remaining · round ·
  last distribution) + progress bar (completed = 100).
- **Edit card** (`editKhatmaHeading`): ☐ series name, ☐ number, ☐ created date;
  ☐ `saveKhatma` → `renameSeries` (whole series) + `updateKhatma`
  (number/date); status `admin.saved`. Draft keyed `editKhatma[id]`.
- **Members card** (active only, `membersProgress`): per member —
  - ☐ warning chip + `clearWarning` (clears streak across the series' active
    khatmas) when flagged;
  - ☐ **chunk chip**: state text (`chunkDone`/`chunkPending`/`chunkReleased`/
    `noChunk`) + page span; click toggles `markRoundDone`/`clearRoundDone`
    (title `markDone`/`undo`);
  - ☐ `returnToPool` (only if pending) → confirm `confirmReturnToPool` →
    `releaseMemberChunk`;
  - ☐ `removeFromKhatma` → confirm `confirmRemoveFromKhatma` →
    `removeMemberFromKhatma`;
  - ☐ **capacity editor** (pages + surah-name select + juz) → `saveCapacity` →
    `updateKhatma`;
  - ☐ **add-member row** (candidates not already in) — select + pages/surah/juz +
    `addMember` → `addMemberToKhatma`.
  - Loading: ☐ members list "`common.loading`" until assignments arrive.
- **Controls card** (active): ☐ reciter select → `updateKhatma(duaReciterId)`;
  ☐ `startNext` → prefilled next-in-series create form (jumps to `#/khatmas`);
  ☐ `markComplete` → confirm `confirmComplete` → `completeKhatma`; ☐ `remove` →
  confirm `confirmRemoveKhatma` → `deleteKhatma`.
- **Completed controls:** ☐ only `startNext`.
- **History card:** ☐ series' completed khatmas (`historyHeading`; active-with-
  none → `noCompleted`); line: title · `completedOn` date · reciter.
- **Not found:** ☐ khatmas empty → `common.loading`; loaded but missing →
  `admin.noActive`.
- **Persistence:** `editKhatma[id]` + `status[id]` drafts survive re-renders.

### 3.5 Settings — `#/settings`

[`settingsPage`](src/ui/admin/pages/settings.ts). Heading `admin.navSettings`.

- **Du3a editor** (`du3aEditorHeading`): ☐ textarea seeded from
  `content.du3aText`; ☐ **`du3aTouched` guard** — once edited, incoming content
  snapshots do **not** overwrite the field (RM-550); ☐ `save` → `setDu3aText`;
  status `admin.saved` / `admin.saveError`; clears touched on success.
- **Reading control:** ☐ shared `settingsControl` (same 1–5 scale as member).
- **Persistence:** du3a is draft (touched-aware) + Firestore; reading scale is
  localStorage.

---

## 4. Parity-critical behaviors (risk oracle)

Cross-referenced to the plan's Risk Register / tasks. These are the behaviors
most likely to regress in a naive React port — each needs an explicit test.

| # | Behavior | Where | Task |
| --- | --- | --- | --- |
| P1 | Reader instance survives unrelated Firestore ticks — **no page/scroll reset** | member render reader-key reuse | RM-440 |
| P2 | Admin drafts survive unrelated snapshots (create form, `editKhatma`, add-person) | `AdminDraft` | RM-550 |
| P3 | Du3a textarea `du3aTouched` guard blocks snapshot overwrite | admin settings | RM-550 |
| P4 | Search caret/focus preserved on keystroke re-render | roster | RM-550/RM-510 |
| P5 | Completion overlay **hides nav** and tears down the reader | member render | RM-430 |
| P6 | Member sees **only their own** warning; group view shows pending **names** but never others' warning levels | khatma landing | RM-410 |
| P7 | Same-day distribution blocked (`AlreadyDistributedError`); redistribute bypasses | home + data/distribution | RM-500 |
| P8 | Distribute button busy-disable prevents double-press | home | RM-500 |
| P9 | Listener sets: member = *my active* khatmas' assignments; admin = *active ∪ open* | both renders | RM-240 |
| P10 | Dynamic assignment sub reconciliation drops state when a khatma leaves the set | both `reconcileAssignmentSubs` | RM-240 |
| P11 | Reading scale is one shared localStorage-backed control across both apps | shared settings | RM-340/RM-540 |

## 5. Known baseline quirks — **do not silently "fix"**

Reproduce these as-is for true parity, or if the React version changes them,
**record it as an intentional delta** in RM-460/RM-570 (per plan §"do not hide
behavior changes"). Confirmed against source at HEAD `d3b277d`.

1. **Member khatmas list has no distinct loading state** — during the initial
   snapshot gap it shows the *empty* card (`member.noKhatmas`), because
   `myActiveKhatmas([])` is empty before data arrives (§2.2). Other member
   routes *do* distinguish loading (`loadingCard`) from not-found.
2. **Shell subscription errors are silent** — only the identity gate surfaces a
   connection error; all other listener failures are swallowed (§1.7).
3. **`admin.startNext` has no confirmation** despite an unused
   `admin.confirmStartNext` string existing — it jumps straight to the prefilled
   create form.
4. **Unused strings present in the catalog** (defined, zero UI references —
   verified): `member.openKhatma`, `member.rosterHeading`, `personal.myKhatmas`,
   `quran.sampleHeading`, `admin.progressLabel`, `admin.completedHeading`,
   `admin.confirmStartNext`, `admin.surahsPlaceholder`. Don't resurrect these as
   "parity"; don't delete them without noting it.
5. **Several admin mutations are fire-and-forget** (no success toast / no error
   surface): stepper `pagesPerDay`, enable/disable, chunk mark-done/undo, clear
   warning, save capacity, add member, reciter change. Only create/distribute/
   edit-save/du3a-save show status. Match this feedback granularity (or flag).
6. **Capacity/add-member/reciter selects on the detail page are read at click
   time** — their `onChange` is a no-op and the button reads `.value` when
   pressed (uncontrolled). A controlled React port must preserve the same "value
   applies only on the action button" semantics.

## 6. Responsive / RTL matrix (walk on mobile **and** desktop, both apps)

| Aspect | Mobile (< lg) | Desktop (≥ lg) |
| --- | --- | --- |
| Primary nav | bottom tab bar | right vertical rail (RTL right) |
| Content width | `max-w-xl`/`max-w-2xl` | `max-w-3xl`/`max-w-4xl`, `lg:pr-24` |
| Khatmas list (member) | 1 col | `md:grid-cols-2` |
| Reader chrome | sticky top, blur | same |
| Bottom clearance | `pb-28` | `lg:pb-8` |
| Direction | RTL (dialogs, selects, chips, icons, page indicators) | RTL |
| Reading scale | 5 levels via `<html data-reading-scale>` | same |

☐ RM-650 owns the full a11y/RTL/responsive QA pass (keyboard/focus, labels,
contrast, portals, senior-friendly sizing, safe areas).

## 7. Acceptance mapping (RM-020 exit)

RM-020 evidence = "Checklist covers every member/admin route, action,
loading/empty/error state, persistence behavior, and responsive state."

| Required dimension | Covered in |
| --- | --- |
| Every member route | §2.1–2.8 (6 hash routes + identity gate + completion overlay) |
| Every admin route | §3.1–3.5 (5 hash routes) |
| Actions | per-route **Actions** bullets |
| Loading / empty / error / not-found | per-route **States** bullets + §1.7 |
| Persistence | §1.3 table + per-route **Persistence** |
| Responsive / RTL | §1.2 + §6 + per-route **Responsive** |
| Parity risks / oracle | §4 |
| Baseline quirks to preserve | §5 |

**Next:** RM-115 (Tailwind→MUI token map) consumes §1–§3; RM-460/RM-570 walk the
`☐` boxes against the running React app.

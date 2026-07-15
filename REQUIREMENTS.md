# Quran Khatma Tracker — Requirements Document

## 1. Purpose

Replace a manual, WhatsApp-based process for organizing collective Quran khatmas
(group readings where the Quran's 604 pages are split among members over a
period, so the group collectively finishes it together). Today an admin
("mom") manually assigns pages per person per group and tracks who's read
what by hand. This app automates assignment and tracking, and gives members a
simple place to see their daily pages, read them, and see group progress.

Primary audience: **senior citizens, not tech-savvy**. Every user-facing
decision should default to the simplest, lowest-friction option. No accounts,
no passwords, no app-store installs for members.

## 2. Non-goals

- Not published to any app store. Distributed as a web link (e.g. hosted on
  GitHub Pages) shared in WhatsApp groups.
- No push notifications in v1 (reminders continue to happen via WhatsApp,
  outside the app, at the admin's discretion — the admin dashboard exists to
  tell her *who* to message, not to message them automatically).
- No translations/tafsir/audio recitation in v1 — classic Arabic Uthmani text
  only.
- No per-page checkboxes or granular reading UI — see §6.
- No custom server/API. No serverless functions (see §3). All logic runs in
  the browser (member app and admin app), talking directly to the database.
- No historical khatma archive/log and no per-person consistency
  (reliability) stats in v1 — explicitly deferred, see §10.

## 3. Tech stack & architecture

> **Note (React migration).** The UI stack below was originally specified as
> plain HTML + Tailwind CSS with no framework. It has since been migrated to
> **React + Material UI (MUI)**, and this section reflects the shipped stack. The
> static-site, no-server, Firestore-only, and layered-architecture requirements
> are unchanged. See [ARCHITECTURE.md](ARCHITECTURE.md) and the
> [migration tracker](docs/react-migration/TRACKER.md).

- **Language**: TypeScript everywhere — both the member-facing app and the
  admin app. No untyped JS.
- **UI**: **React + Material UI (MUI)**, with Redux Toolkit for state and React
  Router (hash routing) for navigation. This stays a static site
  buildable/deployable to GitHub Pages — there is still no custom server.
- **Theming**: a single centralized **MUI RTL theme** (design tokens: colors,
  spacing, font sizes, radii, breakpoints) plus a small set of retained global
  styles, all editable by the *developer* in one place (`src/theme/`) to restyle
  the whole app without touching individual screens. This is a developer-only
  concern — the admin never edits styling, only content (roster, khatmas,
  du3a text).
- **Code architecture**: clean, functional-oriented, clearly separated
  concerns, written to be easy for a future collaborator to pick up:
  - A data-access layer (typed functions wrapping all Firestore reads/writes
    — nothing else in the app talks to Firestore directly).
  - A domain/logic layer (pure functions: page-assignment algorithm,
    progress/insight calculations, validation) with no DOM or Firestore
    dependencies — easy to unit test in isolation.
  - A React presentation layer (components + routing + Redux) that calls into
    the above two layers, with no business logic embedded in it.
  - No hardcoded strings baked into components — all user-facing Arabic text
    lives in a single content module (`src/content/strings.ar.ts`), and screens
    render from it rather than inline copy.
- **Backend**: **Firebase (Firestore)**, chosen specifically because this
  is a first BaaS project for the developer — Firestore's client SDK is
  simple to drop into a plain TS/HTML site, has realtime listeners (so
  progress updates live without a manual refresh), and its free (Spark)
  tier is enough for this scale.
  - No Cloud Functions. The auto-assignment algorithm and all admin
    writes run as TypeScript in the admin's browser and write straight to
    Firestore. This avoids requiring a billing account (Cloud Functions
    need the paid Blaze plan even at $0 actual usage) and keeps the
    project server-free, matching the "no server to maintain" goal.
  - Security relies on Firestore security rules plus the admin panel's
    unguessable URL — there is no real authentication layer. Acceptable
    given the trust level and stakes of the group.
- **Quran text**: a static Arabic (Uthmani script) Quran dataset bundled
  directly into the app (no runtime dependency on a third-party API).
- **Client-side identity cache**: localStorage remembers which roster member
  a given browser/device belongs to, so the person only picks their name
  once per device (see §5).
- **Hosting**: static site (member app + admin app, e.g. as separate
  routes/pages within the same deployed site), suitable for GitHub Pages.

## 4. Roster & identity model

- One **global roster** of people, maintained by the admin, independent of
  any specific khatma/group. Each person is a single persistent record.
- **Names must be unique across the entire roster.** The admin cannot add
  two people with the same display name — the app enforces this at
  creation time. Any distinguishing detail (e.g. "husband of Sara") is
  stored as a separate metadata/note field, never as part of the name
  members tap to identify themselves.
- A khatma is created by picking a subset of members from this global
  roster. The same person can belong to multiple concurrent khatmas.
- Because identity is global and names are guaranteed unique, the app can
  track **one unified lifetime reading history per person**, across every
  khatma they've ever participated in, regardless of group.

### Member identification on the client (no login)

- When a member opens the app link for the first time on a device, they see
  a list of names and tap their own name.
- That choice is cached in localStorage. On future visits from the same
  device/browser, the app already knows who they are — no need to pick
  again.
- If localStorage is cleared, or it's a new device, they're prompted to pick
  their name again.
- **Trust-based, no PIN.** Anyone could tap the wrong name (by mistake or
  otherwise) and mark someone else's reading as done. This is accepted as
  low-risk given the audience (trusted community members).
- **Admin correction**: the admin view must let the admin manually
  correct/undo/clear a mistaken "read" mark for any person on any day, to
  fix accidental wrong-name taps.

## 5. Open-Ended, Round-Based Khatma Series

Khatmas belong to named series and operate without fixed schedules, durations, or start dates:

- **Open-Ended Lifecycle**: A khatma has no `startDate` or `durationDays`. It is completed only when all pages in its page scope are successfully read.
- **Named Series & Numbering**: Khatmas are organized into series with stable `seriesId` identifiers. As one khatma finishes, the next one continues the sequence (e.g., "أهل القرآن 1" → "أهل القرآن 2").
- **Admin-Triggered Daily Rounds**: Instead of split schedules, the admin manually triggers a daily distribution round by clicking a button. 
- **Auto-Flagging & Returned Pages**: 
  - Members who fail to finish their assigned pages before the next distribution round are flagged.
  - The first miss flags the member as **Yellow** (warning). A second consecutive miss flags them as **Red**.
  - Their unread pages are automatically returned to the remaining page pool. This ensures that low page numbers never lag and the pool remains sequential.
- **Rollover & Coexistence**:
  - When the oldest khatma's remaining page pool drains mid-distribution round, the system seals that khatma (N) and automatically spawns the next numbered khatma (N+1) under the same series.
  - Chunks never span two different khatmas; the member at the boundary receives a short chunk from N, and subsequent members draw from N+1.
  - Both khatmas N and N+1 coexist actively until N's pending chunks are fully read or released.
- **Warnings Carry Over**: Flagged warning states carry over to the new khatma during rollover, though the admin can clear streaks/warnings manually from the roster or active khatma page.

### Removed Features & Accepted Trade-offs
* **Coverage-aware Rotation**: On each khatma iteration, first-choice priority rotates by `seriesNumber`. Within the active pool, loose pages and whole-juz capacities prefer pages absent from that member's deduplicated `completedPages` history, then fall back to already-covered pages only when necessary. An explicitly configured surah remains fixed admin intent.
* **No Credit for Post-Release Reading**: If a member reads their pages after they have been released back to the pool, their work goes uncredited (their page assignment is marked as released).
* **Missed the Day is Missed the Round**: If the admin does not trigger a distribution on a given day, no warnings are generated. Missing a round is determined strictly at the moment of the admin's manual distribution action.
* **Removed**: Durations, leftover/volunteer logic, manual page regenerations, manual overrides of specific pages, and restart overlays.

## 6. Member Reading Flow (Member View)

On opening the app, an identified member sees:
- **Today's Pages**: Their assigned pages for the current round, grouped by series. A status line displays "الجولة N · بدأت {date}" instead of duration days.
- **Easy Confirm**: A single tap button to mark the round chunk done (`markRoundDone`). If their pages were already released, they see a gentle note: "تمت إعادة صفحاتك للمجموعة" ("Your pages were returned to the group").
- **Reading Mushaf**: Assigned pages are readable directly in-app.
- **Warning Banner**: A personalized banner appears at the top of their page if their streak is flagged (Yellow/Red warning background with gentle reminders).
- **Group Progress**: Shows which members have completed their readings in the current round and the names of readers who are still pending. Warning levels of other members are never visible to readers.
- **Series History**: Shows completed khatmas of this series with completion dates and reciter names.
- **Quran Browsing & Settings**: Access to the full 604-page mushaf and the font-size slider.

## 7. Khatma Completion — du3a2 al-khatma

- A single designated reciter rotates per khatma cycle to read the du3a.
- When a khatma completes, the reciter sees the du3a screen upon opening the app. Other members see a completion card naming the reciter.
- The global du3a text is admin-editable.

## 8. Routed Admin App

The admin app is a routed SPA with five main views:

1. **Home**:
   - Lists active series with overall completion metrics (donut charts and segmented bar charts showing done, pending, and remaining pages).
   - Shows warning chips and pending readers inside the exact khatma they belong to; each pending reader includes their assigned page ranges.
   - Each active khatma name links directly to its detail page and has its own **Distribute** action.
   - After a same-day distribution, **Redistribute pages** recalls only unread loose pages and runs the algorithm again; whole-surah and whole-juz allocations remain assigned.
2. **Roster**:
   - Roster CRUD (add/edit/delete members).
   - Set each person's daily capacity (`pagesPerDay`) and enabled status.
   - Search filter to query members by name client-side.
3. **Khatmas**:
   - Creation form (name, scope, members, reciter selection). If the name matches an existing series, it automatically increments the sequence number.
   - Lists all active and completed khatmas.
4. **Khatma Detail (`#/khatmas/{id}`)**:
   - Detailed status and reciter selection.
   - Member management (add/remove members, force mark-complete, delete).
   - Member assignment table: Lists member names, warning status, current round chunk status (done/pending/released), and admin buttons to manually force mark-done, clear-done, or clear warnings.
   - Series History: Complete list of prior completed khatmas in this series.
5. **Settings**:
   - Edit the global du3a text.
   - Shared font size control slider.

## 9. Out of Scope for v1 (Explicit Backlog)
- Consistency/reliability statistics.
- Push notifications or automated messaging (nudging remains manual via WhatsApp).
- Authentication (uses unguessable admin entry filename).
- Translations, tafsir, or audio.

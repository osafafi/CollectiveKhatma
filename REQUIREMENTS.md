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

- **Language**: TypeScript everywhere — both the member-facing app and the
  admin app. No untyped JS.
- **UI**: plain HTML + Tailwind CSS. No frontend framework (no React,
  Vue, Angular, etc.) — this stays a static site buildable/deployable to
  GitHub Pages.
- **Theming**: a single centralized theme (design tokens: colors,
  spacing, font sizes, radii) that the *developer* can edit in one place
  (e.g. a Tailwind config + a small set of CSS variables) to restyle the
  whole app without touching individual pages. This is a developer-only
  concern — the admin never edits styling, only content (roster, khatmas,
  du3a text).
- **Code architecture**: clean, functional-oriented, clearly separated
  concerns, written to be easy for a future collaborator to pick up:
  - A data-access layer (typed functions wrapping all Firestore reads/writes
    — nothing else in the app talks to Firestore directly).
  - A domain/logic layer (pure functions: page-assignment algorithm,
    progress/insight calculations, validation) with no DOM or Firestore
    dependencies — easy to unit test in isolation.
  - A UI layer (rendering + event wiring) that calls into the above two
    layers, with no business logic embedded in it.
  - No hardcoded strings/markup baked into HTML files — all user-facing
    Arabic text lives in a single source (e.g. a strings/content module),
    and HTML is generated/populated from TypeScript, not hand-authored with
    inline copy.
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

## 5. Khatma lifecycle

- Admin creates a khatma by specifying:
  - Total pages (default 604, editable in case of custom scope)
  - Duration (e.g. 7 days), start date
  - Members (selected from the global roster)
- **Automatic page assignment**, not manual entry:
  - Pages are split across the selected members **according to each person's
    daily page capacity** (`pagesPerDay`), not purely evenly (Stage 2 update):
    the admin sets how many pages a person can take per day when adding them and
    can adjust it any time; heavier readers get proportionally more.
  - A person can be **temporarily disabled** (e.g. menstruation) without being
    removed; disabled people are skipped by the assignment algorithm until
    re-enabled (Stage 2 update).
  - When the group's total daily capacity can't cover the scope, the **leftover
    unassigned pages are surfaced to the admin** to read herself or hand to a
    volunteer (Stage 2 update; see §8).
  - The admin can **regenerate the remaining days** at any time (after disabling
    someone or changing capacities); past/done days are preserved (Stage 2
    update — this is the client-side stand-in for a daily job, as there is no
    server).
  - Assignment must avoid repeating pages a given person has already
    *completed* reading in any past khatma (see §4), so that over many
    khatmas a person progressively covers the whole Quran in a segmented
    way (a personal "long-run full khatma").
  - Only pages explicitly marked "done" count as read for this
    rotation history. Pages assigned but never confirmed done remain
    eligible to be reassigned to that same person in a future khatma.
  - Admin can manually override any auto-generated assignment for
    exceptional cases.
- Khatmas do **not** auto-renew. When one ends, the admin explicitly starts
  the next one (choosing members/duration/pages fresh, allowing membership
  changes between cycles).
- Admin can run **multiple khatmas concurrently**, across different groups,
  with overlapping membership.

## 6. Daily reading flow (member view)

- On opening the app, a member (once identified) sees:
  - Their pages assigned **today**, for each khatma they're part of (if in
    more than one).
  - A single, large button: **"انتهيت من قراءة صفحاتي اليوم" ("I finished my
    pages today")** — one tap marks the whole day's assignment done. No
    per-page checkboxes.
  - The pages themselves are readable directly in-app (bundled Arabic text),
    not just referenced by number.
- Group progress view: shows which members have/haven't completed today's
  (or the khatma's overall) reading.
  - **Anonymous mode toggle**, set **per khatma** by the admin: when on,
    that khatma's progress is shown as counts/percentages only, never tied
    to member names.
- Full Quran browsing view: classic continuous reading, independent of any
  khatma assignment, for anyone who wants to read beyond their pages.
- **Insights shown to members** (kept intentionally simple for v1):
  - Per-khatma completion percentage (how much of the current khatma's
    total pages the group has completed so far).
  - Personal lifetime completion percentage (pages the member has
    personally completed across all khatmas ever, out of 604 — e.g. "You've
    personally read 210 of 604 pages — 35% of a full Quran, read in
    segments over time").
- **Settings popout**: a font-size slider with 5 discrete levels, applied
  across all reading views. This is a priority feature given the senior
  audience.

## 7. Khatma completion — du3a2 al-khatma

> **Stage 2 update:** the du3a is now recited by a **single designated person
> per khatma**, not acknowledged by everyone. The reciter **rotates** each
> khatma cycle (chosen at creation from that khatma's members, spreading the
> duty; the admin can override). On completion the reciter sees the du3a screen;
> everyone else sees a short note naming who will recite it.

- When all pages in a khatma have been read by the group, the app surfaces
  a "du3a2 al-khatma" screen to the **designated reciter**, the next time they
  open the app; other members see a completion note naming the reciter.
- This is an acknowledgment, not a gate: the khatma is already considered
  complete regardless of who has or hasn't seen the screen. The reciter reads
  the du3a and taps a single "Done" button to dismiss it.
- **The du3a text itself is admin-editable content, not hardcoded**: a
  single global text field, editable by the admin at any time from the
  admin panel, used for every khatma's completion screen (not per-khatma
  text).

## 8. Admin dashboard & capabilities

> **Stage 2 additions:** set/adjust each person's daily page capacity
> (`pagesPerDay`); temporarily disable/enable a person; per active khatma, see
> the **leftover unassigned pages** (and hand them to a volunteer) and
> **regenerate the remaining days**; change a khatma's du3a reciter; mark a
> khatma complete; and **restart** a completed one.

- Maintain the global roster (add/edit/remove people; enforce unique
  names; set each person's `pagesPerDay` capacity and their enabled/disabled
  state).
- Create/manage multiple concurrent khatmas, each with its own member
  subset, duration, and total pages.
- View auto-generated page assignments per khatma per day; manually
  override any assignment.
- View group progress per khatma (who's read/not read), with a per-khatma
  anonymous-mode toggle.
- Correct/undo/clear a mistaken "read" mark for any person, any day (to fix
  wrong-name taps).
- Edit the global du3a2 al-khatma text at any time.
- **Per-khatma status dashboard**: for every active khatma, the admin sees
  its overall state (days remaining, completion %) and an explicit list of
  members who still have unread pages, identified **by name** (anonymous
  mode does not apply to the admin's own view — it only hides names from
  other members). This list is always visible, not just near the deadline.
  - Visual urgency escalates as a khatma nears its end (e.g. the
    pending-readers list becomes more prominently flagged/highlighted on
    the khatma's last day or two), but pending readers are always shown
    from day one so the admin can nudge early if she wants.
  - This is purely informational — the admin manually messages people on
    WhatsApp herself; the app sends no notifications.
- No password — admin panel is reachable only via a separate, unguessable
  URL.

## 9. Out of scope for v1 (explicit backlog, not to be built now)

- Per-person consistency/reliability stats (e.g. who tends to finish late
  or miss days).
- ~~A browsable historical archive/log of past completed khatmas.~~ **Stage 2
  update:** a **lightweight** completed-khatmas list is now in scope — completed
  khatmas appear at the bottom of the admin page as simple lines (completion
  date · duration · du3a reciter), and a completed khatma can be **restarted**
  into a fresh cycle. Full browsable per-khatma history/detail is still deferred.
- Any push notifications or automated reminders.
- Translations, tafsir, or audio recitation of the Quran.
- Real authentication/accounts (PINs, passwords, per-person login links).

## 10. Open items to resolve during planning/build

Minor implementation details intentionally left for the build session:

- Exact Firestore data model (collections/documents) for roster, khatmas,
  daily assignments, and read-status — to be designed during planning.
- Exact wording/copy for all Arabic UI strings (beyond the two examples
  given here) — to be drafted during planning and centralized per §3's
  "no hardcoded strings" rule.
- Default/starter du3a2 al-khatma text to pre-fill for the admin (she can
  edit it immediately after).
- Exact visual treatment for "urgency escalation" on the admin dashboard
  (color, iconography) — a styling detail governed by the centralized
  theme in §3.

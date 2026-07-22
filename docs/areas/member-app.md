# Member app brick

Owns: identity gate, khatma list/landing, assigned pages, finish, completion, settings,
and member-to-admin feedback submission.

Start files:

- Entry/routes: `src/app/entries/member.tsx`, `src/app/member/MemberApp.tsx`
- Khatma UI: `src/app/member/KhatmasListPage.tsx`, `KhatmaLandingPage.tsx`,
  `src/app/member/khatma/`
- Reader: `src/app/member/reader/`
- Completion: `src/app/member/MemberCompletionInterrupt.tsx`
- Feedback form: `src/app/member/MemberFeedbackSection.tsx`
- Persistence: `src/app/persistence/browserPersistence.ts`

Reads: store selectors. Writes: `useWriteOperation`. Never import `data`.

Tests: `member-identity`, `member-khatma-routes`, `member-reader`,
`member-completion`, `member-personal-settings`, `member-integration`.

Hard rules:

- Member subscribes only to own active khatmas.
- Reader position survives unrelated live snapshots.
- Released chunk cannot be marked done.
- Completion interrupt hides normal nav until acknowledged.
- Other members' warning levels are never shown.
- Feedback is trimmed, must contain 10–500 characters, and creates a fresh unread
  document with the selected member id and current name on every submission.
- Keys: `khatma.memberId`, `khatma.readingScale`, `khatma.lastReadPage`,
  `khatma.themeMode` (shared with the admin entry), `khatma.du3aAck.${khatmaId}`.
- `MemberHero` shows the member name app-wide (greeting variant on lists,
  title variant on Settings); the khatmas list also shows a read-only
  "previous" section of completed khatmas the member took part in.
- The personal page groups every pending assignment from the selected member's
  active khatmas into its own linked gradient card. Each entry shows khatma
  artwork, the numbered series title, assigned page count/numbers, and opens
  that khatma's assigned reader directly; an empty message replaces the list
  when every current chunk is done.
- Settings order: appearance (light/dark toggle, the ONLY toggle location
  together with admin Settings) → reading size → avatar → feedback.
- Reader chrome is the slim gradient hero; group progress opens and series
  history collapses by default on the khatma landing (local state).
- Assigned-reader navigation follows RTL book direction: previous is on the
  right, next is on the left, and both enabled actions share the primary style.
- The assigned reader opens with a compact grid header: the daily-pages title
  sits above the member avatar and name in the center, khatma artwork sits above
  the numbered series title at the left, and the right page-total tile matches
  the artwork height.

Update this doc when member routes, subscriptions, reader, finish, or persistence changes.

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
  `khatma.du3aAck.${khatmaId}`.

Update this doc when member routes, subscriptions, reader, finish, or persistence changes.

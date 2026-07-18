# Distribution brick

Owns: round planning, assignment, warning streak, release, redistribution, rollover.

Start files:

- Pure plan: `src/domain/distribution.ts`
- Scope math: `src/domain/assignment.ts`
- Transaction: `src/data/distribution.ts`
- UI write door: `src/app/operations/writeOperations.ts`
- Admin trigger: `src/app/admin/pages/HomePage.tsx`
- Member result: `src/app/member/KhatmaLandingPage.tsx`

Flow: admin click -> operation -> Firestore transaction -> subscriptions -> store -> both apps.

Tests: domain `distribution`, `assignment`, `rotation`, `progress`; `admin-home`,
`admin-integration`, `member-khatma-routes`; emulator smoke for transaction changes.

Hard rules:

- Pending pages stay with reader and block a new chunk.
- Only admin release returns held pages.
- Remaining pages stay sorted.
- Same local date blocks a second normal distribution.
- Redistribution recalls unread loose pages only. Surah and juz pages stay held.
- Chunk never crosses khatmas. Rollover can leave N and N+1 active.
- Member warning level is private from other members.

Update this doc when planner, transaction, round state, or warning behavior changes.

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

- Pending pages stay with the reader and block a new chunk until the admin
  releases them or the member pauses themselves. An admin-only pause does not
  release held pages.
- A member self-pause atomically marks them disabled, releases every pending
  chunk they hold across active khatmas, resets those warning streaks, and merges
  the pages into each sorted pool.
- Remaining pages stay sorted.
- Loose-page distribution advances from the oldest remaining pages as a front
  block. It does not skip a page inside the block just because the selected
  reader completed that page in an earlier khatma.
- Ready readers are tiered clean before flagged. Within a tier, the planner first
  chooses the capacity that creates the fewest internal gaps in the next front
  block, then the reader with the lowest lifetime completed-page overlap;
  rotated roster order breaks ties.
- `capacities.surahs` is a Surah id and `capacities.juz` is a Juz number; each
  selected whole unit is pulled from wherever it remains in the pool, so an
  explicit whole-unit addition may make the final combined chunk non-consecutive.
- The khatma detail page derives selectable Surah capacities from the same
  page-to-Surah map: every page in the Surah unit must still be in
  `remainingPages`, so partially read or currently held Surahs are excluded.
- Same local date blocks a second normal distribution.
- Redistribution recalls and reassigns unread loose pages only among readers whose
  loose-page chunk was fully recalled. Finished readers receive nothing new;
  preserved Surah and Juz pages stay held.
- Chunk never crosses khatmas. Rollover can leave N and N+1 active.
- Marking a round done atomically clears that member's warning streak across
  every active khatma in the series, so a warning disappears as soon as the
  member finally completes their held pages.
- Member warning level is private from other members.

Update this doc when planner, transaction, round state, or warning behavior changes.

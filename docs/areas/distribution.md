# Distribution brick

Owns: round planning, assignment, warning streak, release, redistribution, rollover.

Start files:

- Pure plan: `src/domain/distribution.ts`
- Preview/revision model: `src/domain/distributionDraft.ts`
- Scope math: `src/domain/assignment.ts`
- Transaction: `src/data/distribution.ts`
- UI write door: `src/app/operations/writeOperations.ts`
- Admin trigger: `src/app/admin/pages/HomePage.tsx`
- Member result: `src/app/member/KhatmaLandingPage.tsx`

Flow: admin prepares a frozen series preview -> adjusts constrained decisions ->
confirms -> Firestore transaction rebuilds/revision-checks the preview ->
subscriptions -> store -> both apps.

Tests: domain `distribution`, `assignment`, `rotation`, `progress`; `admin-home`,
`admin-integration`, `member-khatma-routes`; emulator smoke for transaction changes.

Hard rules:

- Pending pages stay with the reader and normally block a new chunk until the
  admin releases them or the member pauses themselves. A reader with
  `Person.holdPages` enabled keeps receiving one new chunk per distribution;
  every unread round remains assigned and their warning streak still advances.
  An admin-only pause does not release held pages.
- Quran pages 1 and 2 are free loose pages: they remain assigned from the front
  of the pool but do not consume loose-page capacity. A capacity of two at the
  beginning of the Quran therefore receives pages 1–4.
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
- The admin explicitly starts each round. `lastDistributionDate` is display/audit
  metadata only; it is not a 24-hour or same-date business rule.
- A confirmed series-wide `DistributionRun` is `open` until the next run closes
  it. A current-round adjustment increments that run's revision. New assignment
  chunks reference the run and have an explicit `pending`, `completed`, or
  `released` status; legacy `doneByRound`/`released` fields remain readable.
- The preview covers every active N/N+1 khatma in the series and shows exact
  allocations, retained pending pages, releases, skips, and rollover. The admin
  sees proposed assignments first; optional collapsed controls allow including
  or excluding a reader, changing that round's loose-page capacity, and choosing
  keep/release/add for pending pages.
- Proposed chunks can swap recipients only within the same khatma. Compatible
  recipients have exactly equal loose-page capacities and matching Surah/Juz
  capacity settings. The swap moves the whole proposed chunk and never exposes
  raw page ownership.
- Confirm is atomic and rejects a stale `sourceRevision`; crossing from N to N+1
  needs an explicit acknowledgment on the same decision screen. The transaction
  validates rollover metadata only when the rebuilt plan actually crosses that
  boundary, so unused next-khatma metadata cannot block an ordinary round. The
  revision canonicalizes Firestore map keys and lifetime-page set order, so
  semantically identical listener and transaction snapshots compare equally.
- Current-round adjustment recalls and reassigns unread loose pages only among readers whose
  loose-page chunk was fully recalled. Finished readers receive nothing new;
  preserved Surah and Juz pages stay held. The reshuffle stays in the current
  round, does not increment `roundCount`, and cannot roll over into a new khatma.
- Chunk never crosses khatmas. Rollover can leave N and N+1 active.
- Marking accumulated pages done stamps every pending round in that assignment,
  clears the member's warning streak across every active khatma in the series,
  and leaves `Person.holdPages` unchanged. That preference is persistent and is
  changed only when the member or an admin toggles it manually. Manual release,
  redistribution, and a member self-pause recall every accumulated pending loose
  chunk rather than leaving older held pages behind.
- Member warning level is private from other members.

Update this doc when planner, transaction, round state, or warning behavior changes.

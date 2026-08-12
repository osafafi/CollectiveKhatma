# People brick

Owns: roster, identity, name, note, avatar, pause, default pace.

Start files:

- Admin UI: `src/app/admin/pages/RosterPage.tsx`
- Member UI: `src/app/member/MemberIdentity*`, `src/app/member/SettingsPage.tsx`
- Rules: `src/domain/validation.ts`, `src/domain/personAppearance.ts`
- Read/write: `src/app/store/rosterSlice.ts` -> `src/app/operations` -> `src/data/roster.ts`

Flow: screen -> operation -> data -> Firestore -> subscription -> store -> both apps.

Also hits: distribution eligibility, per-khatma capacity defaults, lifetime pages.

Tests: `admin-roster`, `member-identity`, `member-personal-settings`, `validation`,
`person-appearance`, `foundation-behavior`.

Hard rules:

- Normalized names are unique. Note is separate from name.
- `pagesPerDay` is a default. Actual round amount is khatma capacity.
- Paused person gets no new pages. When a member pauses themselves, every pending
  chunk they hold in an active khatma is released back to its pool in the same
  transaction as the roster flag. An admin pause only changes eligibility and
  leaves existing pages in place.
- Deleting a roster person first removes them from every active or completed
  khatma, returning their non-released assignment pages and clearing their
  capacity, assignment, and reciter references. The roster document is deleted
  only after every khatma cleanup succeeds.
- Active khatma details keep disabled participants at the bottom with
  struck-through names. The admin can re-enable an existing participant without
  changing their capacity. Disabled people outside that khatma are not listed.
- Browser remembers person as `khatma.memberId`. No login. Trust model.
- Admin roster rows show a derived 0–10 reliability grade without persisting a
  person field. Completed, non-released history contributes 70% from the
  longest local-calendar reading-day streak (full credit at 30 days) and 30%
  from average completed pages per reading day across khatmas (full credit at
  10 pages/day); the result is capped and rounded to one decimal. Grades below
  5 use a red badge, 5 through 8 use orange, and 8 through 10 use a gold
  badge with a star.
- Each admin roster member stays in one bounded row split into two responsive
  subrows: rename, remove, and score above; name, capacity, and activation below.
  The lower subrow stacks its fields on phones and uses one line from `sm` up.

Update this doc when person fields, identity, pause, or avatar flow changes.

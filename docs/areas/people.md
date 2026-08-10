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

Update this doc when person fields, identity, pause, or avatar flow changes.

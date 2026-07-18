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
- Paused person gets no new pages. Existing pages stay.
- Browser remembers person as `khatma.memberId`. No login. Trust model.

Update this doc when person fields, identity, pause, or avatar flow changes.

# Khatmas brick

Owns: series, create/edit, scope, members, capacities, image, reciter, history.

Start files:

- List/create route: `src/app/admin/pages/KhatmasPage.tsx`
- List/create parts: `src/app/admin/khatmas/`
- Detail: `src/app/admin/pages/KhatmaPage.tsx`, `src/app/admin/khatma/`
- Rules: `src/domain/types.ts`, `src/domain/assignment.ts`, `src/domain/series.ts`
- Writes: `src/app/operations` -> `src/data/khatmas.ts`

Flow: admin draft -> operation -> data -> Firestore -> store -> admin/member cards.

Also hits: distribution, member landing, artwork catalog, Firestore rules.

Tests: `admin-khatmas`, `admin-khatma`, `admin-draft-stability`,
`admin-integration`, domain assignment/rotation/progress.

Hard rules:

- Every newly created khatma and automatic rollover covers the complete Quran:
  full scope, 604 pages, and an initial pool of pages 1–604. The legacy
  `range`/`surahs` scope variants remain readable so existing data does not
  break, but the create UI, data adapter, and Firestore writes require full
  Quran khatmas.
- Every member has additive `{ pages, surahs, juz }` capacity, where `surahs`
  selects one Surah id and `juz` selects one Juz number (`1..30`; `0` means none).
- On an active khatma's detail page, Surah capacity menus offer only Surahs whose
  complete page unit is still in that khatma's unread, unassigned pool.
- Active khatma member lists show enabled participants first, then only disabled
  participants who belong to that khatma. Disabled participants stay visible with
  struck-through names and an activation action. Disabled roster people outside
  the khatma are not listed. The add-member form follows all participant rows and
  is visually separated from them.
- Every active-khatma participant row exposes the member's global
  `احتفظ بصفحاتي` switch, using the same roster preference as the member's
  personal page.
- An active khatma with unread pool pages exposes a confirmed admin action that
  assigns the entire remaining pool to one current participant. The participant
  select defaults to the admin roster id and remembers later choices in
  `khatma.admin.remainderAssigneeId`.
- Khatmas never keep roster ids that no longer resolve. After complete roster and
  khatma snapshots load, the admin app automatically removes legacy ghost members
  from every khatma, returning their non-released pages and deleting their
  capacity and assignment. Removing the designated reciter selects the first
  remaining member or clears the reciter when the khatma becomes empty.
- Completed khatmas stay for series history.
- The admin Khatmas list shows all active rounds. For a series with no active
  round, it shows only the latest completed round as the history entry point.
- N and N+1 may both be active during rollover.
- Image is a filename from `public/khatma-images/`; missing means placeholder.

Update this doc when khatma shape, create/detail flow, or lifecycle changes.

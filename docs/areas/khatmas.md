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

- Scope kind is `full`, `range`, or `surahs`.
- Every member has additive `{ pages, surahs, juz }` capacity, where `surahs`
  selects one Surah id and `juz` selects one Juz number (`1..30`; `0` means none).
- Completed khatmas stay for series history.
- The admin Khatmas list shows all active rounds. For a series with no active
  round, it shows only the latest completed round as the history entry point.
- N and N+1 may both be active during rollover.
- Image is a filename from `public/khatma-images/`; missing means placeholder.

Update this doc when khatma shape, create/detail flow, or lifecycle changes.

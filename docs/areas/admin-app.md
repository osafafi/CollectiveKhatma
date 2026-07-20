# Admin app brick

Owns: dashboard, roster, khatma list/detail, settings, admin navigation.

Start files:

- Entry/routes: `src/app/entries/admin.tsx`, `src/app/admin/AdminApp.tsx`
- Pages: `src/app/admin/pages/`
- Feature parts: `src/app/admin/khatma/`, `src/app/admin/khatmas/`
- Reads: `src/app/store/`
- Writes: `src/app/operations/`

Flow: route page selects data -> feature component -> operation -> data adapter.

Tests: all `tests/app/admin-*`, routing, operations, store, integration.

Hard rules:

- Feature UI never imports `src/data`.
- Firestore data lives in Redux. Drafts, dialogs, caret, and busy state stay local.
- Drafts survive live snapshots. Reset only after successful submit.
- Busy distribution blocks double press.
- Dashboard warnings are grouped per khatma in a count-labelled accordion that
  is collapsed by default.
- Admin assignment subscriptions cover active khatmas plus open detail.
- The Khatmas list hides completed rounds already represented by a later or
  active round, retaining only the last round of a fully ended series.
- Admin URL is obscure, not secure. No auth.

Update this doc when admin route, page ownership, draft, or subscription scope changes.

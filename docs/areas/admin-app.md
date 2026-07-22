# Admin app brick

Owns: dashboard, roster, khatma list/detail, settings, admin navigation, and the
member feedback inbox.

Start files:

- Entry/routes: `src/app/entries/admin.tsx`, `src/app/admin/AdminApp.tsx`
- Pages: `src/app/admin/pages/`
- Feature parts: `src/app/admin/khatma/`, `src/app/admin/khatmas/`
- Feedback inbox: `src/app/admin/AdminFeedbackInbox.tsx`
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
- The feedback listener is retained only by the mounted admin shell. Its header
  badge counts unread messages; the top drawer lists every message and supports
  read/unread, clipboard copy, and confirmed deletion. Drawer height is controlled
  by `ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT` (default 70).
- The Khatmas list hides completed rounds already represented by a later or
  active round, retaining only the last round of a fully ended series.
- The shell hero owns the route title as the page `h1` (pages dropped their own
  heading; the khatma detail keeps its series-name `h1`) and hosts the feedback
  bell in its action slot.
- Admin Settings includes the shared appearance (light/dark) card; the choice
  persists in `khatma.themeMode`, shared with the member entry.
- Admin URL is obscure, not secure. No auth.

Update this doc when admin route, page ownership, draft, or subscription scope changes.

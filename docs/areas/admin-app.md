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
- The dashboard exposes one series-level round-control surface after all active
  N/N+1 khatma blocks. “Prepare next round” and “Adjust current round” open a
  single decision screen with proposed assignments visible immediately; no
  write happens before confirmation.
- The preview stays frozen across live snapshots. Its main surface lists exact
  page ranges, recipients, target khatma, and rollover. Participation,
  per-round page capacity, pending-page policy, and skipped-reader details live
  in collapsed optional sections so the common path remains short.
- The round-control dialog has no flat visual sections: its shell, title,
  summary, optional controls, proposed assignments and rows, skipped/release
  notices, rollover confirmation, and action footer use the shared token-based
  emerald/gold/card gradients to make section boundaries scannable.
- An assignment row offers “swap pages with” only when another proposed
  recipient is in the same khatma and has exactly equal loose-page, Surah, and
  Juz capacity settings. The admin swaps whole proposed chunks;
  there is no raw page-ownership editor.
- Same-day starts remain available because distribution dates are informational.
  Rollover is planned automatically and requires an explicit acknowledgment;
  zero-change or stale previews explain why confirmation cannot proceed, and a
  rollover-metadata mismatch is distinguished from a changed live snapshot.
- Busy distribution blocks double press. Success closes the dialog and is
  announced on the dashboard; failure remains in the dialog for review/retry.
- Round controls stay disabled until every active khatma's assignment listener
  is ready; an unloaded collection is never previewed as an empty one.
- Dashboard warnings are grouped per khatma in a count-labelled accordion that
  is collapsed by default.
- Each dashboard khatma groups retained round assignments into separate
  count-labelled, collapsed pending and completed accordions. Pending rows show
  the member's latest readable assignment; completed rows do the same, even when
  that assignment belongs to an older round. Both show the actual round, member
  avatar/name, and exact page ranges. Released chunks appear in neither list.
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

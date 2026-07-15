# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                         |
| ------------------------------------- | ----------------------------------------------------- |
| Integration branch                    | `reactmigration`                                      |
| Branch base                           | `6992007` (`main` at migration start)                 |
| Last completed code tasks             | RM-640 and RM-650                                     |
| Last completed code commit            | Pending completion commit (based on `ae7546a`)        |
| Active migration task                 | None                                                  |
| Current phase                         | Phase 6 — cutover, cleanup, and end-to-end validation |
| Next recommended task                 | RM-670 — Update all project documentation             |
| Authorization-gated task              | RM-660 — staging/live smoke test                      |
| Open decisions affecting current work | OD-04 by RM-740                                       |
| Last updated                          | 2026-07-15                                            |

RM-640 added durable two-client emulator coverage for realtime writes,
distribution, completion, reload/reconnect, and listener cleanup. RM-650 fixed
focus-ring and tinted-status contrast, and pinned keyboard, portal RTL, and
responsive shell behavior.

## Completed validation — RM-640

- Two production-source clients observed the same roster/khatma writes,
  assignment distribution, round completion, and automatic khatma completion.
- A fresh client restored exactly one completed round; a released client ignored
  later writes and stayed idle.
- The gated emulator test passed locally and cleaned up only its isolated data.

## Completed QA — RM-650

- Keyboard navigation follows the logical RTL tab order. Portalled dialogs use
  RTL styling, autofocus the primary action, close by Escape, and restore focus.
- Focus ring contrast is 3.06:1–3.22:1; success/warning text on tinted statuses
  is 5.42:1–5.97:1.
- Mobile contracts retain a full-width bottom bar and 112px content clearance;
  desktop retains a 96px full-height right rail and 32px bottom padding.
- Prior live 375px/1280px member/admin walks remain valid because RM-620/RM-630
  changed only retired UI and chunking. A fresh browser rerun was URL-policy
  blocked after an initial pre-server failure, so no new visual claim was made.

## Verification

- Typecheck/build — passed.
- Lint — passed.
- Default tests — 39 files passed, 1 skipped; 225 passed, 1 skipped.
- Gated emulator journey — 1 test passed.
- Production budget gate — member 341.59/387.75 kB; admin 344.72/390.98 kB.
- Vite emits no oversized-chunk warning; diff whitespace is clean.

## Next-session options

### RM-670 — Update all project documentation

1. Read this file, Phase 6 in `TRACKER.md`, and tasks RM-620/RM-630/RM-640/RM-650.
2. Claim RM-670 and reconcile user/developer documentation with the final React
   implementation, local emulator flow, production entries, and validation.

### RM-660 — Authorized staging/live smoke test

Do not start without explicit project-owner authorization. If authorized, read
Phase 6 and `PLAN.md` governance first; do not deploy from the migration branch.

## Risks / constraints

- RM-660 requires explicit authorization before any staging/live reads or writes.
- Do not deploy from the migration branch or expose/rename `admin-nano.html`.
- The member budget has 8.41 kB JS gzip and 12.25 kB transfer headroom.

## Claim protocol

Flip only the selected next task to `IN PROGRESS`, create/update its task record,
rewrite this file for active scope/read set/risks, and run a focused baseline.

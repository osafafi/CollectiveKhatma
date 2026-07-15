# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                         |
| ------------------------------------- | ----------------------------------------------------- |
| Integration branch                    | `reactmigration`                                      |
| Branch base                           | `6992007` (`main` at migration start)                 |
| Last completed task                   | RM-670 — documentation reconciliation                 |
| Last completed code commit            | `5cf3d8c` (RM-640 + RM-650; RM-670 hash recorded next) |
| Active migration task                 | None                                                  |
| Current phase                         | Phase 6 — cutover, cleanup, and end-to-end validation |
| Next recommended task                 | RM-700 — final clean quality suite (Phase 7)          |
| Authorization-gated task              | RM-660 — staging/live smoke test                      |
| Open decisions affecting current work | OD-04 by RM-740                                       |
| Last updated                          | 2026-07-15                                            |

RM-670 reconciled the living user/developer documentation with the shipped
React + MUI implementation. Phase 6 code and QA (RM-620–RM-650) are complete;
only the authorization-gated staging smoke test (RM-660) remains in Phase 6.

## Completed — RM-670 (documentation)

- `REQUIREMENTS.md` §3 now documents the React + MUI + Redux + React Router stack
  (with a migration note); the static-site / no-server / Firestore / layered
  requirements are unchanged.
- `ARCHITECTURE.md` directory map and Firestore data model match `types.ts`
  (added `Khatma.capacities`, `RoundChunk.loosePages`/`redistributedPages`, the
  `content/global` collection) and its `## Security` section is restored, so the
  README `#security` anchor resolves again.
- `PROGRESS.md` no longer links the deleted `src/domain/schedule.ts`; its Next
  Steps repoint at the tracker. The `CLAUDE.md` file map lists `persistence`,
  `content.ts`, `validation.ts`, and `fonts/`.
- Root `REACT_MIGRATION_*.md` files left intact as labeled historical artifacts
  (RM-020/RM-110/RM-115 oracles) or a still-correct router.

## Verification (documentation-only per PLAN matrix)

- Link/path review — every relative markdown link in the edited docs resolves to
  a real file; README/ARCHITECTURE anchors resolve.
- `npx prettier --check` — passes for all edited docs.
- `git diff --check` — clean.

## Next-session options

### RM-700 — Final clean quality suite (Phase 7)

1. Read this file, Phase 7 in `TRACKER.md`, and `PLAN.md` verification matrix.
2. Claim RM-700, then run a clean install plus typecheck, lint, all tests, build,
   and CI, recording results. RM-700 now depends only on completed tasks
   (RM-630, RM-640, RM-650, RM-670).

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

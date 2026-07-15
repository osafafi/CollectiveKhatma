# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                    |
| ------------------------------------- | ------------------------------------------------ |
| Integration branch                    | `reactmigration`                                 |
| Branch base                           | `6992007` (`main` at migration start)            |
| Last completed task                   | RM-700 — final clean quality suite (Phase 7)     |
| Last completed commit                 | `8026f8c` (RM-700 final clean quality suite)     |
| Active migration task                 | None                                             |
| Current phase                         | Phase 7 — merge readiness and controlled handoff |
| Next recommended task                 | RM-710 — review delta against current `main`     |
| Authorization-gated task              | RM-660 — staging/live smoke test                 |
| Open decisions affecting current work | OD-04 by RM-740                                  |
| Last updated                          | 2026-07-15                                       |

RM-700 ran the complete quality suite from a clean install and it is green end to
end: `npm ci`, typecheck, lint, all tests, build, and bundle budgets all pass,
mirroring CI on the Node 24 LTS line. No source changes were needed. Phase 6 code
and QA remain complete; only the authorization-gated staging smoke test (RM-660)
sits outside the Phase 7 merge path.

## Completed — RM-700 (final clean quality suite)

- Clean install: `npm ci` — 1032 packages, ~55 s, exit 0.
- `npm run typecheck` — clean. `npm run lint` — clean.
- `npm test` — 39 files passed, 1 skipped; 225 tests passed, 1 skipped.
- `VITE_FIREBASE_PROJECT_ID=demo-khatma npm run build` — built, no oversized-chunk
  warning. `node scripts/check-bundle-budgets.mjs` — both surfaces within budget
  (member 341.59/387.75 kB, admin 344.72/390.98 kB).
- `git diff --check` — clean. Details in `tasks/RM-700.md`.
- Non-blocking: `EBADENGINE` (local `v24.14.0` vs. pinned `24.18.0`; CI runs
  `24.18.0` via `.nvmrc`) and 9 moderate dev-tooling advisories (accepted
  Firebase-tooling risk in `PLAN.md`). No dependency/source change made.

## Next-session options

### RM-710 — Review delta against current `main`

Reconcile all changes since base `6992007` against current `main` without
unrelated overwrite. Depends on RM-700 (now DONE). Read set: this file,
`tasks/` records as needed, TRACKER Phase 7, and `PLAN.md` merge-readiness gates.

### RM-660 — Authorized staging/live smoke test

Do not start without explicit project-owner authorization. If authorized, read
Phase 6 and `PLAN.md` governance first; do not deploy from the migration branch.

## Risks / constraints

- RM-660 requires explicit authorization before any staging/live reads or writes.
- Do not deploy from the migration branch or expose/rename `admin-nano.html`.
- The member budget has 8.41 kB JS gzip and 12.25 kB transfer headroom.
- Local runner is `v24.14.0`; CI pins `24.18.0` via `.nvmrc`. Keep them aligned.

## Claim protocol

Flip only the selected next task to `IN PROGRESS`, create/update its task record,
rewrite this file for active scope/read set/risks, and run a focused baseline.

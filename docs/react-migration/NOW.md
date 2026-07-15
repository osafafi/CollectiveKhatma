# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                    |
| ------------------------------------- | ------------------------------------------------ |
| Integration branch                    | `reactmigration`                                 |
| Branch base                           | `6992007` (`main` at migration start)            |
| Last completed task                   | RM-720 — joint code/behavior review              |
| Last completed commit                 | `0e62d29` (RM-720 review and fixes)              |
| Active migration task                 | None                                             |
| Current phase                         | Phase 7 — merge readiness and controlled handoff |
| Next recommended task                 | RM-730 — merge summary and rollback plan         |
| Authorization-gated task              | RM-660 — staging/live smoke test                 |
| Open decisions affecting current work | OD-04 by RM-740                                  |
| Last updated                          | 2026-07-15                                       |

RM-720 reviewed the integrated migration across dependency boundaries,
subscription lifecycle, member/admin parity and stability, production
reachability, living documentation, and residual risks. Three low-severity
findings were fixed; no blocking code/behavior finding remains. All 225 default
tests and both production bundle budgets pass.

## Completed — RM-720 (joint code/behavior review)

- Boundaries: Firebase SDK imports remain exclusive to `src/data`; domain stays
  pure; writes/listeners flow through the app adapters; Redux stays serializable.
- Lifecycle/parity: reference counting, errors, cleanup, remote updates, reader
  stability, admin drafts, RTL/accessibility, and both route inventories trace to
  implementation plus focused/full tests and earlier emulator/live-local QA.
- Hygiene: every implementation module is production-reachable; previews remain
  intentional non-deployable aliases; root migration artifacts remain labeled
  historical evidence. Living-doc links resolve.
- Fixes: corrected stale auto-return documentation, centralized the reader surah
  heading, and connected the typed route-link module to production admin links.
- Verification: typecheck, lint, 225 tests, production build, and budgets pass.
  Final sizes: member 341.60/387.76 kB; admin 344.76/391.02 kB.

## Next — RM-730 (merge summary and rollback plan)

1. `docs/react-migration/NOW.md`
2. `docs/react-migration/tasks/RM-720.md`
3. TRACKER Phase 7
4. `PLAN.md` governance, verification matrix, risks, decisions, and
   merge-readiness gates

Prepare a concise owner-facing summary covering the migration delta,
verification, final bundles, preserved data/domain compatibility, residual
risks, rollback steps, and explicit RM-740 authorization boundary. Do not merge.

## Risks / constraints

- RM-660 requires explicit authorization before any staging/live reads or writes.
- Do not deploy from the migration branch or expose/rename `admin-nano.html`.
- Do not merge to `main`; OD-04 remains open for RM-740.
- The member budget has 8.40 kB JS gzip and 12.24 kB transfer headroom.
- Local runner is `v24.14.0`; CI pins `24.18.0` via `.nvmrc`. Keep them aligned.

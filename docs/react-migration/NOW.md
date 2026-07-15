# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                        |
| ------------------------------------- | ---------------------------------------------------- |
| Integration branch                    | `reactmigration`                                     |
| Branch base                           | `6992007` (`main` at migration start, still unmoved) |
| Last completed task                   | RM-730 — merge summary and rollback plan             |
| Last completed commit                 | `61022ba` (RM-730 merge summary and rollback plan)   |
| Active migration task                 | None                                                 |
| Current phase                         | Phase 7 — merge readiness and controlled handoff     |
| Next recommended task                 | RM-740 — owner approval and merge (owner-gated)      |
| Authorization-gated task              | RM-660 — staging/live smoke test                     |
| Open decisions affecting current work | OD-04 (merge method) by RM-740                       |
| Last updated                          | 2026-07-15                                           |

RM-730 produced the owner-facing merge summary and rollback plan
([`MERGE_SUMMARY.md`](MERGE_SUMMARY.md)) and checked the "Rollback plan is
credible" merge-readiness gate. **All agent-executable migration work is now
complete.** The only remaining actions are owner-gated: RM-740 (approval + merge)
and, if authorized, RM-660 (live smoke test).

## Completed — RM-730 (merge summary and rollback plan)

- Deliverable [`MERGE_SUMMARY.md`](MERGE_SUMMARY.md): migration delta, preserved
  data/domain compatibility, fresh verification, final bundles, residual risks,
  rollback plan, and the RM-740 authorization boundary.
- Rollback basis: no data migration (schema/rules/indexes/domain/data byte-
  unchanged), concrete restore point `6992007`, static Pages deploy → rollback is
  one revert + redeploy in minutes. Recommends a single revertable merge commit
  (OD-04 input) over pure fast-forward.
- Fresh verification at `7ba078c` (code-identical to RM-720's run): typecheck,
  lint, 225 tests (1 emulator skip), and both bundle budgets pass. Member
  341.60/387.75 kB; admin 344.76/391.01 kB.
- Only one merge-readiness gate remains open: explicit owner approval (RM-740).

## Next — RM-740 (owner approval and merge to `main`) — OWNER-GATED

Not an agent-executable task. Requires explicit project-owner authorization.

Read set if resuming migration context:

1. `docs/react-migration/NOW.md`
2. `docs/react-migration/MERGE_SUMMARY.md`
3. `docs/react-migration/tasks/RM-730.md`
4. TRACKER Phase 7 and PLAN merge-readiness gates + OD-04

At RM-740 the owner: selects the OD-04 merge method (merge commit / squash /
reviewed PR — `MERGE_SUMMARY.md` recommends a single revertable commit), decides
whether to authorize RM-660 first, and approves the merge. Agents must not merge,
deploy, or resolve OD-04 without that authorization.

## Risks / constraints

- RM-660 requires explicit authorization before any staging/live reads or writes;
  the live production path is otherwise unproven (emulator + automated suite only).
- Do not merge to `main`, force-push shared branches, deploy from the migration
  branch, or expose/rename `admin-nano.html`.
- OD-04 (merge method) remains open for RM-740.
- The member budget has 8.40 kB JS gzip and 12.25 kB transfer headroom.
- Local runner is `v24.14.0`; CI pins `24.18.0` via `.nvmrc`. Keep them aligned.

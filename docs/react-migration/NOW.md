# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                    |
| ------------------------------------- | ------------------------------------------------ |
| Integration branch                    | `reactmigration`                                 |
| Branch base                           | `6992007` (`main` at migration start)            |
| Last completed task                   | RM-710 — review delta against current `main`     |
| Last completed commit                 | _pending handoff-hash commit (RM-710)_           |
| Active migration task                 | None                                             |
| Current phase                         | Phase 7 — merge readiness and controlled handoff |
| Next recommended task                 | RM-720 — joint code/behavior review              |
| Authorization-gated task              | RM-660 — staging/live smoke test                 |
| Open decisions affecting current work | OD-04 by RM-740                                  |
| Last updated                          | 2026-07-15                                       |

RM-710 reviewed the full delta of `reactmigration` against `main`. `main` is
still at the base `6992007` (0 commits to reconcile), so there is no unrelated
overwrite; the branch fast-forwards into `main` conflict-free. The 226-file delta
(+20,847/−4,352) is all intentional migration work, and the preserved layers
(domain, data, Quran content, Firestore rules/indexes) are unchanged.

## Completed — RM-710 (delta review)

- Topology: base `6992007` = current `main`; `reactmigration` HEAD `f32c847`
  descends linearly (56 commits); `git rev-list --count reactmigration..main` = 0;
  FF-able into `main`.
- Delta: 179 A / 28 D / 19 M. Deletions are pure legacy (`src/ui/` tree,
  `admin.ts`/`member.ts`, `theme.css`, 2 legacy UI tests). Additions are the React
  app/tests/docs/toolchain. Modifications are config, docs, entry HTML, theme.
- Preserved: `src/domain`, `src/data`, `src/content/quran`, `firestore.rules`,
  `firestore.indexes.json` all unchanged. `strings.ar.ts` is additive UI strings
  only; `seed-emulator.ts` is a comment-only fix. No secrets/artifacts added; OD-01
  honored (production build = `index.html` + `admin-nano.html` only). Detail in
  `tasks/RM-710.md`.

## Next-session options

### RM-720 — Joint code/behavior review

Depends on RM-710 (DONE). Jointly review boundaries, subscriptions, parity, dead
code, docs, and risks. Read set: this file, `tasks/RM-710.md`, TRACKER Phase 7,
`PLAN.md` merge-readiness gates. Carry-forwards from RM-710: confirm the two dev
preview entries and root `REACT_MIGRATION_*.md` artifacts are the intended
retained set (dev/historical by design, not orphaned legacy).

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

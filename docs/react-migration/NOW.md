# React Migration — Current State

> **Always-read migration file.** Keep this file below 150 lines. Replace stale
> handoff material instead of appending history.

## Snapshot

| Field                                 | Current value                                         |
| ------------------------------------- | ----------------------------------------------------- |
| Integration branch                    | `reactmigration`                                      |
| Branch base                           | `6992007` (`main` at migration start)                 |
| Last completed code task              | RM-630 — Optimize and document bundles                |
| Last completed code commit            | Working tree on `cf11a52`                             |
| Active migration task                 | None                                                  |
| Current phase                         | Phase 6 — cutover, cleanup, and end-to-end validation |
| Next recommended task                 | RM-640 or RM-650 (independent validation lanes)       |
| Open decisions affecting current work | OD-04 by RM-740                                       |
| Last updated                          | 2026-07-15                                            |

RM-620 removed the framework-free bootstraps, `src/ui/**`, Tailwind, and
obsolete router tests while preserving React-owned global styles/assets. RM-630
split the oversized shared runtime into stable production chunks and moved the
budget gate from preview aliases to the deployable production manifest.

## Completed bundle result — RM-630

- Largest chunks: Firebase 483.78 kB raw, MUI/Emotion 311.22 kB, shared
  React/application runtime 298.08 kB. Vite emits no oversized-chunk warning.
- Member: 341.44 kB initial JS gzip / 387.60 kB transfer (350/400 kB limits).
- Admin: 344.57 kB initial JS gzip / 390.82 kB transfer (375/425 kB limits).
- Route-lazy loading was prototyped and rejected: it saved only about 1% while
  adding an asynchronous loading phase to every non-default route.
- Typecheck, lint, 221 tests + 1 skipped, production build, focused entry/app
  tests, budget checks, and diff whitespace checks pass.

## Next-session options

### RM-640 — Emulator cross-client validation

1. Read this file, Phase 6 in `TRACKER.md`, and `tasks/RM-630.md`.
2. Claim only RM-640 and create its task record.
3. Use two clients against the emulator to verify realtime reads/writes,
   distribution/completion, reload/reconnect, and listener cleanup.

### RM-650 — Accessibility, RTL, responsive QA

1. Read this file, Phase 6 in `TRACKER.md`, and `tasks/RM-620.md`.
2. Claim only RM-650 and create its task record.
3. Walk keyboard/focus/labels/contrast/direction/portals/sizing/layouts across
   member and hidden admin surfaces at mobile and desktop widths.

## Risks / constraints

- The member budget has only 8.56 kB JS gzip and 12.40 kB transfer headroom;
  keep the production-manifest gate on every dependency or entry change.
- Do not rename/expose the hidden admin entry or add a member-app link.
- RM-660 requires explicit owner authorization before any staging/live reads or
  writes. Do not deploy from the migration branch.

## Claim protocol

Flip only the selected next task to `IN PROGRESS`, create its task record,
rewrite this file for active scope/read set/risks, and run the smallest useful
baseline check.

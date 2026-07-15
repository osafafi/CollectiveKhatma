# React Migration — Merge Summary and Rollback Plan

> Owner-facing decision document for RM-740. Prepared by RM-730. **This document
> does not merge anything.** Merging `reactmigration` into `main` requires explicit
> project-owner approval (RM-740) and an OD-04 merge-method decision.

## 1. What is being merged

The member and admin UIs are migrated from framework-free TypeScript + Tailwind
CSS to **React 19 + Material UI (Emotion RTL) + Redux Toolkit**, on Vite, with the
Firebase/Firestore data layer, pure domain logic, and Quran content preserved.

| Fact                            | Value                                               |
| ------------------------------- | --------------------------------------------------- |
| Migration base / current `main` | `6992007` — **unchanged since migration start**     |
| `reactmigration` HEAD           | `7ba078c`                                           |
| Commits ahead of `main`         | 60                                                  |
| Commits `main` is ahead         | 0 — **fast-forwardable, conflict-free**             |
| Delta since base                | 228 files, **+21,126 / −4,354** (181 A, 28 D, 19 M) |

Delta composition (full detail in [`tasks/RM-710.md`](tasks/RM-710.md)):

- **Added (181):** React application (`src/app`, `src/components`, `src/theme`),
  React test suites (`tests/`), `docs/react-migration/` records, toolchain
  (`.nvmrc`, `scripts/check-bundle-budgets.mjs`), dev-only preview entries
  (`react-preview.html`, `admin-react-preview.html`), and the labeled historical
  root `REACT_MIGRATION_*.md` artifacts.
- **Deleted (28):** legacy only — the whole `src/ui/` DOM tree, legacy entry
  helpers `src/admin.ts` / `src/member.ts`, `src/theme/theme.css`, and two legacy
  UI tests. This is the RM-620 legacy/Tailwind removal.
- **Modified (19):** toolchain/config (`ci.yml`, `deploy.yml`, `eslint.config.js`,
  `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `package.json`,
  `package-lock.json`, `.gitignore`), living docs, both production entry HTMLs
  (`index.html`, `admin-nano.html`), `src/theme/reading.ts`, additive UI strings
  in `src/content/strings.ar.ts`, and a comment-only fix in
  `scripts/seed-emulator.ts`.

## 2. Preserved data/domain compatibility

Confirmed byte-unchanged between base `6992007` and HEAD `7ba078c` (re-verified
this pass — the diff touches none of these paths):

- `src/domain/` — pure business logic (calculators, types, distribution engine).
- `src/data/` — the Firebase/Firestore boundary.
- `src/content/quran/` — Quran text and metadata.
- `firestore.rules` and `firestore.indexes.json` — schema shape, security rules,
  and indexes.

**Implication for the merge:** there is **no data migration**. The Firestore
schema, invariants, security rules, and stored documents are identical. Data
written by the React app is schema-identical to data the legacy app produced and
consumed, so both UIs interoperate against the same live database. This is the
foundation of the low-risk rollback in section 6.

## 3. Verification (fresh, 2026-07-15, at `7ba078c`)

The handoff commit `7ba078c` changed only documentation, so this tree is
code-identical to the RM-720 full-suite run at `0e62d29`. Re-run clean here:

| Check                          | Result                                                 |
| ------------------------------ | ------------------------------------------------------ |
| `npm run typecheck`            | pass                                                   |
| `npm run lint`                 | pass                                                   |
| `npm test`                     | 39 files passed, 1 skipped; **225 tests pass**, 1 skip |
| `npm run check:bundle-budgets` | build passes; both surfaces within budget (section 4)  |

The single skipped test is emulator-gated (two-client realtime), covered
separately by the RM-640 local emulator cross-client validation.

## 4. Final bundle sizes

Hard cutover ceilings from OD-02; measured on the production build:

| Surface | Initial JS gzip |  Transfer | JS budget | Transfer budget | JS headroom |
| ------- | --------------: | --------: | --------: | --------------: | ----------: |
| Member  |       341.60 kB | 387.75 kB |    350 kB |          400 kB |     8.40 kB |
| Admin   |       344.76 kB | 391.01 kB |    375 kB |          425 kB |    30.24 kB |

Shared/split chunks (gzip): `vendor-firebase` 143.09 kB, `vendor-mui` 96.63 kB,
`bootstrap` 98.18 kB; member entry 6.27 kB, admin entry 9.47 kB. The member
surface has the tightest headroom — future member additions must respect the
budget gate.

## 5. Residual risks

| Risk                                                            | Standing                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live/production Firebase never exercised (RM-660 `NOT STARTED`) | Requires explicit owner authorization. Validation to date: full automated suite + RM-640 local emulator two-client run. The live prod read/write path is unproven. |
| Hidden admin URL (`admin-nano.html`) is unauthenticated         | Accepted existing design; React is not a security change. Do not rename or expose it.                                                                              |
| Member bundle headroom is only 8.40 kB JS gzip                  | Budget gate enforces it in CI; watch member-side additions.                                                                                                        |
| Local Node `24.14.0` vs CI/deploy pin `24.18.0`                 | Both Node 24 LTS; CI and deploy use the `.nvmrc` pin. Keep local aligned.                                                                                          |
| Firebase tooling dev advisories                                 | Production audit clean; accepted monitoring risk, not a force-fix.                                                                                                 |

## 6. Rollback plan

**Rollback is UI-only and needs no data reversal.** Because the schema, rules,
indexes, domain, and data layers are unchanged (section 2), reverting the UI does
not require unwinding any data or rule migration — the pre-migration app reads and
writes the same live database.

**Rollback target:** commit `6992007` is a complete, previously-deployed,
known-good legacy app. It is a concrete, well-defined restore point, not a
reconstruction.

**Deployment mechanism** ([`deploy.yml`](../../.github/workflows/deploy.yml)): a
push to `main` runs typecheck/lint/test, builds the static site, deploys
`firestore.rules`, then deploys GitHub Pages — serialized under one `production`
concurrency group. The site is fully static; there is no server or database state
to roll back. Firestore rules are unchanged in this delta, so a rollback redeploys
byte-identical rules (no rule regression to reverse).

### Procedure

1. **Detect** a regression on the live member entry (`index.html`) or admin entry
   (`admin-nano.html`).
2. **Create the revert**, depending on the OD-04 merge method:
   - **Merge commit (recommended):** `git revert -m 1 <merge-commit>` — one clean
     revert commit.
   - **Squash:** `git revert <squash-commit>`.
   - **Fast-forward:** no single commit to revert; either revert the range or reset
     `main` to `6992007` (a force-push, which PLAN discourages). _Because rollback
     ease depends on this, prefer merge-commit or squash over pure fast-forward —
     this is input to OD-04._
3. **Verify the revert** locally: `npm ci && npm run build` succeeds and produces
   the two production entries.
4. **Promote** the revert to `main` per owner policy. The push triggers
   `deploy.yml`, which rebuilds and redeploys the legacy static site plus the
   identical Firestore rules.
5. **Confirm** the restored member and admin entries load and read live data
   (schema-compatible by section 2).
6. **Retain** `reactmigration`; it is preserved as the migration record, so a later
   re-cutover is a re-merge after fixing the regression — not a rebuild.

**Time-to-rollback:** one revert commit plus a GitHub Pages redeploy (minutes). No
data or rule migration to unwind.

**Pre-merge safety:** `main` has never advanced, so the merge is a conflict-free
fast-forward candidate — the lowest-risk merge shape. The primary risk window is a
post-deploy UX regression, mitigated by the parity/QA evidence (RM-460, RM-570,
RM-640, RM-650, RM-700, RM-720) and by the trivial static rollback above.

## 7. RM-740 authorization boundary

- RM-730 prepares this summary and rollback plan **only**. It does not merge,
  deploy, touch staging/live Firebase, or resolve OD-04.
- Merging `reactmigration` into `main` requires **explicit project-owner
  approval** (RM-740). The owner also chooses the OD-04 merge method (merge commit,
  squash, or reviewed PR); section 6 recommends a single revertable commit.
- The owner should decide whether to authorize and run **RM-660** (live/production
  smoke test) before promoting to `main`.
- No force-push to shared migration branches. Do not deploy from `reactmigration`.

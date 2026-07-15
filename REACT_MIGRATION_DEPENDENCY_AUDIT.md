# React Migration Dependency Audit (RM-110)

Snapshot date: 2026-07-13

Repository baseline: `reactmigration` at `d12d291`

Manifest audited: `package.json` and the root package in `package-lock.json`

## Outcome

All 15 existing direct dependencies have an explicit disposition. Eight have a
same-major registry refresh available and should move together with the RM-120
toolchain install. Five are already current and should be retained. TypeScript
and the Node types must stay on their present major lines. The two Tailwind
packages remain only for legacy-screen coexistence and are removed at RM-620
after MUI replaces their styling role.

RM-110 changes no dependency declaration or lockfile. This is deliberate: the
safe refresh group belongs with RM-120's reproducible install and verification,
while the Tailwind removal belongs with the RM-620 cutover. There is no blind
all-major upgrade.

## Classification

`npm outdated --json --long` supplied installed, wanted, and latest registry
versions. A package absent from that output was current on the snapshot date.

| Package | Installed | Wanted / latest | Used by | Classification and decision |
| --- | ---: | ---: | --- | --- |
| `firebase` | 12.15.0 | 12.16.0 / 12.16.0 | Browser Firestore modules in `src/data/**` | **UPDATE + KEEP.** Take the same-major refresh in RM-120 and retain as the application data SDK. |
| `@eslint/js` | 10.0.1 | 10.0.1 / 10.0.1 | Recommended flat-config rules in `eslint.config.js` | **KEEP.** Already current; retain on ESLint major 10. |
| `@tailwindcss/vite` | 4.3.2 | 4.3.2 / 4.3.2 | Tailwind Vite plugin in `vite.config.ts` | **REMOVE LATER.** Already current. Keep while legacy screens coexist, then remove the plugin and its Vite config entry at RM-620. |
| `@types/node` | 24.13.3 | 24.13.3 / 26.1.1 | Node APIs in configs and scripts | **KEEP / REJECT MAJOR.** 24.13.3 is the latest release on the Node 24 type line. Do not install major 26 while runtime is pinned to Node 24.18.0. |
| `eslint` | 10.6.0 | 10.7.0 / 10.7.0 | `npm run lint` and flat config | **UPDATE + KEEP.** Take 10.7.0 in RM-120; retain as the lint runner. |
| `eslint-config-prettier` | 10.1.8 | 10.1.8 / 10.1.8 | Final conflict-disabling config in `eslint.config.js` | **KEEP.** Already current and still required alongside ESLint and Prettier. |
| `firebase-admin` | 14.1.0 | 14.1.0 / 14.1.0 | Emulator seed script | **KEEP.** Already current; server-only tooling, never browser-bundled. |
| `firebase-tools` | 15.22.4 | 15.23.0 / 15.23.0 | Emulator and Firestore-rule deploy scripts | **UPDATE + KEEP.** Take 15.23.0 in RM-120 and continue using the repo-local CLI. |
| `prettier` | 3.9.4 | 3.9.5 / 3.9.5 | `npm run format` | **UPDATE + KEEP.** Take the patch refresh in RM-120. |
| `tailwindcss` | 4.3.2 | 4.3.2 / 4.3.2 | `@import 'tailwindcss'` and legacy utility classes | **REPLACE / REMOVE LATER.** MUI theme/components replace its styling role, but Tailwind remains through coexistence and is removed only at RM-620. |
| `tsx` | 4.23.0 | 4.23.1 / 4.23.1 | TypeScript data-build and emulator-seed scripts | **UPDATE + KEEP.** Take the patch refresh in RM-120. |
| `typescript` | 6.0.3 | 6.0.3 / 7.0.2 | Typecheck, build, scripts, and all source | **KEEP / REJECT MAJOR.** Stay on 6.0.3 during the React migration. TypeScript 7 is outside `typescript-eslint`'s supported peer range and requires its own upgrade project. |
| `typescript-eslint` | 8.62.1 | 8.63.0 / 8.63.0 | TypeScript parsing and rules in `eslint.config.js` | **UPDATE + KEEP.** Take 8.63.0 in RM-120; keep coupled to supported ESLint and TypeScript majors. |
| `vite` | 8.1.3 | 8.1.4 / 8.1.4 | Dev server, multi-page production build, aliases | **UPDATE + KEEP.** Take the patch refresh in RM-120. React support adds `@vitejs/plugin-react`; it does not replace Vite. |
| `vitest` | 4.1.9 | 4.1.10 / 4.1.10 | Unit-test runner and `vitest.config.ts` | **UPDATE + KEEP.** Take the patch refresh in RM-120. RM-130 will add the DOM/component-test environment without replacing Vitest. |

## Update groups and timing

### Group A — same-major refresh during RM-120

- `firebase` 12.15.0 → 12.16.0
- `eslint` 10.6.0 → 10.7.0
- `firebase-tools` 15.22.4 → 15.23.0
- `prettier` 3.9.4 → 3.9.5
- `tsx` 4.23.0 → 4.23.1
- `typescript-eslint` 8.62.1 → 8.63.0
- `vite` 8.1.3 → 8.1.4
- `vitest` 4.1.9 → 4.1.10

These versions are allowed by the existing caret ranges. RM-120 should refresh
the lockfile once while adding the React/MUI/Redux packages, then run clean
install, dependency-tree, typecheck, lint, test, and build verification. Treat
same-major as lower risk, not as permission to skip that suite.

### Group B — retain current versions

- `@eslint/js` 10.0.1
- `eslint-config-prettier` 10.1.8
- `firebase-admin` 14.1.0
- `@types/node` 24.13.3 (latest Node 24 line)
- `typescript` 6.0.3

The first three are registry-current. The final two are compatibility pins, not
stale dependencies.

### Group C — replace/remove only at RM-620

- `tailwindcss` 4.3.2: MUI replaces its styling role.
- `@tailwindcss/vite` 4.3.2: remove when no Tailwind CSS import or legacy utility
  class remains.

Do not remove either package during RM-120/RM-130: legacy pages still import
Tailwind and must remain buildable throughout screen-by-screen migration.

## Compatibility and breaking-change guardrails

1. **TypeScript 7 is blocked.** Registry metadata for
   `typescript-eslint@8.63.0` declares `typescript >=4.8.4 <6.1.0`; TypeScript
   7.0.2 is incompatible. A future TypeScript-major task must wait for parser and
   plugin support and must re-run the entire type/lint/test/build suite.
2. **Node types follow the runtime.** Registry `latest` for `@types/node` is
   26.1.1, but the application runtime is exactly Node 24.18.0. Installing Node
   26 types would expose APIs that production and CI do not guarantee.
3. **The lint stack moves as a unit.** `typescript-eslint@8.63.0` accepts ESLint
   10 and TypeScript 6, so the proposed ESLint 10.7.0 refresh is compatible.
   Keep `@eslint/js` on major 10 and verify the flat config after refreshing.
4. **The build/test stack remains peer-compatible.** Vite 8.1.4 supports Node
   24; Vitest 4.1.10 accepts Vite 8 and Node 24; `@tailwindcss/vite` 4.3.2 accepts
   Vite 8. These checks do not cover the React plugin added in RM-120, which must
   be verified when selected.
5. **Tailwind removal is a code migration, not package housekeeping.** RM-620
   must remove `@import 'tailwindcss'`, the Vite plugin entry, and remaining
   utility-class dependencies in the same verified cutover.
6. **Use the pinned runtime for lockfile evidence.** This audit shell was Node
   24.14.0 / npm 11.9.0 rather than the pinned Node 24.18.0. It was sufficient
   for read-only registry metadata, but RM-120 must generate and verify the
   lockfile on Node 24.18.0.

## Evidence

- `npm run typecheck` — passed before the audit.
- `npm ls --depth=0` — exited successfully; the local install also reported
  extraneous transitive WASM packages. RM-120's pinned-runtime clean install
  must remove or explain them before accepting the dependency tree.
- `npm outdated --json --long` — registry snapshot for all direct packages;
  exit status 1 is expected when outdated packages are reported.
- `npm view @types/node@24 version --json` — confirmed 24.13.3 is the newest
  Node 24 type release.
- `npm view` metadata for TypeScript, typescript-eslint, ESLint, Vite, Vitest,
  Tailwind's Vite plugin, Firebase, and Firebase Tools — confirmed the engine and
  peer ranges used in the guardrails above.
- Local import/config/script inspection — confirmed every direct package's role
  and the Tailwind coexistence requirements.

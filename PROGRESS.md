# Progress & Next Steps

Living status doc tracking the development of the collective Quran khatma tracker.

- Product spec → [REQUIREMENTS.md](REQUIREMENTS.md)
- Design, layers, data model, security → [ARCHITECTURE.md](ARCHITECTURE.md)
- Setup / run / deploy → [README.md](README.md)

**Last updated:** 2026-07-15 — Both production entries now mount React. Legacy
DOM renderers and Tailwind have been removed; final bundle and migration
validation work is tracked in `docs/react-migration/TRACKER.md`.

---

## Where We Are

The open-ended round-based product and React member/admin applications are
implemented across the domain, data, state, and presentation layers.

### Completed Features

1. **Domain Layer (Pure & Tested)**:
   - [types.ts](src/domain/types.ts): Defined shapes for `Khatma`, `Assignment`, `RoundChunk`, and `WarningLevel`.
   - [distribution.ts](src/domain/distribution.ts): Core round planner settles pending chunks (re-pooling missed pages), orders members, handles mid-round rollovers to N+1, and identifies completed khatmas.
   - [series.ts](src/domain/series.ts): Utilities for series grouping, titles, and next number calculations.
   - [progress.ts](src/domain/progress.ts): Progress calculations based on round counts and done/released pages.
   - [assignment.ts](src/domain/assignment.ts): Resolves a page scope to a flat page pool. Obsolete duration math, schedule checks, and legacy generators were pruned during the round-based redesign.
   - [rotation.ts](src/domain/rotation.ts) / [validation.ts](src/domain/validation.ts): First-choice rotation by `seriesNumber` and shared input validation.
   - Tests: comprehensive planner logic in [distribution.test.ts](tests/domain/distribution.test.ts).

2. **Data-access Layer**:
   - [distribution.ts](src/data/distribution.ts): Implemented transactional `runDistribution` with same-day distribution blocks, atomic writes, and rollover setup.
   - [assignments.ts](src/data/assignments.ts) / [khatmas.ts](src/data/khatmas.ts): Adapted queries and setters for round-based schemas.
   - [firestore.rules](firestore.rules): Upgraded shape validation matching the new structures.

3. **Shared React UI**:
   - Typed hash routing in [routes.ts](src/app/routing/routes.ts).
   - Theme-aware SVG charts under [components/charts](src/components/charts).
   - Dynamic PNG icon overrides under [components/icons](src/components/icons) using runtime probes.

4. **Admin Dashboard (SPA Shell + Pages)**:
   - Home Tab: Display metrics per series, warning chips, and the Distribute button.
   - Roster Tab: CRUD members, adjust capacities, and toggle statuses. Include client-side search.
   - Khatmas Tab: Creation wizard for starting/continuing series.
   - Khatma Detail: Tabulated member overview with force controls, warning clearing, and series history.
   - Settings Tab: Edit global du3a content.

5. **Member Dashboard**:
   - Show current round details, warning banners, and completed series history cards.
   - Tighter layout styling for the mushaf reader.

---

## Verification & Testing

Verify that everything compiles and tests pass:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### Local Emulator Validation (Manual Check)

1. Run emulators: `npm run emulators`
2. Seed initial data: `npm run seed`
3. Launch dev environment: `npm run dev`
4. Access Member app: `http://localhost:5173/`
5. Access Admin app: `http://localhost:5173/admin-nano.html`

---

## Next Steps

The remaining React-migration work is tracked in
[`docs/react-migration/TRACKER.md`](docs/react-migration/TRACKER.md):

1. **Authorized staging/live smoke test (RM-660)** — with explicit project-owner
   authorization only, run a pass against a live Firestore project rather than the
   local emulator, and deploy rules with `npm run deploy:rules`. Do not deploy
   from the migration branch.
2. **Merge readiness (RM-700–RM-740)** — final clean quality suite, delta review
   against `main`, joint code/behavior review, merge summary + rollback plan, and
   owner-approved merge.

Pre-release operational checklist (unchanged by the migration):

- **Icons**: dropping custom PNG files into `public/icons/` should replace the
  default SVG graphics at runtime.
- **Security slug**: change `admin-nano.html` and its `ADMIN_ENTRY` mapping in
  `vite.config.ts` to a random secret slug before release, and never link to it
  from the member app.

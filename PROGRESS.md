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
   - [assignment.ts](src/domain/assignment.ts) / [schedule.ts](src/domain/schedule.ts): Pruned obsolete duration math, schedule checks, and legacy generators.
   - Tests: 48 passing tests including comprehensive planner logic in [distribution.test.ts](tests/domain/distribution.test.ts).

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

1. **Staging / Production Testing**:
   - Run a thorough pass against a live Firestore project rather than the local emulator (`VITE_USE_EMULATOR=false`).
   - Deploy rules: `firebase deploy --only firestore:rules --project collectivekhatma`.
2. **Icons Customization**:
   - Verify that dropping custom PNG files into `public/icons/` correctly replaces the default SVG graphics.
3. **Security Slug Setup**:
   - Change `admin-nano.html` and its mapping in `vite.config.ts` to a random secret slug prior to final release.

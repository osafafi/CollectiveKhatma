# Progress & Next Steps

Living status doc so a new session can start without scanning the whole project.
**Update the "Last updated" line and the relevant sections at the end of each session.**

- Product spec → [REQUIREMENTS.md](REQUIREMENTS.md)
- Design, layers, data model, security → [ARCHITECTURE.md](ARCHITECTURE.md)
- Setup / run / deploy → [README.md](README.md)

**Last updated:** 2026-07-09 — Member app restructured into a **mobile-web-app shell**: bottom tab bar (Quran · Khatmas · Personal · Settings) that becomes a right-side rail on tablets, **per-khatma landing pages**, and the **in-app mushaf reader** (assigned-pages flow + full-mushaf browse). Adaptive phone/tablet layout throughout. 57 tests green; **verified end-to-end against the Firestore emulator** (identity → read → finish → insight, all four tabs, responsive 375/1024).

---

## Where we are

Stage 1 done. **Stage 2 (features) mostly built:** the pure **domain** and **data-access** layers and the **admin app** are implemented; **member daily flow** works. Latest round (2026-07-09) restructured the **member app** into a mobile-web-app shell (bottom tab bar → side rail on tablets), added **per-khatma landing pages**, and built the **in-app mushaf reader** (both assigned-pages reading and full-mushaf browsing) — closing the last major member-facing gap. Everything is now **adaptive across phone and tablet**. The prior round (2026-07-07) added capacity-weighted assignment, leftover-page tracking, temporary disable, rotating du3a reciter, and mark-complete → restart. Remaining: real-project (non-emulator) Firestore pass and the backlog in §9.

## Done (Stage 2 so far)

- **Domain (pure, tested):**
  - [assignment.ts](src/domain/assignment.ts) — `generateAssignments()` (even split, best-effort rotation away from each member's `completedPages`, contiguous when no history) + `resolvePageScope()` (full / page-range / whole-chapters via the surah→pages map).
  - [schedule.ts](src/domain/schedule.ts) — UTC date math: `currentDayIndex`, `daysRemaining`, `isWithinKhatma`, `isFinalStretch` (admin urgency), `lastDay`.
  - [progress.ts](src/domain/progress.ts) — `khatmaProgress` (group % + `complete`), `pendingForDay`/`pendingReaders` (admin §8), per-assignment helpers, `lifetimePercent`.
  - Tests: [assignment](tests/domain/assignment.test.ts), [schedule](tests/domain/schedule.test.ts), [progress](tests/domain/progress.test.ts).
- **Data-access (realtime + writes):**
  - [khatmas.ts](src/data/khatmas.ts) — `subscribeKhatmas`, `getKhatma`, `createKhatma` (batch: khatma doc + one assignment doc per member), `updateKhatma`, `deleteKhatma` (cascades subcollection).
  - [assignments.ts](src/data/assignments.ts) — `subscribeAssignments`, `getAssignment`, `markDayDone` (**transaction**: stamp day + `arrayUnion` pages into `completedPages`), `clearDayDone` (admin correction, inverse), `overrideAssignment`.
  - [firestore.rules](firestore.rules) — now shape-validates khatma + assignment writes (lenient types; **not yet emulator-tested** — verify before next deploy).
- **Member app** — a **hash-routed, tabbed mobile-web-app shell** ([render.ts](src/ui/member/render.ts)): identity gate, then a persistent **bottom tab bar** ([nav.ts](src/ui/member/nav.ts)) that promotes to a **right-side rail on tablets** (`lg:`). Tabs: **Khatmas** (list → [per-khatma landing page](src/ui/member/pages/khatmas.ts): today's pages, one-tap `markDayDone`, group progress, pending names) · **Quran** (full-mushaf browse) · **Personal** ([insight + switch-person](src/ui/member/pages/personal.ts)) · **Settings** (font slider). Framework-free reactive loop; the reader instance is cached so background Firestore ticks never rebuild it.
  - **In-app mushaf reader** ([reader.ts](src/ui/member/reader.ts)) — one component, two modes: **assigned** (a khatma's pages for today + inline "finished") and **browse** (all 604 pages, surah/juz/page jump, last-read resume). Renders surah headers + Bismillah, ayah medallions (`ayahEndMarker`), and sajda marks over the bundled dataset via `loader.getPage`; sizes with the reading slider. Tiny hash [router.ts](src/ui/shared/router.ts) (unit-tested) + SVG [icons.ts](src/ui/shared/icons.ts) + shared [components.ts](src/ui/member/components.ts).
  - **Verified end-to-end against the emulator:** identity → khatma landing → read assigned pages → finish (`markDayDone` writes; reader survives the live update) → lifetime insight updates; browse jump + resume; all four tabs; responsive at 375 (bottom bar) and 1024 (side rail), no horizontal scroll; zero console/server errors.

## Done (Stage 1)

- **Toolchain:** Vite 8 multi-page app (member `index.html`, admin `admin-nano.html`), TypeScript 6 strict, Tailwind v4 (`@theme` tokens), Vitest, ESLint flat config **with layer guardrails**, Prettier.
- **Layered `src/`:** `data/` (only Firebase importer) · pure `domain/` · `content/` (strings + quran) · `theme/` · `ui/`. Boundaries enforced by ESLint (`npm run lint` fails if crossed).
- **Firebase:** client init + emulator wiring ([src/data/firebase.ts](src/data/firebase.ts)), [firestore.rules](firestore.rules), [firebase.json](firebase.json), emulator seed ([scripts/seed-emulator.ts](scripts/seed-emulator.ts)).
- **CI/CD:** [.github/workflows/ci.yml](.github/workflows/ci.yml) (typecheck+lint+test+build) and [deploy.yml](.github/workflows/deploy.yml) (GitHub Pages).
- **Quran data:** full Madinah / KFGQPC Hafs mushaf — 604 page JSON + `surahs.json` + `index.json` under [public/quran/](public/quran/), generated by `npm run build:quran` ([scripts/build-quran-data.ts](scripts/build-quran-data.ts)). Amiri Quran font bundled; ayah medallions + waqf/sajda symbols render; text reflows. No runtime Quran-API dependency.
- **Walking skeleton:** member page renders theme + strings + live roster + Quran page 1; admin placeholder renders. Verified via build + browser preview.

## Verify quickly

```bash
npm install
npm run typecheck && npm run lint && npm test && npm run build   # all green
npm run dev                                                      # http://localhost:5173
```

**Local dev is fully emulator-based (works today):** `npm run emulators` (Firestore + UI) then `npm run seed`, then `npm run dev`. The seed creates a roster, the du3a, **and a sample active khatma with generated assignments**, so the member app shows real "today" data immediately.

## Managing local data yourself (no admin UI needed)

- **Emulator UI** — http://127.0.0.1:4000/firestore — point-and-click add/edit/delete of any doc.
- **`npm run seed`** — reproducible dataset from [scripts/seed-emulator.ts](scripts/seed-emulator.ts) (idempotent; skips collections that already have data).
- **Project-id alignment (important):** the emulator keys data by project id. [.firebaserc](.firebaserc) pins the CLI/emulator to `collectivekhatma`, which is also what the app (`.env`) and the seed use — so the UI, the app, and the seed all read/write the **same** store. If you change the app's project id, change all three.

## Environment / gotchas

- **Firebase project:** `collectivekhatma` (in `.env`, gitignored). `.env.example` is the template; [.firebaserc](.firebaserc) pins the CLI default.
- **Emulator vs real:** `VITE_USE_EMULATOR=true` (current) → emulator; set `false` to point `npm run dev` at the real project (writes real data — later).
- **Rules deploy separately:** `firebase deploy --only firestore:rules --project collectivekhatma` (GitHub Pages only hosts static files).
- **Admin gate = obscure filename only, no auth.** Currently `admin-nano.html` — **change to a long random slug** in BOTH the filename and `ADMIN_ENTRY` in [vite.config.ts](vite.config.ts) before sharing publicly.
- **Firestore rules validate shape only, not identity** (no auth by design) — see [ARCHITECTURE.md](ARCHITECTURE.md#security).
- **Seed** targets the emulator only; for the real project add a `roster` doc via the Firebase Console.

## Data model (proposed — see ARCHITECTURE.md)

`roster/{id}` Person · `khatmas/{id}` Khatma · `khatmas/{id}/assignments/{memberId}` Assignment · `content/global` GlobalContent. Types in [src/domain/types.ts](src/domain/types.ts). Data-access is **now implemented** (no longer stubs) in [khatmas.ts](src/data/khatmas.ts) + [assignments.ts](src/data/assignments.ts); the assignment algorithm lives in [assignment.ts](src/domain/assignment.ts).

---

## Next steps (Stage 2 — remaining)

1. ✅ **Domain** — assignment + schedule + progress (done, tested).
2. ✅ **Data** — khatmas + assignments + rules (done; rules need emulator test).
3. ✅ **Admin app** ([src/ui/admin/render.ts](src/ui/admin/render.ts)) — **built.** Roster CRUD with `pagesPerDay` steppers + enable/disable; khatma-creation wizard (members/duration/start/scope → live coverage preview → reciter via `pickDuaReciter` → `planAssignments` → `createKhatma`); per-khatma dashboard (progress %, days left, **pending-readers with `isFinalStretch` urgency**, **leftover unassigned pages** + assign-to-volunteer, **Regenerate remaining days** via `replanRemainingDays`, anonymous toggle, reciter change, per-member day-chips for `markDayDone`/`clearDayDone`, **Mark complete**); du3a editor (`setDu3aText`); **previous-khatmas list** with **Restart**. Assignment engine now capacity/disabled-aware (`planAssignments` in [assignment.ts](src/domain/assignment.ts)) and reciter rotation in [rotation.ts](src/domain/rotation.ts).
4. ✅ **Member reading view** — in-app page text for assigned pages via `loader.getPage`, sized by the reading slider (§6). Built in [reader.ts](src/ui/member/reader.ts) (assigned mode).
5. ✅ **Full Quran browsing** — continuous reading over the bundled dataset, surah headers + Bismillah, independent of assignments. Built in [reader.ts](src/ui/member/reader.ts) (browse mode, Quran tab).
6. ✅ **Navigation** — bottom tab bar / side rail + per-khatma landing pages + hash router (this round).
7. **End-to-end verification** — ✅ emulator pass done (identity → read → finish → insight). **Remaining:** a pass against the **real** Firestore project (currently `VITE_USE_EMULATOR=true`), and rules emulator-testing before deploy.

## Deferred to backlog (REQUIREMENTS §9)

Consistency/reliability stats · khatma archive/history · notifications · translations/tafsir/audio · real authentication.

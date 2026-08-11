# Operations brick

Owns: Firebase adapter, schema/rules, build, tests, emulator, deploy, CI.

Start files: `src/data/`, `firestore.rules`, `package.json`, `vite.config.ts`,
`.github/workflows/`.

Normal gate:

```text
npm run check
```

Focused test: `npm test -- tests/app/name.test.tsx`.
Bundle-sensitive change: `npm run check:bundle-budgets`.

Firestore transaction/rule change: run domain tests, data callers, then the opt-in
emulator smoke with Firestore emulator running. Record if not run.

`npm run seed` writes only to the local Firestore emulator and skips roster or
khatma collections that already contain data. Roster and khatma names describe
their test intent in the Emulator UI. Its default dataset contains
`KhatmaRoundPreviewTest`, a planner-generated halfway state with late and pending
readers; `KhatmaRolloverTest`, settled immediately before rollover; and the
full-Quran `KhatmaRedistributionTest`, with completed, loose-page, accumulated
hold, mixed Surah/loose, disabled, and ready-without-pages cases. Every seeded
khatma covers pages 1–604; its remaining pool reflects the scenario state. Use
`npm run seed -- --dry-run` to build and summarize all scenarios without reading
or writing emulator data. Seeded assignment chunks include explicit lifecycle
status/run references, and matching `distributionRuns` records make revision,
completion, and current-run behavior inspectable in the Emulator UI.

Distribution schema: `distributionRuns/{runId}` records a confirmed series-wide
run with number, mode, open/closed status, revision, khatma ids, timestamps, and
optional rollover pair. Khatmas mirror `currentDistributionRunId` and
`distributionRevision`. New chunks carry `id`, `runId`, `status`, and lifecycle
timestamps; readers remain backward-compatible with legacy `released` and
`doneByRound` data.

Khatma create and update rules require full scope and 604 total pages. The data
adapter requires an ordinary new khatma to start with the exact 1–604 pool; an
atomic rollover may create N+1 with its first round already assigned, so its
persisted `remainingPages` is legitimately smaller at creation time. New UI and
rollover writes always create full-Quran khatmas.

Feedback schema: `content/feedback/messages/{feedbackId}` is append-only at
submission time. Each document stores `memberId`, `memberName`, `message`,
`isRead`, and numeric `createdAt`. Create rules require unread 10–500-character
messages; updates may change only `isRead`; deletes remove one message document.
The admin retains its listener on demand, so member clients do not subscribe to
the inbox.

Roster schema: `roster/{memberId}.holdPages` is an optional boolean for backward
compatibility with existing documents. New members start with `false`; member
and admin controls may update it, and completing assigned pages resets it.
Legacy roster documents without `completedPages` are normalized to an empty
array at the Firestore read boundary.

Hard rules:

- Only `src/data` imports Firebase.
- Firestore rules validate path and shape. They do not prove identity.
- App is static. No server or Cloud Functions.
- Never touch live Firebase or deploy unless user gives explicit authority.
- Production has two entries: `index.html` and the hidden admin HTML.
- The member entry ships `manifest.webmanifest`, PNG icons for standard,
  maskable, Apple touch, and favicon use. All install asset URLs remain valid
  under Vite's configured base path.

Update this doc when commands, schema, rules, CI, entries, emulator, or deploy flow changes.

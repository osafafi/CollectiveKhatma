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
khatma collections that already contain data. Its default dataset contains two
active full-Quran series generated through the real distribution planner: one
around halfway with current/older completions plus an older warned pending
assignment, and one settled at the point where its next distribution rolls over.
Use `npm run seed -- --dry-run` to build and summarize both scenarios without
reading or writing emulator data.

Feedback schema: `content/feedback/messages/{feedbackId}` is append-only at
submission time. Each document stores `memberId`, `memberName`, `message`,
`isRead`, and numeric `createdAt`. Create rules require unread 10–500-character
messages; updates may change only `isRead`; deletes remove one message document.
The admin retains its listener on demand, so member clients do not subscribe to
the inbox.

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

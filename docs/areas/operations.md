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

Hard rules:

- Only `src/data` imports Firebase.
- Firestore rules validate path and shape. They do not prove identity.
- App is static. No server or Cloud Functions.
- Never touch live Firebase or deploy unless user gives explicit authority.
- Production has two entries: `index.html` and the hidden admin HTML.

Update this doc when commands, schema, rules, CI, entries, emulator, or deploy flow changes.

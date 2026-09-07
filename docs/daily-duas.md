# Daily prayers

Daily prayers live only in Firestore at `content/global.dailyDu3as`. The source
PDF and its extracted text are not stored in the repository or bundled app.
The initial 54 entries were imported into production on 2026-09-07, with a
server read verifying the full list and preservation of all other global fields.
Admins manage wording and diacritics directly in Settings.

## Member behavior

An accepted completion tap, including a locally queued offline tap, opens
`دعاء اليوم`. The modal uses shared gradients and the Arabic reading font,
scrollable text, a single `تم` button, and reduced-motion-aware fade transitions.
It remains independent of du3a2 al-khatma and survives the khatma completion screen.

The earliest retained assignment date in a khatma-local round determines the
selection, including after later adjustments. Members finishing on different days
or in different timezones therefore agree. Accumulated pages use their latest
pending round. Day zero is 2026-09-07; each calendar day advances one entry modulo
the current list length. Same-date rounds share an entry; skipped days still
advance the rotation. Admin saves affect future taps, including existing rounds;
an open popup retains its captured text. No historical prayer is frozen per round.

The existing Firestore listener supplies the list and its persistent cache supports
offline use after a previous sync. Missing, invalid, or empty content means no daily
popup. There is no hardcoded fallback on a new or uncached device.

## Admin management

Admin Settings → `أدعية اليوم` starts collapsed. Expand to review the published
list, edit text, add entries, or confirm deletions. `حفظ قائمة الأدعية` publishes
the whole ordered list. An empty saved list disables daily popups. Saves require
an internet connection and merge only the daily list, preserving the khatma prayer.

Drafts survive live updates and failed saves. A concurrent edit produces a conflict
message and preserves the draft. Copy any wanted text before choosing
`إعادة تحميل القائمة` and confirming replacement with the published list.

There is no repository-based restore: back up custom content before deleting it.
A new Firebase environment begins with an empty list, which admins can populate
through this editor.

## Deployment

The production content import is complete. The frontend and updated rules must
still be deployed through the usual workflow; no second content import is needed.
After pushing the local commit, deploy the frontend with production Firebase
configuration (`VITE_USE_EMULATOR=false` or unset for a production build).

Publish the repository's rules from PowerShell:

```powershell
npx firebase login
npm run deploy:rules
```

Alternatively, select project `collectivekhatma` in Firebase Console → Firestore
Database → Rules, replace the editor with the complete `firestore.rules` file,
and Publish. This feature's work imported content only; it did not deploy rules
or the frontend.

Open deployed admin Settings to verify the 54 imported entries (or subsequent
admin edits). Firebase Console shows them under content → global → dailyDu3as.

## Local verification

Run `npm run check` and `npm run check:bundle-budgets`. The ordinary suite uses
small synthetic prayer strings, never a copy of production content.

For Firestore integration, start `npm run emulators`, then in another PowerShell:

```powershell
$env:RUN_FIRESTORE_EMULATOR_SMOKE = 'true'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:VITE_USE_EMULATOR = 'true'
npm test -- tests/app/daily-dua-emulator.test.ts tests/app/foundation-emulator.test.ts
```

The daily-content emulator test restores its original global content afterward.

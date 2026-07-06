/**
 * Seed the Firestore EMULATOR with a few roster members and the default du3a,
 * so the walking-skeleton member page shows live data during development.
 *
 * Requires the emulator to be running (`npm run emulators`). This never touches
 * real Firestore — firebase-admin auto-targets the emulator via
 * FIRESTORE_EMULATOR_HOST, and we use a `demo-` project id.
 *
 * Run with: `npm run seed`
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_DU3A_TEXT } from '../src/content/strings.ar';

// firebase-admin connects to the emulator when this is set.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-khatma';
initializeApp({ projectId });
const db = getFirestore();

const names = ['فاطمة', 'مريم', 'خديجة', 'زينب', 'آمنة'];

async function seed(): Promise<void> {
  const existing = await db.collection('roster').limit(1).get();
  if (existing.empty) {
    for (const name of names) {
      await db.collection('roster').add({
        name,
        completedPages: [],
        createdAt: Date.now(),
      });
    }
    console.log(`Seeded ${names.length} roster members.`);
  } else {
    console.log('Roster already has data — skipping roster seed.');
  }

  await db.doc('content/global').set({ du3aText: DEFAULT_DU3A_TEXT }, { merge: true });
  console.log('Seeded default du3a text.');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

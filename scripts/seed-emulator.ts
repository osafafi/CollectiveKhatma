/**
 * Seed the Firestore EMULATOR with a working local dataset: a roster, the
 * default du3a, and one active sample khatma with generated per-member
 * assignments — so the member app shows real "today" data with no admin UI yet.
 *
 * Safe by design: firebase-admin talks to the emulator because
 * FIRESTORE_EMULATOR_HOST is set below, so this NEVER touches real Firestore.
 * The project id matches the app (`.env` / `.firebaserc`: collectivekhatma) so
 * the seed, the running app, and the Emulator UI all share one datastore.
 *
 * Idempotent: each collection is only seeded if empty. Run: `npm run seed`
 * (with `npm run emulators` already running).
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_DU3A_TEXT } from '../src/content/strings.ar';
import { generateAssignments, resolvePageScope } from '../src/domain/assignment';

// firebase-admin routes to the emulator when this is set (keeps us off real DB).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.GCLOUD_PROJECT ?? 'collectivekhatma';
initializeApp({ projectId });
const db = getFirestore();

const names = ['فاطمة', 'مريم', 'خديجة', 'زينب', 'آمنة'];

/** Today's local calendar date as YYYY-MM-DD (matches the member app's clock). */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Ensure the roster exists; return every member's id (existing or created). */
async function seedRoster(): Promise<string[]> {
  const snap = await db.collection('roster').get();
  if (!snap.empty) {
    console.log('Roster already has data — skipping roster seed.');
    return snap.docs.map((d) => d.id);
  }
  const ids: string[] = [];
  for (const name of names) {
    const ref = await db.collection('roster').add({
      name,
      completedPages: [],
      createdAt: Date.now(),
    });
    ids.push(ref.id);
  }
  console.log(`Seeded ${names.length} roster members.`);
  return ids;
}

/** Create one active sample khatma (full mushaf, 7 days from today) if none exist. */
async function seedKhatma(memberIds: string[]): Promise<void> {
  const existing = await db.collection('khatmas').limit(1).get();
  if (!existing.empty) {
    console.log('Khatma already exists — skipping khatma seed.');
    return;
  }

  const totalPages = 604;
  const durationDays = 7;
  const startDate = todayIso();
  const assignments = generateAssignments({
    pages: resolvePageScope({ kind: 'full', totalPages }),
    durationDays,
    members: memberIds.map((id) => ({ id, completedPages: [] })),
  });

  const khatmaRef = db.collection('khatmas').doc();
  const batch = db.batch();
  batch.set(khatmaRef, {
    name: 'ختمة تجريبية',
    totalPages,
    startDate,
    durationDays,
    memberIds,
    anonymous: false,
    status: 'active',
    createdAt: Date.now(),
  });
  for (const [memberId, pagesByDay] of Object.entries(assignments)) {
    batch.set(khatmaRef.collection('assignments').doc(memberId), {
      memberId,
      // Firestore forbids nested arrays — wrap each day (mirrors data/assignments.ts).
      pagesByDay: pagesByDay.map((pages) => ({ pages })),
      doneByDay: {},
    });
  }
  await batch.commit();
  console.log(`Seeded sample khatma "${khatmaRef.id}" — ${startDate}, ${durationDays} days, ${memberIds.length} members.`);
}

async function seed(): Promise<void> {
  const memberIds = await seedRoster();
  await db.doc('content/global').set({ du3aText: DEFAULT_DU3A_TEXT }, { merge: true });
  console.log('Seeded default du3a text.');
  await seedKhatma(memberIds);
  console.log('\nDone. Open the app (npm run dev) and pick a name to see today’s pages.');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

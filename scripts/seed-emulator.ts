/**
 * Seed the Firestore EMULATOR with a working local dataset: a roster (with per
 * person daily capacities and one temporarily-disabled member), the default
 * du3a, and one active sample khatma with capacity-aware per-member assignments
 * and a rotated du3a reciter — so the member app shows real "today" data and the
 * admin app shows leftover/pending/reciter with no manual setup.
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
import { planAssignments, resolvePageScope } from '../src/domain/assignment';
import { pickDuaReciter } from '../src/domain/rotation';
import type { PageScope } from '../src/domain/types';

// firebase-admin routes to the emulator when this is set (keeps us off real DB).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.GCLOUD_PROJECT ?? 'collectivekhatma';
initializeApp({ projectId });
const db = getFirestore();

/** Roster seed: varied daily capacities + one paused member (demoing §3–5). */
const people = [
  { name: 'فاطمة', pagesPerDay: 5, enabled: true },
  { name: 'مريم', pagesPerDay: 1, enabled: true },
  { name: 'خديجة', pagesPerDay: 20, enabled: true },
  { name: 'زينب', pagesPerDay: 5, enabled: false }, // temporarily disabled
  { name: 'آمنة', pagesPerDay: 5, enabled: true },
];

interface SeededPerson {
  id: string;
  pagesPerDay: number;
  enabled: boolean;
}

/** Today's local calendar date as YYYY-MM-DD (matches the member app's clock). */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Ensure the roster exists; return every member (existing or created). */
async function seedRoster(): Promise<SeededPerson[]> {
  const snap = await db.collection('roster').get();
  if (!snap.empty) {
    console.log('Roster already has data — skipping roster seed.');
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        pagesPerDay: (data.pagesPerDay as number) ?? 2,
        enabled: (data.enabled as boolean) ?? true,
      };
    });
  }
  const seeded: SeededPerson[] = [];
  for (const person of people) {
    const ref = await db.collection('roster').add({
      name: person.name,
      completedPages: [],
      pagesPerDay: person.pagesPerDay,
      enabled: person.enabled,
      createdAt: Date.now(),
    });
    seeded.push({ id: ref.id, pagesPerDay: person.pagesPerDay, enabled: person.enabled });
  }
  console.log(`Seeded ${people.length} roster members (1 disabled).`);
  return seeded;
}

/** Create one active sample khatma (full mushaf, 7 days from today) if none exist. */
async function seedKhatma(members: SeededPerson[]): Promise<void> {
  const existing = await db.collection('khatmas').limit(1).get();
  if (!existing.empty) {
    console.log('Khatma already exists — skipping khatma seed.');
    return;
  }

  const scope: PageScope = { kind: 'full', totalPages: 604 };
  const pool = resolvePageScope(scope);
  const durationDays = 7;
  const startDate = todayIso();
  const memberIds = members.map((m) => m.id);

  const { assignments, unassigned } = planAssignments({
    pages: pool,
    days: durationDays,
    members: members.map((m) => ({
      id: m.id,
      completedPages: [],
      pagesPerDay: m.pagesPerDay,
      enabled: m.enabled,
    })),
  });
  const duaReciterId = pickDuaReciter(memberIds, []);

  const khatmaRef = db.collection('khatmas').doc();
  const batch = db.batch();
  batch.set(khatmaRef, {
    name: 'ختمة تجريبية',
    totalPages: pool.length,
    scope,
    startDate,
    durationDays,
    memberIds,
    anonymous: false,
    ...(duaReciterId ? { duaReciterId } : {}),
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
  console.log(
    `Seeded sample khatma "${khatmaRef.id}" — ${startDate}, ${durationDays} days, ` +
      `${memberIds.length} members, ${unassigned.length} pages left unassigned (capacity-limited).`,
  );
}

async function seed(): Promise<void> {
  const members = await seedRoster();
  await db.doc('content/global').set({ du3aText: DEFAULT_DU3A_TEXT }, { merge: true });
  console.log('Seeded default du3a text.');
  await seedKhatma(members);
  console.log('\nDone. Open the app (npm run dev) and pick a name to see today’s pages.');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

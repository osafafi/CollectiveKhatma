/**
 * Seed the Firestore EMULATOR with a working local dataset: a roster (with per
 * person chunk sizes and one temporarily-disabled member), the default du3a,
 * and one active khatma ("أهل القرآن 1") with TWO simulated distribution rounds
 * already applied — so out of the box the admin app shows a pending round, done
 * members, and one yellow-flagged member (مريم) whose next miss goes red.
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
import { resolvePageScope } from '../src/domain/assignment';
import {
  planDistribution,
  type DistributionKhatmaState,
} from '../src/domain/distribution';
import { pickDuaReciter } from '../src/domain/rotation';
import type { Assignment, PageScope, RoundChunk } from '../src/domain/types';

// firebase-admin routes to the emulator when this is set (keeps us off real DB).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.GCLOUD_PROJECT ?? 'collectivekhatma';
initializeApp({ projectId });
const db = getFirestore();

/** Roster seed: varied chunk sizes + one paused member (demoing §3–5). */
const people = [
  { name: 'فاطمة', pagesPerDay: 5, enabled: true },
  { name: 'مريم', pagesPerDay: 1, enabled: true },
  { name: 'خديجة', pagesPerDay: 20, enabled: true },
  { name: 'زينب', pagesPerDay: 5, enabled: false }, // temporarily disabled
  { name: 'آمنة', pagesPerDay: 5, enabled: true },
];

interface SeededPerson {
  id: string;
  name: string;
  pagesPerDay: number;
  enabled: boolean;
}

/** A local calendar date `offset` days from today as YYYY-MM-DD. */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
        name: (data.name as string) ?? d.id,
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
    seeded.push({ id: ref.id, ...person });
  }
  console.log(`Seeded ${people.length} roster members (1 disabled).`);
  return seeded;
}

/**
 * Create "أهل القرآن 1" and replay two distribution rounds through the real
 * `planDistribution` engine, exactly as the admin app would apply them:
 *  - Round 1 (two days ago): everyone served; مريم doesn't read hers.
 *  - Round 2 (yesterday): مريم still holds her unread page, so she is skipped
 *    and her warning escalates to yellow — the engine never auto-releases the
 *    chunk (invariant 2), it stays pending with her; everyone else settles
 *    round 1 and takes a fresh chunk from the pool.
 * Leaves `lastDistributionDate` = yesterday, so "Distribute" works today.
 */
async function seedKhatma(members: SeededPerson[]): Promise<void> {
  const existing = await db.collection('khatmas').limit(1).get();
  if (!existing.empty) {
    console.log('Khatma already exists — skipping khatma seed.');
    return;
  }

  const scope: PageScope = { kind: 'full', totalPages: 604 };
  const pool = resolvePageScope(scope);
  const memberIds = members.map((m) => m.id);
  const duaReciterId = pickDuaReciter(memberIds, []);
  const miss = members.find((m) => m.name === 'مريم');

  // In-memory khatma + assignment state the two rounds are replayed against.
  let remainingPages = pool;
  let roundCount = 0;
  const assignments = new Map<string, Assignment>(
    memberIds.map((id) => [
      id,
      { memberId: id, rounds: [], doneByRound: {}, missedStreak: 0 },
    ]),
  );
  const khatmaId = db.collection('khatmas').doc().id;

  const runRound = (date: string): void => {
    const state: DistributionKhatmaState = {
      id: khatmaId,
      seriesNumber: 1,
      remainingPages,
      roundCount,
      assignments: [...assignments.values()],
    };
    const plan = planDistribution({
      khatmas: [state],
      members: members.map((m) => ({
        id: m.id,
        capacity: { pages: m.pagesPerDay, surahs: 0, juz: 0 },
        completedPages: [],
        enabled: m.enabled,
      })),
      newKhatmaPool: pool,
      newKhatmaSeriesNumber: 2,
    });
    for (const [memberId, streak] of Object.entries(plan.streaks)) {
      const a = assignments.get(memberId);
      if (a) a.missedStreak = streak;
    }
    for (const planned of plan.chunks) {
      const chunk: RoundChunk = { round: planned.round, date, pages: planned.pages };
      assignments.get(planned.memberId)?.rounds.push(chunk);
    }
    const update = plan.khatmaUpdates[0];
    if (update) {
      remainingPages = update.remainingPages;
      roundCount = update.roundCount;
    }
  };

  const markDone = (memberId: string, round: number): void => {
    const a = assignments.get(memberId);
    if (a) a.doneByRound[round] = Date.now();
  };

  // Round 1 (two days ago): everyone but مريم reads their chunk.
  runRound(isoDate(-2));
  for (const m of members) {
    if (m.enabled && m.id !== miss?.id) markDone(m.id, 1);
  }
  // Round 2 (yesterday): مريم released + yellow; others finish again, she doesn't.
  runRound(isoDate(-1));
  for (const m of members) {
    if (m.enabled && m.id !== miss?.id) markDone(m.id, 2);
  }

  // Persist the final state in one batch.
  const khatmaRef = db.collection('khatmas').doc(khatmaId);
  const batch = db.batch();
  batch.set(khatmaRef, {
    seriesId: crypto.randomUUID(),
    seriesName: 'أهل القرآن',
    seriesNumber: 1,
    totalPages: pool.length,
    scope,
    memberIds,
    remainingPages,
    roundCount,
    lastDistributionDate: isoDate(-1),
    ...(duaReciterId ? { duaReciterId } : {}),
    status: 'active',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  });
  for (const a of assignments.values()) {
    batch.set(khatmaRef.collection('assignments').doc(a.memberId), a);
    // Lifetime insight: union of the pages on this member's done rounds.
    const donePages = a.rounds
      .filter((c) => c.released !== true && a.doneByRound[c.round] !== undefined)
      .flatMap((c) => c.pages);
    if (donePages.length > 0) {
      batch.update(db.collection('roster').doc(a.memberId), {
        completedPages: donePages,
      });
    }
  }
  await batch.commit();
  console.log(
    `Seeded khatma "أهل القرآن 1" (${khatmaId}) — ${roundCount} rounds replayed, ` +
      `${remainingPages.length}/${pool.length} pages left, مريم flagged yellow.`,
  );
}

async function seed(): Promise<void> {
  const members = await seedRoster();
  await db.doc('content/global').set({ du3aText: DEFAULT_DU3A_TEXT }, { merge: true });
  console.log('Seeded default du3a text.');
  await seedKhatma(members);
  console.log('\nDone. Open the app (npm run dev) and pick a name to see your pages.');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

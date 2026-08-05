/**
 * Seed the Firestore EMULATOR with two planner-backed active khatmas:
 *
 * - "أهل القرآن 1" is around halfway complete. Its latest dashboard state has
 *   current-round completions, one member who finished an older held round
 *   late, and one member still holding an older round with a yellow warning.
 * - "نور على نور 1" is fully settled with just enough pages left that the next
 *   normal distribution will roll over into khatma 2.
 *
 * Completed pages accumulate across both simulations before being persisted to
 * the roster, so member insights and distribution history agree.
 *
 * Safe by design: firebase-admin talks to the emulator because
 * FIRESTORE_EMULATOR_HOST is set below, so this NEVER touches real Firestore.
 * The project id matches the app (`.env` / `.firebaserc`: collectivekhatma) so
 * the seed, the running app, and the Emulator UI all share one datastore.
 *
 * Idempotent: roster and khatmas are each seeded only when their collection is
 * empty. Run `npm run seed` with `npm run emulators` already running.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_DU3A_TEXT } from '../src/content/strings.ar';
import { resolvePageScope } from '../src/domain/assignment';
import {
  planDistribution,
  type DistributionKhatmaState,
  type DistributionPlan,
} from '../src/domain/distribution';
import { pickDuaReciter } from '../src/domain/rotation';
import type {
  Assignment,
  Khatma,
  MemberCapacity,
  PageScope,
  RoundChunk,
} from '../src/domain/types';

// firebase-admin routes to the emulator when this is set (keeps us off real DB).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.GCLOUD_PROJECT ?? 'collectivekhatma';
initializeApp({ projectId });
const db = getFirestore();
const DAY_MS = 24 * 60 * 60 * 1_000;

/** Roster seed: varied chunk sizes + one paused member. */
const people = [
  { name: 'فاطمة', emoji: '🌷', pagesPerDay: 5, enabled: true },
  { name: 'مريم', emoji: '📖', pagesPerDay: 1, enabled: true },
  { name: 'خديجة', pagesPerDay: 20, enabled: true },
  { name: 'زينب', pagesPerDay: 5, enabled: false },
  { name: 'آمنة', pagesPerDay: 5, enabled: true },
];

interface SeededPerson {
  id: string;
  name: string;
  pagesPerDay: number;
  enabled: boolean;
  completedPages: number[];
}

/** A local calendar date `offset` days from today as YYYY-MM-DD. */
function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localNoon(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

/** Ensure the roster exists; return every member (existing or created). */
async function seedRoster(): Promise<SeededPerson[]> {
  const snap = await db.collection('roster').get();
  if (!snap.empty) {
    console.log('Roster already has data — skipping roster seed.');
    return snap.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name: data.name as string,
        pagesPerDay: data.pagesPerDay as number,
        enabled: data.enabled as boolean,
        completedPages: (data.completedPages as number[] | undefined) ?? [],
      };
    });
  }

  const seeded: SeededPerson[] = [];
  for (const person of people) {
    const ref = db.collection('roster').doc();
    await ref.set({
      name: person.name,
      ...('emoji' in person ? { emoji: person.emoji } : {}),
      completedPages: [],
      pagesPerDay: person.pagesPerDay,
      enabled: person.enabled,
      createdAt: Date.now(),
    });
    seeded.push({ id: ref.id, ...person, completedPages: [] });
  }
  console.log(`Seeded ${people.length} roster members (1 disabled).`);
  return seeded;
}

/** Mutable in-memory state replayed exclusively through the real planner. */
class KhatmaSimulation {
  readonly id = crypto.randomUUID();
  readonly seriesId = crypto.randomUUID();
  readonly scope: PageScope = { kind: 'full', totalPages: 604 };
  readonly pool = resolvePageScope(this.scope);
  readonly memberIds: string[];
  readonly capacities: Record<string, MemberCapacity>;
  readonly assignments: Map<string, Assignment>;
  remainingPages = [...this.pool];
  roundCount = 0;

  constructor(
    readonly seriesName: string,
    private readonly members: readonly SeededPerson[],
    private readonly lifetimePages: ReadonlyMap<string, Set<number>>,
  ) {
    this.memberIds = members.map((member) => member.id);
    this.capacities = Object.fromEntries(
      members.map((member) => [
        member.id,
        { pages: member.pagesPerDay, surahs: 0, juz: 0 },
      ]),
    );
    this.assignments = new Map(
      this.memberIds.map((memberId) => [
        memberId,
        { memberId, rounds: [], doneByRound: {}, missedStreak: 0 },
      ]),
    );
  }

  get createdAt(): number {
    return Date.now() - (this.roundCount + 1) * DAY_MS;
  }

  previewNextRound(): DistributionPlan {
    const state: DistributionKhatmaState = {
      id: this.id,
      seriesNumber: 1,
      remainingPages: this.remainingPages,
      roundCount: this.roundCount,
      assignments: [...this.assignments.values()],
    };
    return planDistribution({
      khatmas: [state],
      members: this.members.map((member) => ({
        id: member.id,
        capacity: this.capacities[member.id]!,
        completedPages: [...(this.lifetimePages.get(member.id) ?? [])],
        enabled: member.enabled,
      })),
      newKhatmaPool: this.pool,
      newKhatmaSeriesNumber: 2,
    });
  }

  runRound(): number {
    const plan = this.previewNextRound();
    if (plan.rollover) {
      throw new Error(`${this.seriesName}: scenario unexpectedly rolled over`);
    }

    for (const [memberId, streak] of Object.entries(plan.streaks)) {
      const assignment = this.assignments.get(memberId);
      if (assignment) assignment.missedStreak = streak;
    }
    for (const planned of plan.chunks) {
      if (planned.khatmaId !== this.id) continue;
      const chunk: RoundChunk = {
        round: planned.round,
        date: isoDate(-1),
        pages: planned.pages,
        loosePages: planned.loosePages,
        redistributedPages: [],
      };
      this.assignments.get(planned.memberId)?.rounds.push(chunk);
    }

    const update = plan.khatmaUpdates.find((candidate) => candidate.khatmaId === this.id);
    if (update) {
      this.remainingPages = update.remainingPages;
      this.roundCount = update.roundCount;
    }
    return this.roundCount;
  }

  markDone(memberId: string, round: number): void {
    const assignment = this.assignments.get(memberId);
    if (!assignment) return;
    const chunks = assignment.rounds.filter(
      (chunk) => chunk.round === round && chunk.released !== true,
    );
    if (chunks.length === 0) return;

    assignment.doneByRound[round] = 1;
    assignment.missedStreak = 0;
    const completed = this.lifetimePages.get(memberId);
    if (!completed) return;
    for (const chunk of chunks) {
      for (const page of chunk.pages) completed.add(page);
    }
  }

  markRoundDoneExcept(round: number, excludedIds: ReadonlySet<string>): void {
    for (const member of this.members) {
      if (!excludedIds.has(member.id)) this.markDone(member.id, round);
    }
  }

  /** Make round dates and done timestamps end yesterday in chronological order. */
  normalizeTimeline(): void {
    for (const assignment of this.assignments.values()) {
      for (const chunk of assignment.rounds) {
        chunk.date = isoDate(chunk.round - this.roundCount - 1);
      }
      for (const roundText of Object.keys(assignment.doneByRound)) {
        const round = Number(roundText);
        const chunk = [...assignment.rounds]
          .reverse()
          .find((candidate) => candidate.round === round);
        if (chunk) assignment.doneByRound[round] = localNoon(chunk.date);
      }
    }
  }

  khatma(duaReciterId: string): Omit<Khatma, 'id'> {
    return {
      seriesId: this.seriesId,
      seriesName: this.seriesName,
      seriesNumber: 1,
      totalPages: this.pool.length,
      scope: this.scope,
      memberIds: this.memberIds,
      capacities: this.capacities,
      status: 'active',
      remainingPages: this.remainingPages,
      roundCount: this.roundCount,
      lastDistributionDate: isoDate(-1),
      duaReciterId,
      createdAt: this.createdAt,
    };
  }
}

interface MidwayScenario {
  simulation: KhatmaSimulation;
  laggingMember: SeededPerson;
  lateFinisher: SeededPerson;
  heldRound: number;
}

/** Build a roughly 50% khatma with both old-round pending and completed rows. */
function buildMidwayScenario(
  members: readonly SeededPerson[],
  lifetimePages: ReadonlyMap<string, Set<number>>,
): MidwayScenario {
  const active = members.filter((member) => member.enabled);
  if (active.length < 3) {
    throw new Error('Midway seed scenario requires at least three enabled members.');
  }
  const laggingMember = active[1]!;
  const lateFinisher = active[active.length - 1]!;
  const simulation = new KhatmaSimulation('أهل القرآن', members, lifetimePages);
  const dailyCapacity = active.reduce((sum, member) => sum + member.pagesPerDay, 0);

  while (
    simulation.remainingPages.length >
    simulation.pool.length / 2 + dailyCapacity * 2
  ) {
    const round = simulation.runRound();
    simulation.markRoundDoneExcept(round, new Set());
  }

  const heldRound = simulation.runRound();
  simulation.markRoundDoneExcept(heldRound, new Set([laggingMember.id, lateFinisher.id]));

  const currentRound = simulation.runRound();
  if (currentRound === heldRound) {
    throw new Error('Midway seed scenario needs a ready member to advance the round.');
  }
  simulation.markRoundDoneExcept(currentRound, new Set());

  // One member catches up after the next round already started; the other keeps
  // the older assignment pending and its one-round warning.
  simulation.markDone(lateFinisher.id, heldRound);
  simulation.normalizeTimeline();
  return { simulation, laggingMember, lateFinisher, heldRound };
}

/** Build a settled khatma whose next planner pass is guaranteed to roll over. */
function buildRolloverReadyScenario(
  members: readonly SeededPerson[],
  lifetimePages: ReadonlyMap<string, Set<number>>,
): KhatmaSimulation {
  const simulation = new KhatmaSimulation('نور على نور', members, lifetimePages);

  for (let safety = 0; safety < 100; safety++) {
    if (simulation.previewNextRound().rollover) {
      if (simulation.remainingPages.length === 0) {
        throw new Error('Rollover-ready seed unexpectedly drained the current khatma.');
      }
      simulation.normalizeTimeline();
      return simulation;
    }
    const previousRound = simulation.roundCount;
    const round = simulation.runRound();
    if (round === previousRound) {
      throw new Error('Rollover-ready seed could not advance a distribution round.');
    }
    simulation.markRoundDoneExcept(round, new Set());
  }

  throw new Error('Rollover-ready seed exceeded its 100-round safety limit.');
}

async function seedKhatmas(members: readonly SeededPerson[]): Promise<void> {
  const existing = await db.collection('khatmas').limit(1).get();
  if (!existing.empty) {
    console.log('Khatmas already have data — skipping khatma scenarios.');
    return;
  }

  const lifetimePages = new Map(
    members.map((member) => [member.id, new Set(member.completedPages)]),
  );
  const midway = buildMidwayScenario(members, lifetimePages);
  const rolloverReady = buildRolloverReadyScenario(members, lifetimePages);

  const midwayReciter = pickDuaReciter(midway.simulation.memberIds, []);
  const midwayKhatma = midway.simulation.khatma(midwayReciter);
  const rolloverReciter = pickDuaReciter(rolloverReady.memberIds, [midwayKhatma]);
  const rolloverKhatma = rolloverReady.khatma(rolloverReciter);

  const batch = db.batch();
  const scenarios = [
    { simulation: midway.simulation, khatma: midwayKhatma },
    { simulation: rolloverReady, khatma: rolloverKhatma },
  ];
  for (const scenario of scenarios) {
    const khatmaRef = db.collection('khatmas').doc(scenario.simulation.id);
    batch.set(khatmaRef, scenario.khatma);
    for (const assignment of scenario.simulation.assignments.values()) {
      batch.set(khatmaRef.collection('assignments').doc(assignment.memberId), assignment);
    }
  }
  for (const member of members) {
    batch.update(db.collection('roster').doc(member.id), {
      completedPages: [...(lifetimePages.get(member.id) ?? [])].sort((a, b) => a - b),
    });
  }
  await batch.commit();

  logScenarioSummary('Seeded', midway, rolloverReady);
}

function logScenarioSummary(
  verb: 'Seeded' | 'Previewed',
  midway: MidwayScenario,
  rolloverReady: KhatmaSimulation,
): void {
  console.log(
    `${verb} "أهل القرآن 1" — round ${midway.simulation.roundCount}, ` +
      `${midway.simulation.remainingPages.length}/604 pages remain; ` +
      `${midway.lateFinisher.name} completed held round ${midway.heldRound}, ` +
      `${midway.laggingMember.name} still holds it with a yellow warning.`,
  );
  console.log(
    `${verb} "نور على نور 1" — round ${rolloverReady.roundCount}, ` +
      `${rolloverReady.remainingPages.length}/604 pages remain; next distribution rolls over.`,
  );
}

/** Build and report the default scenarios without connecting to or writing Firestore. */
function dryRun(): void {
  const members: SeededPerson[] = people.map((person, index) => ({
    id: `seed-person-${index + 1}`,
    name: person.name,
    pagesPerDay: person.pagesPerDay,
    enabled: person.enabled,
    completedPages: [],
  }));
  const lifetimePages = new Map(
    members.map((member) => [member.id, new Set(member.completedPages)]),
  );
  const midway = buildMidwayScenario(members, lifetimePages);
  const rolloverReady = buildRolloverReadyScenario(members, lifetimePages);

  console.log('Dry run only — no emulator data was read or written.');
  logScenarioSummary('Previewed', midway, rolloverReady);
}

async function seed(): Promise<void> {
  const members = await seedRoster();
  await db.doc('content/global').set({ du3aText: DEFAULT_DU3A_TEXT }, { merge: true });
  console.log('Seeded default du3a text.');
  await seedKhatmas(members);
  console.log('\nDone. Open the app (npm run dev) and pick a name to see your pages.');
}

const run = process.argv.includes('--dry-run') ? Promise.resolve(dryRun()) : seed();

run
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

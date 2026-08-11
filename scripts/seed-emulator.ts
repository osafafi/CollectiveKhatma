/**
 * Seed the Firestore EMULATOR with three intent-named active khatmas:
 *
 * - "KhatmaRoundPreviewTest 1" is around halfway complete. Its latest dashboard state has
 *   current-round completions, one member who finished an older held round
 *   late, and one member still holding an older round with a yellow warning.
 * - "KhatmaRolloverTest 1" is fully settled with just enough pages left that the next
 *   normal distribution will roll over into khatma 2.
 * - "KhatmaRedistributionTest 1" is a full-Quran scenario containing a
 *   completed reader, a loose-page reader, accumulated held pages, a mixed
 *   Surah/loose chunk, a disabled reader, and a ready reader with no current
 *   chunk. It exposes the no-op and preserved-unit redistribution edge cases.
 *
 * Completed pages accumulate across all scenarios before being persisted to
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
  DistributionRun,
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

/** Intent-named roster seed: every person advertises the edge case they exercise. */
const people = [
  {
    id: 'member-ready-for-pages',
    name: 'MemberReadyForPages',
    emoji: '✅',
    pagesPerDay: 4,
    enabled: true,
    holdPages: false,
  },
  {
    id: 'member-completed-round',
    name: 'MemberCompletedRound',
    emoji: '🏁',
    pagesPerDay: 3,
    enabled: true,
    holdPages: false,
  },
  {
    id: 'member-with-pending-pages',
    name: 'MemberWithPendingPages',
    emoji: '⏳',
    pagesPerDay: 2,
    enabled: true,
    holdPages: false,
  },
  {
    id: 'member-with-page-hold',
    name: 'MemberWithPageHold',
    emoji: '📚',
    pagesPerDay: 2,
    enabled: true,
    holdPages: true,
  },
  {
    id: 'member-with-surah',
    name: 'MemberWithSurah',
    emoji: '📖',
    pagesPerDay: 2,
    enabled: true,
    holdPages: false,
  },
  {
    id: 'member-disabled',
    name: 'MemberDisabled',
    emoji: '⏸️',
    pagesPerDay: 1,
    enabled: false,
    holdPages: false,
  },
];

interface SeededPerson {
  id: string;
  name: string;
  pagesPerDay: number;
  enabled: boolean;
  holdPages: boolean;
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
        holdPages: data.holdPages === true,
        completedPages: (data.completedPages as number[] | undefined) ?? [],
      };
    });
  }

  const seeded: SeededPerson[] = [];
  for (const person of people) {
    const ref = db.collection('roster').doc(person.id);
    await ref.set({
      name: person.name,
      emoji: person.emoji,
      completedPages: [],
      pagesPerDay: person.pagesPerDay,
      enabled: person.enabled,
      holdPages: person.holdPages,
      createdAt: Date.now(),
    });
    seeded.push({ ...person, completedPages: [] });
  }
  console.log(`Seeded ${people.length} intent-named roster members (1 disabled).`);
  return seeded;
}

/** Mutable in-memory state replayed exclusively through the real planner. */
class KhatmaSimulation {
  readonly id: string;
  readonly seriesId: string;
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
    const slug = seriesName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    this.id = `${slug}-1`;
    this.seriesId = `series-${slug}`;
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
        holdPages: member.holdPages,
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
        id: `${this.seriesId}-run-${planned.round}:${this.id}:${planned.memberId}`,
        runId: `${this.seriesId}-run-${planned.round}`,
        status: 'pending',
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
      chunk.status = 'completed';
      chunk.completedAt = 1;
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
        if (chunk) {
          assignment.doneByRound[round] = localNoon(chunk.date);
          chunk.completedAt = localNoon(chunk.date);
        }
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
      currentDistributionRunId: `${this.seriesId}-run-${this.roundCount}`,
      distributionRevision: 1,
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
  const simulation = new KhatmaSimulation(
    'KhatmaRoundPreviewTest',
    members,
    lifetimePages,
  );
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
  const simulation = new KhatmaSimulation('KhatmaRolloverTest', members, lifetimePages);

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

interface RedistributionScenario {
  id: string;
  khatma: Omit<Khatma, 'id'>;
  assignments: Assignment[];
}

function assignment(
  memberId: string,
  rounds: RoundChunk[] = [],
  doneByRound: Record<number, number> = {},
  missedStreak = 0,
): Assignment {
  return { memberId, rounds, doneByRound, missedStreak };
}

function chunk(round: number, pages: number[], loosePages: number[] = pages): RoundChunk {
  return {
    round,
    date: isoDate(round === 1 ? -2 : -1),
    pages,
    loosePages,
    redistributedPages: [],
  };
}

/**
 * Full-Quran scenario for the current-round review UI. Page ownership is explicit:
 * 1-12 are held/completed assignment pages and 13-604 remain in the pool.
 */
function buildRedistributionScenario(
  members: readonly SeededPerson[],
  lifetimePages: ReadonlyMap<string, Set<number>>,
): RedistributionScenario {
  const memberIds = new Set(members.map((member) => member.id));
  const requiredIds = people.map((person) => person.id);
  const missing = requiredIds.filter((memberId) => !memberIds.has(memberId));
  if (missing.length > 0) {
    throw new Error(
      `KhatmaRedistributionTest requires the intent-named roster; missing ${missing.join(', ')}. Clear the emulator and seed again.`,
    );
  }

  const readyId = 'member-ready-for-pages';
  const completedId = 'member-completed-round';
  const pendingId = 'member-with-pending-pages';
  const holdId = 'member-with-page-hold';
  const surahId = 'member-with-surah';
  const disabledId = 'member-disabled';
  const completedAt = localNoon(isoDate(-1));
  const assignments = [
    assignment(readyId),
    assignment(completedId, [chunk(2, [4, 5])], { 2: completedAt }),
    assignment(pendingId, [chunk(2, [10, 11])], {}, 1),
    assignment(holdId, [chunk(1, [6, 7]), chunk(2, [8, 9])], {}, 2),
    // Page 1 is the preserved Al-Fatihah unit; pages 2-3 are loose and recallable.
    assignment(surahId, [chunk(2, [1, 2, 3], [2, 3])], {}, 1),
    assignment(disabledId, [chunk(2, [12])], {}, 1),
  ];
  for (const seededAssignment of assignments) {
    for (const seededChunk of seededAssignment.rounds) {
      seededChunk.id = `series-khatma-redistribution-test-run-${seededChunk.round}:khatma-redistribution-test-1:${seededAssignment.memberId}`;
      seededChunk.runId = `series-khatma-redistribution-test-run-${seededChunk.round}`;
      seededChunk.status =
        seededAssignment.doneByRound[seededChunk.round] !== undefined
          ? 'completed'
          : 'pending';
      if (seededChunk.status === 'completed') seededChunk.completedAt = completedAt;
    }
  }
  for (const page of [4, 5]) lifetimePages.get(completedId)?.add(page);

  const scope: PageScope = { kind: 'full' };
  const capacities = Object.fromEntries(
    members.map((member) => [
      member.id,
      {
        pages: member.pagesPerDay,
        surahs: member.id === surahId ? 1 : 0,
        juz: 0,
      },
    ]),
  );
  return {
    id: 'khatma-redistribution-test-1',
    khatma: {
      seriesId: 'series-khatma-redistribution-test',
      seriesName: 'KhatmaRedistributionTest',
      seriesNumber: 1,
      totalPages: 604,
      scope,
      memberIds: members.map((member) => member.id),
      capacities,
      status: 'active',
      remainingPages: resolvePageScope(scope).filter((page) => page >= 13),
      roundCount: 2,
      lastDistributionDate: isoDate(0),
      currentDistributionRunId: 'series-khatma-redistribution-test-run-2',
      distributionRevision: 1,
      duaReciterId: readyId,
      createdAt: Date.now() - 3 * DAY_MS,
    },
    assignments,
  };
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
  const redistribution = buildRedistributionScenario(members, lifetimePages);

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
    for (let round = 1; round <= scenario.simulation.roundCount; round++) {
      const runId = `${scenario.simulation.seriesId}-run-${round}`;
      const openedAt = localNoon(isoDate(round - scenario.simulation.roundCount - 1));
      const run: Omit<DistributionRun, 'id'> = {
        seriesId: scenario.simulation.seriesId,
        number: round,
        status: round === scenario.simulation.roundCount ? 'open' : 'closed',
        revision: 1,
        mode: 'new-round',
        khatmaIds: [scenario.simulation.id],
        openedAt,
        updatedAt: openedAt,
        ...(round < scenario.simulation.roundCount
          ? { closedAt: openedAt + DAY_MS }
          : {}),
      };
      batch.set(db.collection('distributionRuns').doc(runId), run);
    }
  }
  const redistributionRef = db.collection('khatmas').doc(redistribution.id);
  batch.set(redistributionRef, redistribution.khatma);
  for (const redistributionAssignment of redistribution.assignments) {
    batch.set(
      redistributionRef.collection('assignments').doc(redistributionAssignment.memberId),
      redistributionAssignment,
    );
  }
  for (let round = 1; round <= redistribution.khatma.roundCount; round++) {
    const runId = `series-khatma-redistribution-test-run-${round}`;
    const openedAt = localNoon(isoDate(round === 1 ? -2 : -1));
    const run: Omit<DistributionRun, 'id'> = {
      seriesId: redistribution.khatma.seriesId,
      number: round,
      status: round === redistribution.khatma.roundCount ? 'open' : 'closed',
      revision: 1,
      mode: 'new-round',
      khatmaIds: [redistribution.id],
      openedAt,
      updatedAt: openedAt,
      ...(round < redistribution.khatma.roundCount
        ? { closedAt: openedAt + DAY_MS }
        : {}),
    };
    batch.set(db.collection('distributionRuns').doc(runId), run);
  }
  for (const member of members) {
    batch.update(db.collection('roster').doc(member.id), {
      completedPages: [...(lifetimePages.get(member.id) ?? [])].sort((a, b) => a - b),
    });
  }
  await batch.commit();

  logScenarioSummary('Seeded', midway, rolloverReady, redistribution);
}

function logScenarioSummary(
  verb: 'Seeded' | 'Previewed',
  midway: MidwayScenario,
  rolloverReady: KhatmaSimulation,
  redistribution: RedistributionScenario,
): void {
  console.log(
    `${verb} "KhatmaRoundPreviewTest 1" — round ${midway.simulation.roundCount}, ` +
      `${midway.simulation.remainingPages.length}/604 pages remain; ` +
      `${midway.lateFinisher.name} completed held round ${midway.heldRound}, ` +
      `${midway.laggingMember.name} still holds it with a yellow warning.`,
  );
  console.log(
    `${verb} "KhatmaRolloverTest 1" — round ${rolloverReady.roundCount}, ` +
      `${rolloverReady.remainingPages.length}/604 pages remain; next distribution rolls over.`,
  );
  console.log(
    `${verb} "${redistribution.khatma.seriesName} 1" — round 2, ` +
      `${redistribution.khatma.remainingPages.length}/604 pages remain; mixed Surah, page hold, disabled, completed, pending, and ready-member cases are visible.`,
  );
}

/** Build and report the default scenarios without connecting to or writing Firestore. */
function dryRun(): void {
  const members: SeededPerson[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    pagesPerDay: person.pagesPerDay,
    enabled: person.enabled,
    holdPages: person.holdPages,
    completedPages: [],
  }));
  const lifetimePages = new Map(
    members.map((member) => [member.id, new Set(member.completedPages)]),
  );
  const midway = buildMidwayScenario(members, lifetimePages);
  const rolloverReady = buildRolloverReadyScenario(members, lifetimePages);
  const redistribution = buildRedistributionScenario(members, lifetimePages);

  console.log('Dry run only — no emulator data was read or written.');
  logScenarioSummary('Previewed', midway, rolloverReady, redistribution);
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

import { doc, runTransaction } from 'firebase/firestore';
import {
  planDistribution,
  recallLoosePagesFromAssignment,
  type DistributionKhatmaState,
  type DistributionMember,
} from '@/domain/distribution';
import type { PageUnitMaps } from '@/domain/assignment';
import type {
  Assignment,
  Khatma,
  MemberCapacity,
  PageScope,
  RoundChunk,
} from '@/domain/types';
import { assignmentDoc } from './assignments';
import { db } from './firebase';
import { khatmasCol } from './khatmas';

/**
 * Thrown when a distribution already ran today for this khatma (double-press,
 * or a second admin tab). The UI shows a friendly "already distributed" note.
 */
export class AlreadyDistributedError extends Error {
  constructor() {
    super('runDistribution: a distribution already ran today for this khatma');
    this.name = 'AlreadyDistributedError';
  }
}

/** Everything needed to mint khatma N+1 if this round rolls over. */
export interface RolloverSeed {
  seriesId: string;
  seriesName: string;
  /** Optional public-folder artwork inherited by rollover khatmas. */
  imageName?: string;
  /** The next number in the series (current max + 1). */
  seriesNumber: number;
  totalPages: number;
  scope: PageScope;
  memberIds: string[];
  /** Chosen by `pickDuaReciter` over all prior khatmas — computed by the caller. */
  duaReciterId: string;
  /** Per-member capacities carried into the new khatma (memberId -> capacity). */
  capacities: Record<string, MemberCapacity>;
  /** The full resolved scope pool (`resolvePageScope(scope)`). */
  pool: number[];
}

export interface RunDistributionParams {
  /** Active khatma ids to distribute. The dashboard normally passes one. */
  khatmaIds: string[];
  /** Participating members in roster order (from the newest khatma's memberIds). */
  members: DistributionMember[];
  /** ISO date (YYYY-MM-DD) — the idempotency key and the chunks' date stamp. */
  today: string;
  rolloverSeed: RolloverSeed;
  /** page -> surah/juz lookups for whole-surah / whole-juz capacities. */
  unitOfPage?: PageUnitMaps;
  /** Recall pending loose pages first and permit another run on the same date. */
  redistributePages?: boolean;
}

export interface DistributionOutcome {
  /** Set when this round minted khatma N+1. */
  rolloverKhatmaId?: string;
  /** Khatmas that finished (every page read) and were flipped to completed. */
  completedKhatmaIds: string[];
  /** How many members received a chunk. */
  chunkCount: number;
}

/** Apply the plan's appended chunk + settled streak to one assignment doc. */
function nextAssignment(
  existing: Assignment,
  appended: RoundChunk | undefined,
  missedStreak: number,
): Assignment {
  const rounds = appended ? [...existing.rounds, appended] : existing.rounds;
  return {
    memberId: existing.memberId,
    rounds,
    doneByRound: existing.doneByRound,
    missedStreak,
  };
}

/**
 * Recall only the loose-page portion of pending chunks. Whole-surah and
 * whole-juz portions stay with their readers.
 */
interface PageRecallResult {
  changedAssignments: Set<string>;
  /** Members still holding a preserved whole-unit allocation; freeze their warning. */
  preservedMemberIds: Set<string>;
}

function recallLoosePages(
  khatmas: Array<Khatma & { assignments: Assignment[] }>,
): PageRecallResult {
  const changedAssignments = new Set<string>();
  const preservedMemberIds = new Set<string>();
  for (const khatma of khatmas) {
    for (const assignment of khatma.assignments) {
      for (let i = assignment.rounds.length - 1; i >= 0; i--) {
        const chunk = assignment.rounds[i]!;
        if (
          chunk.pages.length === 0 ||
          chunk.released === true ||
          assignment.doneByRound[chunk.round] !== undefined
        ) {
          continue;
        }
        const recall = recallLoosePagesFromAssignment(assignment, khatma.remainingPages);
        if (!recall) {
          if (chunk.pages.length > 0 && chunk.loosePages.length === 0) {
            preservedMemberIds.add(assignment.memberId);
          }
          break;
        }
        khatma.assignments[khatma.assignments.indexOf(assignment)] = recall.assignment;
        khatma.remainingPages = recall.remainingPages;
        changedAssignments.add(`${khatma.id}:${assignment.memberId}`);
        if (recall.assignment.rounds[i]?.pages.length) {
          preservedMemberIds.add(assignment.memberId);
        }
        break;
      }
    }
  }
  return { changedAssignments, preservedMemberIds };
}

/**
 * Run one distribution round for the selected khatma(s) as a single
 * Firestore transaction: re-reads every active khatma + assignment doc,
 * re-checks the same-day guard, re-plans on the transactional snapshot, and
 * applies everything atomically — new chunks, escalated warnings, pool updates,
 * completions, and (at rollover) the creation of khatma N+1 with its assignment
 * docs. Unread chunks are NOT reclaimed here — that is a separate admin action
 * (`releaseMemberChunk`). Retried automatically by Firestore on contention; a
 * concurrent same-day run loses and surfaces {@link AlreadyDistributedError}.
 * In redistribution mode, pending loose pages are recalled inside the same
 * transaction and the same-day guard is intentionally bypassed.
 */
export function runDistribution(
  params: RunDistributionParams,
): Promise<DistributionOutcome> {
  const {
    khatmaIds,
    members,
    today,
    rolloverSeed,
    unitOfPage,
    redistributePages = false,
  } = params;

  return runTransaction(db, async (tx) => {
    // --- Reads (Firestore requires all reads before any write) -------------
    const khatmas: Array<Khatma & { assignments: Assignment[] }> = [];
    for (const id of khatmaIds) {
      const snap = await tx.get(doc(khatmasCol, id));
      if (!snap.exists()) throw new Error(`runDistribution: khatma ${id} not found`);
      const khatma = { id, ...(snap.data() as Omit<Khatma, 'id'>) };
      if (khatma.status !== 'active') continue; // completed since the button was drawn
      if (!redistributePages && khatma.lastDistributionDate === today) {
        throw new AlreadyDistributedError();
      }
      khatmas.push({ ...khatma, assignments: [] });
    }
    khatmas.sort((a, b) => a.seriesNumber - b.seriesNumber);

    for (const khatma of khatmas) {
      for (const memberId of khatma.memberIds) {
        const snap = await tx.get(assignmentDoc(khatma.id, memberId));
        khatma.assignments.push(
          snap.exists()
            ? (snap.data() as Assignment)
            : { memberId, rounds: [], doneByRound: {}, missedStreak: 0 },
        );
      }
    }

    const pageRecall = redistributePages
      ? recallLoosePages(khatmas)
      : { changedAssignments: new Set<string>(), preservedMemberIds: new Set<string>() };

    // --- Plan on the transactional snapshot --------------------------------
    const states: DistributionKhatmaState[] = khatmas.map((k) => ({
      id: k.id,
      seriesNumber: k.seriesNumber,
      remainingPages: k.remainingPages,
      roundCount: k.roundCount,
      assignments: k.assignments,
    }));
    const plan = planDistribution({
      khatmas: states,
      members: members.map((member) =>
        pageRecall.preservedMemberIds.has(member.id)
          ? { ...member, enabled: false }
          : member,
      ),
      newKhatmaPool: rolloverSeed.pool,
      newKhatmaSeriesNumber: rolloverSeed.seriesNumber,
      unitOfPage,
    });

    const finalStreak = (memberId: string): number => {
      if (plan.streaks[memberId] !== undefined) return plan.streaks[memberId];
      let streak = 0;
      for (const k of khatmas) {
        const a = k.assignments.find((x) => x.memberId === memberId);
        if (a && a.missedStreak > streak) streak = a.missedStreak;
      }
      return streak;
    };

    // --- Writes -------------------------------------------------------------
    for (const update of plan.khatmaUpdates) {
      const completed = plan.completions.includes(update.khatmaId);
      tx.update(doc(khatmasCol, update.khatmaId), {
        remainingPages: update.remainingPages,
        roundCount: update.roundCount,
        lastDistributionDate: today,
        ...(completed ? { status: 'completed', completedAt: Date.now() } : {}),
      });
    }

    let chunkCount = 0;
    for (const khatma of khatmas) {
      for (const assignment of khatma.assignments) {
        const planned = plan.chunks.find(
          (c) => c.khatmaId === khatma.id && c.memberId === assignment.memberId,
        );
        const appended: RoundChunk | undefined = planned
          ? {
              round: planned.round,
              date: today,
              pages: planned.pages,
              loosePages: planned.loosePages,
              redistributedPages: [],
            }
          : undefined;
        if (planned) chunkCount++;

        const streak = finalStreak(assignment.memberId);
        if (
          !appended &&
          streak === assignment.missedStreak &&
          !pageRecall.changedAssignments.has(`${khatma.id}:${assignment.memberId}`)
        ) {
          continue; // untouched — skip the write
        }
        tx.set(
          assignmentDoc(khatma.id, assignment.memberId),
          nextAssignment(assignment, appended, streak),
        );
      }
    }

    // --- Rollover: mint khatma N+1 with its assignment docs -----------------
    let rolloverKhatmaId: string | undefined;
    if (plan.rollover) {
      const newRef = doc(khatmasCol);
      rolloverKhatmaId = newRef.id;
      tx.set(newRef, {
        seriesId: rolloverSeed.seriesId,
        seriesName: rolloverSeed.seriesName,
        ...(rolloverSeed.imageName ? { imageName: rolloverSeed.imageName } : {}),
        seriesNumber: rolloverSeed.seriesNumber,
        totalPages: rolloverSeed.totalPages,
        scope: rolloverSeed.scope,
        memberIds: rolloverSeed.memberIds,
        remainingPages: plan.rollover.remainingPages,
        roundCount: 1,
        lastDistributionDate: today,
        duaReciterId: rolloverSeed.duaReciterId,
        capacities: rolloverSeed.capacities,
        status: 'active',
        createdAt: Date.now(),
      });
      for (const memberId of rolloverSeed.memberIds) {
        const planned = plan.chunks.find(
          (c) => c.khatmaId === null && c.memberId === memberId,
        );
        if (planned) chunkCount++;
        const rounds: RoundChunk[] = planned
          ? [
              {
                round: planned.round,
                date: today,
                pages: planned.pages,
                loosePages: planned.loosePages,
                redistributedPages: [],
              },
            ]
          : [];
        tx.set(assignmentDoc(newRef.id, memberId), {
          memberId,
          rounds,
          doneByRound: {},
          // Warnings carry over so a flag doesn't silently reset at rollover.
          missedStreak: finalStreak(memberId),
        });
      }
    }

    return { rolloverKhatmaId, completedKhatmaIds: plan.completions, chunkCount };
  });
}

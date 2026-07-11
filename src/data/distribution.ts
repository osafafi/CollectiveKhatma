import { doc, runTransaction } from 'firebase/firestore';
import {
  planDistribution,
  type DistributionKhatmaState,
  type DistributionMember,
} from '@/domain/distribution';
import type { PageUnitMaps } from '@/domain/assignment';
import type { Assignment, Khatma, MemberCapacity, PageScope, RoundChunk } from '@/domain/types';
import { assignmentDoc, fromStored, type StoredAssignment } from './assignments';
import { db } from './firebase';
import { khatmasCol } from './khatmas';

/**
 * Thrown when a distribution already ran today for this series (double-press,
 * or a second admin tab). The UI shows a friendly "already distributed" note.
 */
export class AlreadyDistributedError extends Error {
  constructor() {
    super('runDistribution: a distribution already ran today for this series');
    this.name = 'AlreadyDistributedError';
  }
}

/** Everything needed to mint khatma N+1 if this round rolls over. */
export interface RolloverSeed {
  seriesId: string;
  seriesName: string;
  /** The next number in the series (current max + 1). */
  seriesNumber: number;
  totalPages: number;
  scope: PageScope;
  memberIds: string[];
  anonymous: boolean;
  /** Chosen by `pickDuaReciter` over all prior khatmas — computed by the caller. */
  duaReciterId?: string;
  /** Per-member capacities carried into the new khatma (memberId -> capacity). */
  capacities?: Record<string, MemberCapacity>;
  /** The full resolved scope pool (`resolvePageScope(scope)`). */
  pool: number[];
}

export interface RunDistributionParams {
  /** The series' ACTIVE khatma ids. Order does not matter (sorted internally). */
  khatmaIds: string[];
  /** Participating members in roster order (from the newest khatma's memberIds). */
  members: DistributionMember[];
  /** ISO date (YYYY-MM-DD) — the idempotency key and the chunks' date stamp. */
  today: string;
  rolloverSeed: RolloverSeed;
  /** page -> surah/juz lookups for whole-surah / whole-juz capacities. */
  unitOfPage?: PageUnitMaps;
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
  return { memberId: existing.memberId, rounds, doneByRound: existing.doneByRound, missedStreak };
}

/**
 * Run one distribution round for a series (REQUIREMENTS §5) as a single
 * Firestore transaction: re-reads every active khatma + assignment doc,
 * re-checks the same-day guard, re-plans on the transactional snapshot, and
 * applies everything atomically — new chunks, escalated warnings, pool updates,
 * completions, and (at rollover) the creation of khatma N+1 with its assignment
 * docs. Unread chunks are NOT reclaimed here — that is a separate admin action
 * (`releaseMemberChunk`). Retried automatically by Firestore on contention; a
 * concurrent same-day run loses and surfaces {@link AlreadyDistributedError}.
 */
export function runDistribution(params: RunDistributionParams): Promise<DistributionOutcome> {
  const { khatmaIds, members, today, rolloverSeed, unitOfPage } = params;

  return runTransaction(db, async (tx) => {
    // --- Reads (Firestore requires all reads before any write) -------------
    const khatmas: Array<Khatma & { assignments: Assignment[] }> = [];
    for (const id of khatmaIds) {
      const snap = await tx.get(doc(khatmasCol, id));
      if (!snap.exists()) throw new Error(`runDistribution: khatma ${id} not found`);
      const khatma = { id, ...(snap.data() as Omit<Khatma, 'id'>) };
      if (khatma.status !== 'active') continue; // completed since the button was drawn
      if (khatma.lastDistributionDate === today) throw new AlreadyDistributedError();
      khatmas.push({ ...khatma, assignments: [] });
    }
    khatmas.sort((a, b) => a.seriesNumber - b.seriesNumber);

    for (const khatma of khatmas) {
      for (const memberId of khatma.memberIds) {
        const snap = await tx.get(assignmentDoc(khatma.id, memberId));
        khatma.assignments.push(
          snap.exists()
            ? fromStored(snap.data() as StoredAssignment)
            : { memberId, rounds: [], doneByRound: {}, missedStreak: 0 },
        );
      }
    }

    // --- Plan on the transactional snapshot --------------------------------
    const states: DistributionKhatmaState[] = khatmas.map((k) => ({
      id: k.id,
      remainingPages: k.remainingPages,
      roundCount: k.roundCount,
      assignments: k.assignments,
    }));
    const plan = planDistribution({
      khatmas: states,
      members,
      newKhatmaPool: rolloverSeed.pool,
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
          ? { round: planned.round, date: today, pages: planned.pages }
          : undefined;
        if (planned) chunkCount++;

        const streak = finalStreak(assignment.memberId);
        if (!appended && streak === assignment.missedStreak) {
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
        seriesNumber: rolloverSeed.seriesNumber,
        totalPages: rolloverSeed.totalPages,
        scope: rolloverSeed.scope,
        memberIds: rolloverSeed.memberIds,
        anonymous: rolloverSeed.anonymous,
        remainingPages: plan.rollover.remainingPages,
        roundCount: 1,
        lastDistributionDate: today,
        ...(rolloverSeed.duaReciterId ? { duaReciterId: rolloverSeed.duaReciterId } : {}),
        ...(rolloverSeed.capacities ? { capacities: rolloverSeed.capacities } : {}),
        status: 'active',
        createdAt: Date.now(),
      });
      for (const memberId of rolloverSeed.memberIds) {
        const planned = plan.chunks.find((c) => c.khatmaId === null && c.memberId === memberId);
        if (planned) chunkCount++;
        const rounds: RoundChunk[] = planned
          ? [{ round: planned.round, date: today, pages: planned.pages }]
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

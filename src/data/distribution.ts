import { collection, doc, runTransaction } from 'firebase/firestore';
import {
  buildDistributionDraft,
  type DistributionDraftAdjustments,
  type DistributionDraftMode,
} from '@/domain/distributionDraft';
import {
  planDistribution,
  recallLoosePagesForRedistribution,
  type DistributionKhatmaState,
  type DistributionMember,
} from '@/domain/distribution';
import type { PageUnitMaps } from '@/domain/assignment';
import type {
  Assignment,
  Khatma,
  DistributionRun,
  MemberCapacity,
  PageScope,
  RoundChunk,
} from '@/domain/types';
import { assignmentDoc } from './assignments';
import { db } from './firebase';
import { khatmasCol } from './khatmas';

/** @deprecated Historical error retained for API compatibility; dates no longer gate runs. */
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
  /** Active khatma ids to distribute across the series. */
  khatmaIds: string[];
  /** Participating members in roster order (from the newest khatma's memberIds). */
  members: DistributionMember[];
  /** ISO date (YYYY-MM-DD) used as informational chunk metadata. */
  today: string;
  rolloverSeed: RolloverSeed;
  /** page -> Surah/Juz lookups for specific whole-unit selections. */
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
  /** Series-level run created or revised by the confirmed operation. */
  runId?: string;
  revision?: number;
  releaseCount?: number;
}

export class StaleDistributionDraftError extends Error {
  constructor() {
    super('commitDistributionRun: the preview source changed before confirmation');
    this.name = 'StaleDistributionDraftError';
  }
}

export class NoDistributionChangesError extends Error {
  constructor() {
    super('commitDistributionRun: the confirmed draft contains no changes');
    this.name = 'NoDistributionChangesError';
  }
}

export interface CommitDistributionRunParams {
  khatmaIds: string[];
  mode: DistributionDraftMode;
  expectedSourceRevision: string;
  adjustments: DistributionDraftAdjustments;
  today: string;
  rolloverSeed: RolloverSeed;
  unitOfPage?: PageUnitMaps;
}

/** Apply the plan's appended chunk + settled streak to one assignment doc. */
function nextAssignment(
  existing: Assignment,
  appended: RoundChunk | undefined,
  missedStreak: number,
  releasedAt?: number,
): Assignment {
  const existingRounds = releasedAt
    ? existing.rounds.map((chunk) =>
        chunk.status === 'released' &&
        chunk.releaseReason !== undefined &&
        chunk.releasedAt === undefined
          ? { ...chunk, releasedAt }
          : chunk,
      )
    : existing.rounds;
  const rounds = appended ? [...existingRounds, appended] : existingRounds;
  return {
    memberId: existing.memberId,
    rounds,
    doneByRound: existing.doneByRound,
    missedStreak,
  };
}

/**
 * Legacy immediate-write entry point retained for migration tests. New admin UI
 * uses {@link commitDistributionRun}, which has preview/revision semantics.
 * Re-reads every active khatma + assignment doc, re-plans on the transactional snapshot, and
 * applies everything atomically — new chunks, escalated warnings, pool updates,
 * completions, and (at rollover) the creation of khatma N+1 with its assignment
 * docs. Unread chunks are NOT reclaimed here — that is a separate admin action
 * (`releaseMemberChunk`). Retried automatically by Firestore on contention; a
 * In redistribution mode, pending loose pages are recalled inside the same
 * transaction and reshuffled within the current round; rollover is disabled.
 * @deprecated Prefer {@link commitDistributionRun}.
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

    // --- Plan on the transactional snapshot --------------------------------
    let states: DistributionKhatmaState[] = khatmas.map((k) => ({
      id: k.id,
      seriesNumber: k.seriesNumber,
      remainingPages: k.remainingPages,
      roundCount: k.roundCount,
      assignments: k.assignments,
    }));
    const pageRecall = redistributePages
      ? recallLoosePagesForRedistribution(states)
      : {
          khatmas: states,
          changedAssignments: new Set<string>(),
          eligibleMemberIds: new Set<string>(),
        };
    if (redistributePages) {
      states = pageRecall.khatmas;
      for (const khatma of khatmas) {
        const recalled = states.find((state) => state.id === khatma.id);
        if (!recalled) continue;
        khatma.remainingPages = recalled.remainingPages;
        khatma.assignments = recalled.assignments;
      }
    }
    const plan = planDistribution({
      khatmas: states,
      members: redistributePages
        ? members.map((member) => ({
            ...member,
            enabled: member.enabled && pageRecall.eligibleMemberIds.has(member.id),
          }))
        : members,
      newKhatmaPool: rolloverSeed.pool,
      newKhatmaSeriesNumber: rolloverSeed.seriesNumber,
      unitOfPage,
      mode: redistributePages ? 'redistribution' : 'new-round',
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

export const distributionRunsCol = collection(db, 'distributionRuns');

function runDoc(id: string) {
  return doc(distributionRunsCol, id);
}

/**
 * Confirm a frozen series-wide preview. The transaction rebuilds the same draft
 * from current Firestore data, rejects stale input, then writes the run, chunks,
 * recalls, pool updates, completion, and optional rollover atomically.
 */
export function commitDistributionRun(
  params: CommitDistributionRunParams,
): Promise<DistributionOutcome> {
  const {
    khatmaIds,
    mode,
    expectedSourceRevision,
    adjustments,
    today,
    rolloverSeed,
    unitOfPage,
  } = params;

  return runTransaction(db, async (tx) => {
    const khatmas: Array<Khatma & { assignments: Assignment[] }> = [];
    for (const id of khatmaIds) {
      const snap = await tx.get(doc(khatmasCol, id));
      if (!snap.exists())
        throw new Error(`commitDistributionRun: khatma ${id} not found`);
      const khatma = { id, ...(snap.data() as Omit<Khatma, 'id'>) };
      if (khatma.status === 'active') khatmas.push({ ...khatma, assignments: [] });
    }
    khatmas.sort((left, right) => left.seriesNumber - right.seriesNumber);
    const latest = khatmas[khatmas.length - 1];
    if (!latest) throw new NoDistributionChangesError();

    const seriesMemberIds = [...new Set(khatmas.flatMap((khatma) => khatma.memberIds))];
    for (const khatma of khatmas) {
      for (const memberId of seriesMemberIds) {
        const snap = await tx.get(assignmentDoc(khatma.id, memberId));
        khatma.assignments.push(
          snap.exists()
            ? (snap.data() as Assignment)
            : { memberId, rounds: [], doneByRound: {}, missedStreak: 0 },
        );
      }
    }

    const members: DistributionMember[] = [];
    for (const memberId of seriesMemberIds) {
      const personSnap = await tx.get(doc(db, 'roster', memberId));
      if (!personSnap.exists()) continue;
      const person = personSnap.data() as {
        completedPages?: number[];
        enabled: boolean;
        holdPages?: boolean;
        pagesPerDay: number;
      };
      const owningKhatma = [...khatmas]
        .reverse()
        .find((candidate) => candidate.capacities[memberId] !== undefined);
      members.push({
        id: memberId,
        capacity: owningKhatma?.capacities[memberId] ?? {
          pages: person.pagesPerDay,
          surahs: 0,
          juz: 0,
        },
        completedPages: person.completedPages ?? [],
        enabled: person.enabled,
        holdPages: person.holdPages === true,
      });
    }

    const expectedRolloverMemberIds = members.map((member) => member.id);
    const expectedRolloverCapacities = Object.fromEntries(
      members.map((member) => [member.id, member.capacity]),
    );
    if (
      latest.seriesId !== rolloverSeed.seriesId ||
      latest.seriesName !== rolloverSeed.seriesName ||
      (latest.imageName ?? '') !== (rolloverSeed.imageName ?? '') ||
      rolloverSeed.scope.kind !== 'full' ||
      rolloverSeed.totalPages !== 604 ||
      rolloverSeed.pool.length !== 604 ||
      rolloverSeed.seriesNumber !==
        Math.max(...khatmas.map((khatma) => khatma.seriesNumber)) + 1 ||
      JSON.stringify(rolloverSeed.memberIds) !==
        JSON.stringify(expectedRolloverMemberIds) ||
      JSON.stringify(rolloverSeed.capacities) !==
        JSON.stringify(expectedRolloverCapacities)
    ) {
      throw new StaleDistributionDraftError();
    }

    const currentRunIds = [
      ...new Set(
        khatmas.flatMap((khatma) =>
          khatma.currentDistributionRunId ? [khatma.currentDistributionRunId] : [],
        ),
      ),
    ];
    const currentRunSnaps = new Map<string, Awaited<ReturnType<typeof tx.get>>>();
    for (const id of currentRunIds) currentRunSnaps.set(id, await tx.get(runDoc(id)));

    const states: DistributionKhatmaState[] = khatmas.map((khatma) => ({
      id: khatma.id,
      seriesNumber: khatma.seriesNumber,
      remainingPages: khatma.remainingPages,
      roundCount: khatma.roundCount,
      assignments: khatma.assignments,
    }));
    const draft = buildDistributionDraft({
      mode,
      khatmas: states,
      members,
      newKhatmaPool: rolloverSeed.pool,
      newKhatmaSeriesNumber: rolloverSeed.seriesNumber,
      unitOfPage,
      adjustments,
    });
    if (draft.sourceRevision !== expectedSourceRevision) {
      throw new StaleDistributionDraftError();
    }
    if (
      draft.allocations.length === 0 &&
      draft.releases.length === 0 &&
      draft.plan.completions.length === 0
    ) {
      throw new NoDistributionChangesError();
    }

    const existingRunId = latest.currentDistributionRunId;
    const existingRunSnap = existingRunId
      ? currentRunSnaps.get(existingRunId)
      : undefined;
    const existingRun = existingRunSnap?.exists()
      ? (existingRunSnap.data() as Omit<DistributionRun, 'id'>)
      : undefined;
    const highestCurrentRunNumber = Math.max(
      0,
      ...[...currentRunSnaps.values()]
        .filter((snap) => snap.exists())
        .map((snap) => (snap.data() as Omit<DistributionRun, 'id'>).number),
    );
    const existingRevision = Math.max(
      latest.distributionRevision ?? 0,
      existingRun?.revision ?? 0,
    );
    const newRunRef =
      mode === 'adjust-current' && existingRunId
        ? runDoc(existingRunId)
        : doc(distributionRunsCol);
    const runId = newRunRef.id;
    const revision = mode === 'adjust-current' ? Math.max(1, existingRevision + 1) : 1;
    const committedAt = Date.now();
    const openedAt =
      mode === 'adjust-current' && existingRun ? existingRun.openedAt : committedAt;
    const rolloverRef = draft.plan.rollover ? doc(khatmasCol) : undefined;

    if (mode === 'new-round') {
      for (const [id, snap] of currentRunSnaps) {
        if (snap.exists())
          tx.update(runDoc(id), {
            status: 'closed',
            closedAt: committedAt,
            updatedAt: committedAt,
          });
      }
    }

    const finalStreak = (memberId: string): number => {
      if (draft.plan.streaks[memberId] !== undefined) {
        return draft.plan.streaks[memberId];
      }
      let streak = 0;
      for (const khatma of draft.preparedKhatmas) {
        const assignment = khatma.assignments.find(
          (candidate) => candidate.memberId === memberId,
        );
        if (assignment && assignment.missedStreak > streak)
          streak = assignment.missedStreak;
      }
      return streak;
    };

    for (const update of draft.plan.khatmaUpdates) {
      const completed = draft.plan.completions.includes(update.khatmaId);
      const storedKhatma = khatmas.find((khatma) => khatma.id === update.khatmaId)!;
      const addedRecipients = draft.allocations
        .filter((allocation) => allocation.khatmaId === update.khatmaId)
        .map((allocation) => allocation.memberId)
        .filter((memberId) => !storedKhatma.memberIds.includes(memberId));
      const addedCapacities = Object.fromEntries(
        addedRecipients.map((memberId) => [
          memberId,
          members.find((member) => member.id === memberId)!.capacity,
        ]),
      );
      tx.update(doc(khatmasCol, update.khatmaId), {
        remainingPages: update.remainingPages,
        roundCount: update.roundCount,
        lastDistributionDate: today,
        currentDistributionRunId: runId,
        distributionRevision: revision,
        ...(addedRecipients.length > 0
          ? {
              memberIds: [...storedKhatma.memberIds, ...addedRecipients],
              capacities: { ...storedKhatma.capacities, ...addedCapacities },
            }
          : {}),
        ...(completed ? { status: 'completed', completedAt: committedAt } : {}),
      });
    }

    for (const khatma of draft.preparedKhatmas) {
      for (const prepared of khatma.assignments) {
        const allocation = draft.allocations.find(
          (candidate) =>
            candidate.khatmaId === khatma.id && candidate.memberId === prepared.memberId,
        );
        const appended: RoundChunk | undefined = allocation
          ? {
              id: `${runId}:${khatma.id}:${prepared.memberId}:${revision}`,
              runId,
              status: 'pending',
              round: allocation.round,
              date: today,
              pages: allocation.pages,
              loosePages: allocation.loosePages,
              redistributedPages: [],
            }
          : undefined;
        const storedKhatma = khatmas.find((candidate) => candidate.id === khatma.id)!;
        if (!storedKhatma.memberIds.includes(prepared.memberId) && !appended) continue;
        tx.set(
          assignmentDoc(khatma.id, prepared.memberId),
          nextAssignment(prepared, appended, finalStreak(prepared.memberId), committedAt),
        );
      }
    }

    let rolloverKhatmaId: string | undefined;
    if (draft.plan.rollover && rolloverRef) {
      rolloverKhatmaId = rolloverRef.id;
      tx.set(rolloverRef, {
        seriesId: rolloverSeed.seriesId,
        seriesName: rolloverSeed.seriesName,
        ...(rolloverSeed.imageName ? { imageName: rolloverSeed.imageName } : {}),
        seriesNumber: rolloverSeed.seriesNumber,
        totalPages: rolloverSeed.totalPages,
        scope: rolloverSeed.scope,
        memberIds: rolloverSeed.memberIds,
        remainingPages: draft.plan.rollover.remainingPages,
        roundCount: 1,
        lastDistributionDate: today,
        currentDistributionRunId: runId,
        distributionRevision: revision,
        duaReciterId: rolloverSeed.duaReciterId,
        capacities: rolloverSeed.capacities,
        status: 'active',
        createdAt: committedAt,
      });
      for (const memberId of rolloverSeed.memberIds) {
        const allocation = draft.allocations.find(
          (candidate) => candidate.khatmaId === null && candidate.memberId === memberId,
        );
        const rounds: RoundChunk[] = allocation
          ? [
              {
                id: `${runId}:${rolloverRef.id}:${memberId}:${revision}`,
                runId,
                status: 'pending',
                round: allocation.round,
                date: today,
                pages: allocation.pages,
                loosePages: allocation.loosePages,
                redistributedPages: [],
              },
            ]
          : [];
        tx.set(assignmentDoc(rolloverRef.id, memberId), {
          memberId,
          rounds,
          doneByRound: {},
          missedStreak: finalStreak(memberId),
        });
      }
    }

    const run: Omit<DistributionRun, 'id'> = {
      seriesId: rolloverSeed.seriesId,
      number:
        mode === 'adjust-current'
          ? (existingRun?.number ??
            Math.max(1, ...khatmas.map((khatma) => khatma.roundCount)))
          : highestCurrentRunNumber > 0
            ? highestCurrentRunNumber + 1
            : Math.max(0, ...khatmas.map((khatma) => khatma.roundCount)) + 1,
      status: 'open',
      revision,
      mode,
      khatmaIds:
        mode === 'adjust-current' && existingRun
          ? existingRun.khatmaIds
          : [
              ...khatmas.map((khatma) => khatma.id),
              ...(rolloverRef ? [rolloverRef.id] : []),
            ],
      openedAt,
      updatedAt: committedAt,
      ...(mode === 'adjust-current' && existingRun?.rollover
        ? { rollover: existingRun.rollover }
        : rolloverRef
          ? {
              rollover: {
                fromKhatmaId: khatmas[khatmas.length - 1]!.id,
                toKhatmaId: rolloverRef.id,
              },
            }
          : {}),
    };
    tx.set(newRunRef, run);

    return {
      runId,
      revision,
      ...(rolloverKhatmaId ? { rolloverKhatmaId } : {}),
      completedKhatmaIds: draft.plan.completions,
      chunkCount: draft.allocations.length,
      releaseCount: draft.releases.length,
    };
  });
}

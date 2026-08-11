import {
  planDistribution,
  recallLoosePagesForRedistribution,
  releaseChunk,
  type DistributionKhatmaState,
  type DistributionMember,
  type DistributionPlan,
} from './distribution';
import type { Assignment, MemberCapacity } from './types';
import type { PageUnitMaps } from './assignment';

export type DistributionDraftMode = 'new-round' | 'adjust-current';
export type PendingPageDecision = 'keep' | 'release' | 'add';

export interface DistributionMemberAdjustment {
  include?: boolean;
  capacity?: MemberCapacity;
  pendingDecision?: PendingPageDecision;
}

export interface DistributionDraftAdjustments {
  allowRollover: boolean;
  members: Record<string, DistributionMemberAdjustment>;
  /** Source-khatma priority; must contain every active khatma exactly once. */
  khatmaOrder?: string[];
  /** A permutation of the planner's allocated readers, one recipient per slot. */
  recipientOrder?: string[];
}

export type DistributionSkipReason =
  | 'disabled'
  | 'excluded'
  | 'pending-kept'
  | 'whole-unit-preserved'
  | 'no-pages-available'
  | 'zero-capacity';

export interface DistributionDraftSkip {
  memberId: string;
  reason: DistributionSkipReason;
}

export interface DistributionDraftRelease {
  khatmaId: string;
  memberId: string;
  pages: number[];
}

export interface DistributionDraftAllocation {
  slotId: string;
  khatmaId: string | null;
  memberId: string;
  round: number;
  pages: number[];
  loosePages: number[];
  /** Recipients with the same configured load whose pages can swap here. */
  swappableMemberIds: string[];
}

export interface DistributionDraft {
  mode: DistributionDraftMode;
  sourceRevision: string;
  preparedKhatmas: DistributionKhatmaState[];
  plan: DistributionPlan;
  allocations: DistributionDraftAllocation[];
  releases: DistributionDraftRelease[];
  skipped: DistributionDraftSkip[];
}

export interface BuildDistributionDraftInput {
  mode: DistributionDraftMode;
  khatmas: DistributionKhatmaState[];
  members: DistributionMember[];
  newKhatmaPool: number[];
  newKhatmaSeriesNumber: number;
  unitOfPage?: PageUnitMaps;
  adjustments: DistributionDraftAdjustments;
}

export class InvalidDistributionDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDistributionDraftError';
  }
}

function isPending(assignment: Assignment, roundIndex: number): boolean {
  const chunk = assignment.rounds[roundIndex];
  return Boolean(
    chunk &&
    chunk.pages.length > 0 &&
    chunk.released !== true &&
    chunk.status !== 'released' &&
    chunk.status !== 'completed' &&
    assignment.doneByRound[chunk.round] === undefined,
  );
}

function applyExplicitReleases(
  khatmas: readonly DistributionKhatmaState[],
  adjustments: DistributionDraftAdjustments,
): { khatmas: DistributionKhatmaState[]; releases: DistributionDraftRelease[] } {
  const releases: DistributionDraftRelease[] = [];
  const next = khatmas.map((khatma) => {
    let remainingPages = [...khatma.remainingPages];
    const assignments = khatma.assignments.map((assignment) => {
      if (adjustments.members[assignment.memberId]?.pendingDecision !== 'release') {
        return assignment;
      }
      const released = releaseChunk(assignment, remainingPages);
      if (!released) return assignment;
      const pages = assignment.rounds.flatMap((chunk, index) =>
        isPending(assignment, index) ? chunk.pages : [],
      );
      releases.push({ khatmaId: khatma.id, memberId: assignment.memberId, pages });
      remainingPages = released.remainingPages;
      return {
        ...assignment,
        missedStreak: 0,
        rounds: assignment.rounds.map((chunk, index) =>
          isPending(assignment, index)
            ? {
                ...chunk,
                released: true as const,
                status: 'released' as const,
                releaseReason: 'admin-next-round',
              }
            : chunk,
        ),
      };
    });
    return { ...khatma, remainingPages, assignments };
  });
  return { khatmas: next, releases };
}

function memberCapacityIsZero(capacity: MemberCapacity): boolean {
  return capacity.pages <= 0 && capacity.surahs <= 0 && capacity.juz <= 0;
}

function hasPendingPages(khatmas: readonly DistributionKhatmaState[], memberId: string) {
  return khatmas.some((khatma) =>
    khatma.assignments.some(
      (assignment) =>
        assignment.memberId === memberId &&
        assignment.rounds.some((_, index) => isPending(assignment, index)),
    ),
  );
}

function stableRevision(
  input: Pick<
    BuildDistributionDraftInput,
    'khatmas' | 'members' | 'newKhatmaPool' | 'newKhatmaSeriesNumber'
  >,
): string {
  const memberIds = new Set(input.members.map((member) => member.id));
  const serialized = JSON.stringify({
    khatmas: input.khatmas.map((khatma) => ({
      id: khatma.id,
      seriesNumber: khatma.seriesNumber,
      remainingPages: khatma.remainingPages,
      roundCount: khatma.roundCount,
      assignments: khatma.assignments
        .filter((assignment) => memberIds.has(assignment.memberId))
        .map((assignment) => ({
          memberId: assignment.memberId,
          rounds: assignment.rounds,
          doneByRound: assignment.doneByRound,
          missedStreak: assignment.missedStreak,
        })),
    })),
    members: input.members,
    newKhatmaPool: input.newKhatmaPool,
    newKhatmaSeriesNumber: input.newKhatmaSeriesNumber,
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index++) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function applyRecipientOrder(
  plan: DistributionPlan,
  members: readonly DistributionMember[],
  recipientOrder: readonly string[] | undefined,
): DistributionDraftAllocation[] {
  const baseRecipients = plan.chunks.map((chunk) => chunk.memberId);
  const recipients = recipientOrder ?? baseRecipients;
  if (
    recipients.length !== baseRecipients.length ||
    [...recipients].sort().join('|') !== [...baseRecipients].sort().join('|')
  ) {
    throw new InvalidDistributionDraftError(
      'Recipient order must be a permutation of the proposed recipients.',
    );
  }
  const capacityByMember = new Map(members.map((member) => [member.id, member.capacity]));
  const comparable = (leftIndex: number, rightIndex: number): boolean => {
    const left = plan.chunks[leftIndex]!;
    const right = plan.chunks[rightIndex]!;
    const leftCapacity = capacityByMember.get(left.memberId)!;
    const rightCapacity = capacityByMember.get(right.memberId)!;
    return (
      left.khatmaId === right.khatmaId &&
      leftCapacity.pages === rightCapacity.pages &&
      leftCapacity.surahs === rightCapacity.surahs &&
      leftCapacity.juz === rightCapacity.juz
    );
  };
  for (let index = 0; index < recipients.length; index++) {
    const originalIndex = baseRecipients.indexOf(recipients[index]!);
    if (originalIndex < 0 || !comparable(index, originalIndex)) {
      throw new InvalidDistributionDraftError(
        'Page assignments may only swap between comparable capacities in one khatma.',
      );
    }
  }
  return plan.chunks.map((chunk, index) => ({
    slotId: `${chunk.khatmaId ?? 'rollover'}:${chunk.round}:${index}`,
    khatmaId: chunk.khatmaId,
    memberId: recipients[index]!,
    round: chunk.round,
    pages: chunk.pages,
    loosePages: chunk.loosePages,
    swappableMemberIds: plan.chunks.flatMap((candidate, candidateIndex) =>
      comparable(index, candidateIndex) ? [candidate.memberId] : [],
    ),
  }));
}

function applyKhatmaOrder(
  khatmas: readonly DistributionKhatmaState[],
  khatmaOrder: readonly string[] | undefined,
): DistributionKhatmaState[] {
  if (!khatmaOrder) return [...khatmas];
  const baseIds = khatmas.map((khatma) => khatma.id);
  if (
    khatmaOrder.length !== baseIds.length ||
    [...khatmaOrder].sort().join('|') !== [...baseIds].sort().join('|')
  ) {
    throw new InvalidDistributionDraftError(
      'Khatma order must be a permutation of the active khatmas.',
    );
  }
  return khatmaOrder.map((id) => khatmas.find((khatma) => khatma.id === id)!);
}

export function defaultDistributionAdjustments(): DistributionDraftAdjustments {
  return { allowRollover: true, members: {} };
}

/** Build the exact no-write preview that the transaction later reproduces. */
export function buildDistributionDraft(
  input: BuildDistributionDraftInput,
): DistributionDraft {
  const sourceRevision = stableRevision(input);
  const explicit =
    input.mode === 'new-round'
      ? applyExplicitReleases(input.khatmas, input.adjustments)
      : { khatmas: input.khatmas.map((khatma) => ({ ...khatma })), releases: [] };
  const recall =
    input.mode === 'adjust-current'
      ? recallLoosePagesForRedistribution(explicit.khatmas)
      : undefined;
  const preparedKhatmas = applyKhatmaOrder(
    recall?.khatmas ?? explicit.khatmas,
    input.adjustments.khatmaOrder,
  );
  const adjustedMembers = input.members.map((member) => {
    const adjustment = input.adjustments.members[member.id];
    const included = adjustment?.include !== false;
    const eligibleForAdjustment =
      input.mode !== 'adjust-current' ||
      recall?.eligibleMemberIds.has(member.id) === true;
    return {
      ...member,
      capacity: adjustment?.capacity ?? member.capacity,
      enabled: member.enabled && included && eligibleForAdjustment,
      holdPages:
        adjustment?.pendingDecision === 'add'
          ? true
          : adjustment?.pendingDecision === 'release'
            ? false
            : member.holdPages,
    };
  });
  const plan = planDistribution({
    khatmas: preparedKhatmas,
    members: adjustedMembers,
    newKhatmaPool: input.adjustments.allowRollover ? input.newKhatmaPool : [],
    newKhatmaSeriesNumber: input.newKhatmaSeriesNumber,
    unitOfPage: input.unitOfPage,
    mode: input.mode === 'adjust-current' ? 'redistribution' : 'new-round',
  });
  const allocations = applyRecipientOrder(
    plan,
    adjustedMembers,
    input.adjustments.recipientOrder,
  );
  const allocated = new Set(allocations.map((allocation) => allocation.memberId));
  const skipped: DistributionDraftSkip[] = [];
  for (const member of input.members) {
    if (allocated.has(member.id)) continue;
    const adjustment = input.adjustments.members[member.id];
    let reason: DistributionSkipReason;
    if (!member.enabled) reason = 'disabled';
    else if (adjustment?.include === false) reason = 'excluded';
    else if (memberCapacityIsZero(adjustment?.capacity ?? member.capacity)) {
      reason = 'zero-capacity';
    } else if (
      input.mode === 'adjust-current' &&
      recall?.eligibleMemberIds.has(member.id) !== true &&
      hasPendingPages(preparedKhatmas, member.id)
    ) {
      reason = 'whole-unit-preserved';
    } else if (
      input.mode === 'new-round' &&
      hasPendingPages(preparedKhatmas, member.id) &&
      adjustment?.pendingDecision !== 'add'
    ) {
      reason = 'pending-kept';
    } else reason = 'no-pages-available';
    skipped.push({ memberId: member.id, reason });
  }
  const recallReleases: DistributionDraftRelease[] = [];
  if (recall) {
    for (const khatma of input.khatmas) {
      const prepared = preparedKhatmas.find((candidate) => candidate.id === khatma.id);
      if (!prepared) continue;
      for (const assignment of khatma.assignments) {
        const nextAssignment = prepared.assignments.find(
          (candidate) => candidate.memberId === assignment.memberId,
        );
        if (!nextAssignment) continue;
        const before = assignment.rounds.flatMap((chunk) => chunk.pages);
        const after = nextAssignment.rounds.flatMap((chunk) => chunk.pages);
        const afterSet = new Set(after);
        const pages = before.filter((page) => !afterSet.has(page));
        if (pages.length > 0) {
          recallReleases.push({
            khatmaId: khatma.id,
            memberId: assignment.memberId,
            pages,
          });
        }
      }
    }
  }
  return {
    mode: input.mode,
    sourceRevision,
    preparedKhatmas,
    plan,
    allocations,
    releases: [...explicit.releases, ...recallReleases],
    skipped,
  };
}

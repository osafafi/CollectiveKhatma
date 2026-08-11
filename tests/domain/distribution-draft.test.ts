import { describe, expect, it } from 'vitest';
import {
  buildDistributionDraft,
  defaultDistributionAdjustments,
  InvalidDistributionDraftError,
} from '@/domain/distributionDraft';
import type { DistributionKhatmaState, DistributionMember } from '@/domain/distribution';
import type { Assignment, RoundChunk } from '@/domain/types';

function chunk(round: number, pages: number[], loosePages: number[] = pages): RoundChunk {
  return {
    id: `chunk-${round}-${pages.join('-')}`,
    runId: `run-${round}`,
    status: 'pending',
    round,
    date: '2026-08-10',
    pages,
    loosePages,
    redistributedPages: [],
  };
}

function assignment(memberId: string, rounds: RoundChunk[] = []): Assignment {
  return { memberId, rounds, doneByRound: {}, missedStreak: 0 };
}

function khatma(
  id: string,
  seriesNumber: number,
  remainingPages: number[],
  assignments: Assignment[],
): DistributionKhatmaState {
  return { id, seriesNumber, remainingPages, roundCount: 1, assignments };
}

function member(id: string): DistributionMember {
  return {
    id,
    capacity: { pages: 1, surahs: 0, juz: 0 },
    completedPages: [],
    enabled: true,
  };
}

function draftInput(khatmas: DistributionKhatmaState[], members: DistributionMember[]) {
  return {
    mode: 'new-round' as const,
    khatmas,
    members,
    newKhatmaPool: [101, 102, 103, 104],
    newKhatmaSeriesNumber: 3,
    adjustments: defaultDistributionAdjustments(),
  };
}

describe('distribution draft', () => {
  it('plans across every active khatma and keeps a pending member skipped', () => {
    const input = draftInput(
      [
        khatma('khatma-1', 1, [3, 4], [assignment('pending')]),
        khatma(
          'khatma-2',
          2,
          [5, 6],
          [assignment('pending', [chunk(1, [7, 8])]), assignment('ready')],
        ),
      ],
      [member('pending'), member('ready')],
    );

    const draft = buildDistributionDraft(input);

    expect(draft.allocations).toEqual([
      expect.objectContaining({ khatmaId: 'khatma-1', memberId: 'ready' }),
    ]);
    expect(draft.skipped).toContainEqual({
      memberId: 'pending',
      reason: 'pending-kept',
    });

    const reprioritized = buildDistributionDraft({
      ...input,
      adjustments: {
        ...input.adjustments,
        khatmaOrder: ['khatma-2', 'khatma-1'],
      },
    });
    expect(reprioritized.allocations[0]?.khatmaId).toBe('khatma-2');
  });

  it('previews an explicit release before reassigning its pages', () => {
    const input = draftInput(
      [khatma('khatma-1', 1, [3, 4], [assignment('reader', [chunk(1, [1, 2])])])],
      [member('reader')],
    );

    const draft = buildDistributionDraft({
      ...input,
      adjustments: {
        allowRollover: true,
        members: { reader: { pendingDecision: 'release' } },
      },
    });

    expect(draft.releases).toEqual([
      { khatmaId: 'khatma-1', memberId: 'reader', pages: [1, 2] },
    ]);
    expect(draft.allocations[0]).toEqual(
      expect.objectContaining({ memberId: 'reader', pages: [1, 2, 3] }),
    );
    expect(draft.preparedKhatmas[0]?.assignments[0]?.rounds[0]?.status).toBe('released');
  });

  it('explains when current-round adjustment preserves a whole unit', () => {
    const input = draftInput(
      [
        khatma(
          'khatma-1',
          1,
          [4, 5],
          [assignment('surah-reader', [chunk(1, [1, 2, 3], [1, 2])])],
        ),
      ],
      [member('surah-reader')],
    );

    const draft = buildDistributionDraft({ ...input, mode: 'adjust-current' });

    expect(draft.releases[0]?.pages).toEqual([1, 2]);
    expect(draft.allocations).toHaveLength(0);
    expect(draft.skipped).toContainEqual({
      memberId: 'surah-reader',
      reason: 'whole-unit-preserved',
    });
  });

  it('allows recipient swaps without changing the proposed page slots', () => {
    const input = draftInput(
      [khatma('khatma-1', 1, [1, 2, 3, 4, 5, 6], [])],
      [member('first'), member('second')],
    );
    const initial = buildDistributionDraft(input);
    const reversed = initial.allocations
      .map((allocation) => allocation.memberId)
      .reverse();

    expect(initial.allocations[0]?.swappableMemberIds).toEqual(['first', 'second']);

    const swapped = buildDistributionDraft({
      ...input,
      adjustments: { ...input.adjustments, recipientOrder: reversed },
    });

    expect(swapped.allocations.map((allocation) => allocation.pages)).toEqual(
      initial.allocations.map((allocation) => allocation.pages),
    );
    expect(swapped.allocations.map((allocation) => allocation.memberId)).toEqual(
      reversed,
    );
    expect(() =>
      buildDistributionDraft({
        ...input,
        adjustments: {
          ...input.adjustments,
          recipientOrder: ['first', 'first'],
        },
      }),
    ).toThrow(InvalidDistributionDraftError);
  });

  it('rejects swaps when configured capacities are not comparable', () => {
    const second = member('second');
    second.capacity.pages = 2;
    const input = draftInput(
      [khatma('khatma-1', 1, [1, 2, 3, 4, 5, 6, 7, 8], [])],
      [member('first'), second],
    );

    const initial = buildDistributionDraft(input);
    expect(initial.allocations[0]?.swappableMemberIds).toEqual(['first']);
    expect(() =>
      buildDistributionDraft({
        ...input,
        adjustments: {
          ...input.adjustments,
          recipientOrder: ['second', 'first'],
        },
      }),
    ).toThrow(InvalidDistributionDraftError);
  });

  it('uses one revision for semantically equal Firestore maps and page sets', () => {
    const firstMember = member('reader');
    firstMember.completedPages = [4, 2, 4];
    const firstChunk = chunk(1, [7]);
    const input = draftInput(
      [khatma('khatma-1', 1, [8, 9], [assignment('reader', [firstChunk])])],
      [firstMember],
    );

    const reorderedChunk = {
      redistributedPages: [],
      loosePages: [7],
      pages: [7],
      date: '2026-08-10',
      round: 1,
      status: 'pending' as const,
      runId: 'run-1',
      id: 'chunk-1-7',
    };
    const secondMember = member('reader');
    secondMember.completedPages = [2, 4];
    const reordered = draftInput(
      [khatma('khatma-1', 1, [8, 9], [assignment('reader', [reorderedChunk])])],
      [secondMember],
    );

    expect(buildDistributionDraft(reordered).sourceRevision).toBe(
      buildDistributionDraft(input).sourceRevision,
    );
  });
});

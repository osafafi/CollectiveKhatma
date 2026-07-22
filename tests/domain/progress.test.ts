import { describe, expect, it } from 'vitest';
import {
  currentChunk,
  donePageCount,
  hasPendingChunk,
  isRoundDone,
  khatmaProgress,
  memberReadingInsights,
  pendingReaders,
} from '@/domain/progress';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';

function chunk(
  round: number,
  date: string,
  pages: number[],
  released?: true,
): RoundChunk {
  return {
    round,
    date,
    pages,
    loosePages: [...pages],
    redistributedPages: [],
    ...(released ? { released } : {}),
  };
}

// Round 1 done, round 2 (pages 5-6) still pending.
const partly: Assignment = {
  memberId: 'a',
  rounds: [chunk(1, '2026-07-08', [1, 2]), chunk(2, '2026-07-09', [5, 6])],
  doneByRound: { 1: 1_000 },
  missedStreak: 0,
};

// Fully done.
const finished: Assignment = {
  memberId: 'b',
  rounds: [chunk(1, '2026-07-08', [10, 11])],
  doneByRound: { 1: 3_000 },
  missedStreak: 0,
};

// Missed their round: the chunk was released, so nothing is pending.
const flagged: Assignment = {
  memberId: 'c',
  rounds: [chunk(1, '2026-07-08', [20, 21], true)],
  doneByRound: {},
  missedStreak: 1,
};

// Just joined — no rounds yet (the fresh-khatma shape).
const fresh: Assignment = {
  memberId: 'd',
  rounds: [],
  doneByRound: {},
  missedStreak: 0,
};

describe('per-assignment progress', () => {
  it('reads round-done marks', () => {
    expect(isRoundDone(partly, 1)).toBe(true);
    expect(isRoundDone(partly, 2)).toBe(false);
    expect(isRoundDone(fresh, 1)).toBe(false);
  });

  it('finds the pending chunk (and none when done, released, or empty)', () => {
    expect(currentChunk(partly)?.round).toBe(2);
    expect(currentChunk(finished)).toBeUndefined();
    expect(currentChunk(flagged)).toBeUndefined(); // released is never pending
    expect(currentChunk(fresh)).toBeUndefined();
    expect(hasPendingChunk(partly)).toBe(true);
    expect(hasPendingChunk(flagged)).toBe(false);
  });

  it('counts completed pages, never crediting released chunks', () => {
    expect(donePageCount(partly)).toBe(2); // round 1 only
    expect(donePageCount(finished)).toBe(2);
    expect(donePageCount(flagged)).toBe(0);
    expect(donePageCount(fresh)).toBe(0);
  });
});

describe('khatmaProgress', () => {
  it('aggregates group completion against the khatma total', () => {
    const progress = khatmaProgress({ totalPages: 10, remainingPages: [7, 8] }, [
      partly,
      finished,
    ]);
    expect(progress.donePages).toBe(4);
    expect(progress.totalPages).toBe(10);
    expect(progress.percent).toBe(40);
    expect(progress.complete).toBe(false);
  });

  it('is complete only when the pool is drained AND nothing is pending', () => {
    expect(
      khatmaProgress({ totalPages: 2, remainingPages: [] }, [finished]).complete,
    ).toBe(true);
    // Pool drained but a chunk is still being read.
    expect(khatmaProgress({ totalPages: 4, remainingPages: [] }, [partly]).complete).toBe(
      false,
    );
    // Nothing pending but pages remain unassigned.
    expect(
      khatmaProgress({ totalPages: 4, remainingPages: [3] }, [finished]).complete,
    ).toBe(false);
  });

  it('is safe for a khatma with no assignments', () => {
    expect(khatmaProgress({ totalPages: 0, remainingPages: [] }, [])).toEqual({
      donePages: 0,
      totalPages: 0,
      percent: 0,
      complete: false,
    });
  });
});

describe('pending readers', () => {
  it('lists members with a pending chunk (admin §8 list)', () => {
    expect(pendingReaders([partly, finished, flagged, fresh])).toEqual(['a']);
  });
});

describe('memberReadingInsights', () => {
  const atLocalNoon = (year: number, month: number, day: number): number =>
    new Date(year, month - 1, day, 12).getTime();

  const member = (id: string, completedPages: number[]): Person => ({
    id,
    name: id,
    completedPages,
    pagesPerDay: 2,
    enabled: true,
    createdAt: 1,
  });

  const khatma = (
    status: Khatma['status'],
    memberIds: string[],
  ): Pick<Khatma, 'status' | 'memberIds'> => ({ status, memberIds });

  it('derives rank, completed khatmas, monthly pages, and the longest daily streak', () => {
    const history: Assignment[] = [
      {
        memberId: 'selected',
        rounds: [
          chunk(1, '2026-06-30', [1]),
          chunk(2, '2026-07-01', [2, 3]),
          chunk(3, '2026-07-01', [4]),
          chunk(4, '2026-07-02', [5, 6, 7]),
          chunk(5, '2026-07-04', [8]),
        ],
        doneByRound: {
          1: atLocalNoon(2026, 6, 30),
          2: atLocalNoon(2026, 7, 1),
          3: atLocalNoon(2026, 7, 1),
          4: atLocalNoon(2026, 7, 2),
          5: atLocalNoon(2026, 7, 4),
        },
        missedStreak: 0,
      },
    ];

    expect(
      memberReadingInsights({
        memberId: 'selected',
        roster: [
          member('leader', [1, 2, 3, 4, 5]),
          member('selected', [1, 2, 3]),
          member('tied', [7, 8, 9]),
          member('behind', []),
        ],
        khatmas: [
          khatma('completed', ['selected']),
          khatma('completed', ['selected', 'leader']),
          khatma('completed', ['leader']),
          khatma('active', ['selected']),
        ],
        assignments: history,
        referenceTime: atLocalNoon(2026, 7, 22),
      }),
    ).toEqual({
      completedPageCount: 3,
      quranPercent: 0,
      topReaderPercent: 50,
      completedKhatmas: 2,
      pagesReadThisMonth: 7,
      longestDailyStreak: 3,
    });
  });

  it('ignores other members, released rounds, empty rounds, and invalid done marks', () => {
    const released = chunk(1, '2026-07-20', [1, 2], true);
    const empty = chunk(2, '2026-07-20', []);
    const invalid = chunk(3, '2026-07-20', [3]);

    expect(
      memberReadingInsights({
        memberId: 'selected',
        roster: [member('selected', [])],
        khatmas: [],
        assignments: [
          {
            memberId: 'selected',
            rounds: [released, empty, invalid],
            doneByRound: {
              1: atLocalNoon(2026, 7, 20),
              2: atLocalNoon(2026, 7, 20),
              3: Number.NaN,
            },
            missedStreak: 0,
          },
          {
            memberId: 'other',
            rounds: [chunk(1, '2026-07-20', [4, 5])],
            doneByRound: { 1: atLocalNoon(2026, 7, 20) },
            missedStreak: 0,
          },
        ],
        referenceTime: atLocalNoon(2026, 7, 22),
      }),
    ).toMatchObject({
      topReaderPercent: 100,
      pagesReadThisMonth: 0,
      longestDailyStreak: 0,
    });
  });
});

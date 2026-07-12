import { describe, expect, it } from 'vitest';
import {
  planDistribution,
  releaseChunk,
  takeChunk,
  warningLevel,
  type DistributionInput,
  type DistributionKhatmaState,
  type DistributionMember,
} from '@/domain/distribution';
import { buildPageUnitMaps, defaultCapacity } from '@/domain/assignment';
import type { Assignment, MemberCapacity, RoundChunk } from '@/domain/types';

const cap = (pages = 0, surahs = 0, juz = 0): MemberCapacity => ({ pages, surahs, juz });

const range = (a: number, b: number): number[] => {
  const out: number[] = [];
  for (let p = a; p <= b; p++) out.push(p);
  return out;
};

function member(id: string, pages = 2, enabled = true): DistributionMember {
  return { id, capacity: cap(pages), completedPages: [], enabled };
}

function memberCap(id: string, capacity: MemberCapacity, enabled = true): DistributionMember {
  return { id, capacity, completedPages: [], enabled };
}

function coveredMember(
  id: string,
  pages: number,
  completedPages: number[],
  enabled = true,
): DistributionMember {
  return { id, capacity: cap(pages), completedPages, enabled };
}

function chunk(round: number, pages: number[], released?: true): RoundChunk {
  return { round, date: `2026-07-0${round}`, pages, ...(released ? { released } : {}) };
}

function assignment(
  memberId: string,
  rounds: RoundChunk[] = [],
  doneByRound: Record<number, number> = {},
  missedStreak = 0,
): Assignment {
  return { memberId, rounds, doneByRound, missedStreak };
}

function khatma(
  id: string,
  remainingPages: number[],
  roundCount: number,
  assignments: Assignment[],
  seriesNumber = 1,
): DistributionKhatmaState {
  return { id, seriesNumber, remainingPages, roundCount, assignments };
}

function input(overrides: Partial<DistributionInput>): DistributionInput {
  return {
    khatmas: [],
    members: [],
    newKhatmaPool: Array.from({ length: 20 }, (_, i) => i + 101),
    newKhatmaSeriesNumber: 2,
    ...overrides,
  };
}

/** The chunk planned for one member (there is at most one per round). */
function chunkFor(plan: ReturnType<typeof planDistribution>, memberId: string) {
  return plan.chunks.find((c) => c.memberId === memberId);
}

// Small synthetic Quran maps: surahs 1..3 over pages 1..7, juz 1..2 over 1..41.
const units = buildPageUnitMaps({ 1: [1, 1], 2: [2, 4], 3: [5, 7] }, { 1: [1, 21], 2: [22, 41] });

describe('warningLevel', () => {
  it('maps streaks to none / yellow / red', () => {
    expect(warningLevel(0)).toBe('none');
    expect(warningLevel(1)).toBe('yellow');
    expect(warningLevel(2)).toBe('red');
    expect(warningLevel(5)).toBe('red');
  });
});

describe('takeChunk', () => {
  it('takes loose pages off the front', () => {
    const pool = range(1, 10);
    expect(takeChunk(pool, cap(2))).toEqual([1, 2]);
    expect(pool).toEqual(range(3, 10));
  });

  it('is additive: pages plus a specific surah (by id)', () => {
    const pool = range(1, 7);
    expect(takeChunk(pool, cap(1, 2, 0), units)).toEqual([1, 2, 3, 4]); // page 1 + surah 2 (2-4)
    expect(pool).toEqual([5, 6, 7]);
  });

  it('serves whole juz without splitting them', () => {
    const pool = range(1, 41);
    expect(takeChunk(pool, cap(0, 0, 1), units)).toEqual(range(1, 21));
    expect(takeChunk(pool, cap(0, 0, 1), units)).toEqual(range(22, 41));
    expect(pool).toEqual([]);
  });

  it('returns a short chunk when the pool drains', () => {
    const pool = range(1, 3);
    expect(takeChunk(pool, cap(5))).toEqual([1, 2, 3]);
    expect(pool).toEqual([]);
  });

  it('prefers pages the member has never completed', () => {
    const pool = range(1, 6);
    expect(takeChunk(pool, cap(2), undefined, [1, 2, 5])).toEqual([3, 4]);
    expect(pool).toEqual([1, 2, 5, 6]);
  });

  it('falls back to completed pages after full coverage', () => {
    const pool = range(1, 4);
    expect(takeChunk(pool, cap(2), undefined, range(1, 4))).toEqual([1, 2]);
    expect(pool).toEqual([3, 4]);
  });

  it('expands a member\'s unique coverage across repeated khatma pools', () => {
    const completed = new Set<number>();
    for (let cycle = 0; cycle < 3; cycle++) {
      const pages = takeChunk(range(1, 6), cap(2), undefined, [...completed]);
      pages.forEach((page) => completed.add(page));
    }
    expect([...completed].sort((a, b) => a - b)).toEqual(range(1, 6));
  });

  it('pulls a specific surah from the middle of the pool', () => {
    const pool = range(1, 7);
    expect(takeChunk(pool, cap(0, 3, 0), units)).toEqual([5, 6, 7]); // surah 3 = pages 5-7
    expect(pool).toEqual([1, 2, 3, 4]);
  });

  it('serves only the in-pool pages of a specific surah', () => {
    const pool = [3, 4, 5, 6, 7]; // pages 1-2 already served; surah 2 = pages 2-4
    expect(takeChunk(pool, cap(0, 2, 0), units)).toEqual([3, 4]);
    expect(pool).toEqual([5, 6, 7]);
  });

  it('skips surah/juz portions when no page→unit map is supplied', () => {
    const pool = range(1, 7);
    expect(takeChunk(pool, cap(1, 2, 0))).toEqual([1]);
    expect(pool).toEqual(range(2, 7));
  });
});

describe('buildPageUnitMaps / defaultCapacity', () => {
  it('attributes a shared boundary page to the later surah', () => {
    const u = buildPageUnitMaps({ 1: [1, 2], 2: [2, 3] }, {});
    expect(u.surah[1]).toBe(1);
    expect(u.surah[2]).toBe(2);
    expect(u.surah[3]).toBe(2);
  });

  it('defaults capacity to the roster pages-per-day', () => {
    expect(defaultCapacity({ pagesPerDay: 3 })).toEqual({ pages: 3, surahs: 0, juz: 0 });
  });
});

describe('planDistribution — serving', () => {
  it('serves contiguous front-of-pool chunks in roster order', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', range(1, 10), 0, [assignment('a'), assignment('b')])],
        members: [member('a', 2), member('b', 3)],
      }),
    );
    expect(chunkFor(plan, 'a')).toEqual({ khatmaId: 'k1', memberId: 'a', round: 1, pages: [1, 2] });
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 1, pages: [3, 4, 5] });
    expect(plan.streaks).toEqual({});
    expect(plan.completions).toEqual([]);
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: range(6, 10), roundCount: 1 }]);
    expect(plan.rollover).toBeUndefined();
  });

  it('gives a solo juz reader the first juz (pages 1..21)', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', range(1, 604), 0, [assignment('m1')])],
        members: [memberCap('m1', cap(0, 0, 1))],
        newKhatmaPool: range(1, 604),
        unitOfPage: units,
      }),
    );
    expect(chunkFor(plan, 'm1')).toEqual({ khatmaId: 'k1', memberId: 'm1', round: 1, pages: range(1, 21) });
    expect(plan.khatmaUpdates[0]).toEqual({ khatmaId: 'k1', remainingPages: range(22, 604), roundCount: 1 });
  });

  it('serves an additive pages-plus-surah capacity', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', range(1, 7), 0, [assignment('m1')])],
        members: [memberCap('m1', cap(1, 2, 0))],
        unitOfPage: units,
      }),
    );
    expect(chunkFor(plan, 'm1')?.pages).toEqual([1, 2, 3, 4]);
    expect(plan.khatmaUpdates[0]?.remainingPages).toEqual([5, 6, 7]);
  });

  it('rotates first choice and avoids each member\'s prior pages', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k2', range(1, 8), 0, [assignment('a'), assignment('b')], 2),
        ],
        members: [coveredMember('a', 3, [1, 2, 3]), coveredMember('b', 1, [4])],
        newKhatmaSeriesNumber: 3,
      }),
    );

    expect(plan.chunks).toEqual([
      { khatmaId: 'k2', memberId: 'b', round: 1, pages: [1] },
      { khatmaId: 'k2', memberId: 'a', round: 1, pages: [4, 5, 6] },
    ]);
    expect(chunkFor(plan, 'a')?.pages).not.toContain(1);
    expect(chunkFor(plan, 'b')?.pages).not.toContain(4);
  });
});

describe('planDistribution — settling (no auto-reclaim)', () => {
  it('skips an unread member and escalates their warning, keeping their pages', () => {
    const pending = assignment('m1', [chunk(1, [1, 2])]);
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', range(3, 10), 1, [pending])],
        members: [member('m1', 2)],
        newKhatmaPool: [],
      }),
    );
    expect(chunkFor(plan, 'm1')).toBeUndefined(); // nothing piled on
    expect(plan.streaks).toEqual({ m1: 1 }); // rounds-waited flag
    expect(plan.khatmaUpdates[0]).toEqual({ khatmaId: 'k1', remainingPages: range(3, 10), roundCount: 1 });
  });

  it('resets a finished member and serves their next chunk', () => {
    const done = assignment('m1', [chunk(1, [1, 2])], { 1: 111 }, 2);
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', [10, 11, 12], 1, [done])],
        members: [member('m1', 2)],
        newKhatmaPool: [],
      }),
    );
    expect(plan.streaks).toEqual({ m1: 0 });
    expect(chunkFor(plan, 'm1')).toEqual({ khatmaId: 'k1', memberId: 'm1', round: 2, pages: [10, 11] });
    expect(plan.khatmaUpdates[0]?.remainingPages).toEqual([12]);
  });

  it('does not penalize or reclaim from a disabled member holding a chunk', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [5, 6], 1, [
            assignment('a', [chunk(1, [1, 2])]), // pending but paused
            assignment('b', [chunk(1, [3, 4])], { 1: 1000 }),
          ]),
        ],
        members: [member('a', 2, false), member('b', 2)],
      }),
    );
    expect(plan.streaks).toEqual({}); // disabled streak frozen, done b already 0
    expect(chunkFor(plan, 'a')).toBeUndefined(); // skipped, keeps [1,2]
    expect(chunkFor(plan, 'b')?.pages).toEqual([5, 6]); // b draws the pool (a's pages NOT returned)
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [], roundCount: 2 }]);
  });
});

describe('planDistribution — rollover', () => {
  it('mints khatma N+1 when the pool drains and never spans a chunk across khatmas', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', [601, 602, 603], 5, [assignment('a'), assignment('b'), assignment('c')])],
        members: [member('a', 2), member('b', 2), member('c', 2)],
        newKhatmaPool: [1, 2, 3, 4, 5],
      }),
    );
    expect(chunkFor(plan, 'a')?.pages).toEqual([601, 602]);
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 6, pages: [603] });
    expect(chunkFor(plan, 'c')).toEqual({ khatmaId: null, memberId: 'c', round: 1, pages: [1, 2] });
    expect(plan.rollover).toEqual({ remainingPages: [3, 4, 5] });
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [], roundCount: 6 }]);
  });

  it('drains the oldest khatma first while two coexist', () => {
    // k1 got pages back via an earlier (manual) release; k2 is the newer khatma.
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [7, 8], 6, [assignment('a', [chunk(5, [1, 2], true)], {}, 1)]),
          khatma('k2', [10, 11, 12, 13], 1, [assignment('b', [chunk(1, [9, 9])], { 1: 1 })]),
        ],
        members: [member('a', 2), member('b', 2)],
      }),
    );
    // b is clean → served first, from the OLDEST pool (k1); a is flagged → after.
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 7, pages: [7, 8] });
    expect(chunkFor(plan, 'a')).toEqual({ khatmaId: 'k2', memberId: 'a', round: 2, pages: [10, 11] });
  });
});

describe('planDistribution — completion', () => {
  it('completes a sealed khatma once every chunk is done or released', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [], 9, [
            assignment('a', [chunk(9, [603, 604])], { 9: 1000 }),
            assignment('b', [chunk(8, [1, 2], true)], {}, 1),
          ]),
          khatma('k2', [50, 51, 52, 53], 1, [assignment('a'), assignment('b')]),
        ],
        members: [member('a', 2), member('b', 2)],
      }),
    );
    expect(plan.completions).toEqual(['k1']);
    expect(plan.khatmaUpdates).toEqual([
      { khatmaId: 'k1', remainingPages: [], roundCount: 9 },
      { khatmaId: 'k2', remainingPages: [], roundCount: 2 },
    ]);
    expect(chunkFor(plan, 'a')?.khatmaId).toBe('k2');
  });

  it('does not complete a khatma whose last chunk is pending', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', [601, 602], 9, [assignment('b')])],
        members: [member('b', 2)],
        newKhatmaPool: [],
      }),
    );
    expect(chunkFor(plan, 'b')?.pages).toEqual([601, 602]);
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [], roundCount: 10 }]);
    expect(plan.completions).toEqual([]);
  });
});

describe('releaseChunk', () => {
  it('returns a pending chunk to the pool and clears the streak', () => {
    const a = assignment('m1', [chunk(2, [50, 51])], {}, 2);
    expect(releaseChunk(a, [1, 2, 3])).toEqual({ round: 2, remainingPages: [1, 2, 3, 50, 51], missedStreak: 0 });
  });

  it('has nothing to release once the chunk is done', () => {
    const a = assignment('m1', [chunk(2, [50, 51])], { 2: 1 });
    expect(releaseChunk(a, [1, 2, 3])).toBeUndefined();
  });
});

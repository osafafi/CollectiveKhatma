import { describe, expect, it } from 'vitest';
import {
  planDistribution,
  warningLevel,
  type DistributionInput,
  type DistributionKhatmaState,
  type DistributionMember,
} from '@/domain/distribution';
import type { Assignment, RoundChunk } from '@/domain/types';

function member(id: string, pagesPerDay = 2, enabled = true): DistributionMember {
  return { id, pagesPerDay, enabled };
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
): DistributionKhatmaState {
  return { id, remainingPages, roundCount, assignments };
}

function input(overrides: Partial<DistributionInput>): DistributionInput {
  return {
    khatmas: [],
    members: [],
    newKhatmaPool: Array.from({ length: 20 }, (_, i) => i + 101),
    ...overrides,
  };
}

/** The chunk planned for one member (there is at most one per round). */
function chunkFor(plan: ReturnType<typeof planDistribution>, memberId: string) {
  return plan.chunks.find((c) => c.memberId === memberId);
}

describe('warningLevel', () => {
  it('maps streaks to none / yellow / red', () => {
    expect(warningLevel(0)).toBe('none');
    expect(warningLevel(1)).toBe('yellow');
    expect(warningLevel(2)).toBe('red');
    expect(warningLevel(5)).toBe('red');
  });
});

describe('planDistribution — first round', () => {
  it('serves contiguous front-of-pool chunks in roster order', () => {
    const plan = planDistribution(
      input({
        khatmas: [khatma('k1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0, [assignment('a'), assignment('b')])],
        members: [member('a', 2), member('b', 3)],
      }),
    );
    expect(chunkFor(plan, 'a')).toEqual({ khatmaId: 'k1', memberId: 'a', round: 1, pages: [1, 2] });
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 1, pages: [3, 4, 5] });
    expect(plan.releases).toEqual([]);
    expect(plan.streaks).toEqual({});
    expect(plan.completions).toEqual([]);
    expect(plan.khatmaUpdates).toEqual([
      { khatmaId: 'k1', remainingPages: [6, 7, 8, 9, 10], roundCount: 1 },
    ]);
    expect(plan.rollover).toBeUndefined();
  });
});

describe('planDistribution — settling and warnings', () => {
  it('releases a missed chunk, flags the member, and serves them last', () => {
    // a missed round 1 (pages 1-2); b finished. Released 1-2 must go to the
    // clean member b, and a draws the pages after b's.
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [5, 6, 7, 8], 1, [
            assignment('a', [chunk(1, [1, 2])]),
            assignment('b', [chunk(1, [3, 4])], { 1: 1000 }),
          ]),
        ],
        members: [member('a', 2), member('b', 2)],
      }),
    );
    expect(plan.releases).toEqual([{ khatmaId: 'k1', memberId: 'a', round: 1 }]);
    expect(plan.streaks).toEqual({ a: 1 });
    expect(chunkFor(plan, 'b')?.pages).toEqual([1, 2]); // clean member gets the released low pages
    expect(chunkFor(plan, 'a')?.pages).toEqual([5, 6]); // flagged member served after everyone
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [7, 8], roundCount: 2 }]);
  });

  it('escalates a second consecutive miss to red and resets on done', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [10, 11, 12, 13], 2, [
            // a already yellow, missed again; b was yellow but finished.
            assignment('a', [chunk(1, [1, 2], true), chunk(2, [3, 4])], {}, 1),
            assignment('b', [chunk(1, [5, 6], true), chunk(2, [7, 8])], { 2: 1000 }, 1),
          ]),
        ],
        members: [member('a', 2), member('b', 2)],
      }),
    );
    expect(plan.streaks).toEqual({ a: 2, b: 0 });
    expect(warningLevel(2)).toBe('red');
    // b is clean again, so b is served first.
    expect(chunkFor(plan, 'b')?.pages).toEqual([3, 4]); // a's released pages
    expect(chunkFor(plan, 'a')?.pages).toEqual([10, 11]);
  });

  it('does not penalize a brand-new member or one whose latest chunk was already released', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [20, 21, 22, 23], 3, [
            assignment('fresh'), // just joined — no history
            assignment('paused', [chunk(2, [1, 2], true)], {}, 1), // released while paused
          ]),
        ],
        members: [member('fresh', 2), member('paused', 2)],
      }),
    );
    expect(plan.releases).toEqual([]);
    expect(plan.streaks).toEqual({});
    expect(chunkFor(plan, 'fresh')?.pages).toEqual([20, 21]);
    // paused still has streak 1 → served after the clean member.
    expect(chunkFor(plan, 'paused')?.pages).toEqual([22, 23]);
  });

  it('releases a paused member\'s pages without flagging them, and serves them nothing', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [5, 6], 1, [
            assignment('a', [chunk(1, [1, 2])]), // pending but paused → excused
            assignment('b', [chunk(1, [3, 4])], { 1: 1000 }),
          ]),
        ],
        members: [member('a', 2, false), member('b', 2)],
      }),
    );
    // The pages return to the pool (so they don't lag), but no warning.
    expect(plan.releases).toEqual([{ khatmaId: 'k1', memberId: 'a', round: 1 }]);
    expect(plan.streaks).toEqual({});
    expect(chunkFor(plan, 'a')).toBeUndefined();
    expect(chunkFor(plan, 'b')?.pages).toEqual([1, 2]); // the released low pages
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [5, 6], roundCount: 2 }]);
  });
});

describe('planDistribution — rollover', () => {
  it('mints khatma N+1 when the pool drains and never spans a chunk across khatmas', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [601, 602, 603], 5, [assignment('a'), assignment('b'), assignment('c')]),
        ],
        members: [member('a', 2), member('b', 2), member('c', 2)],
        newKhatmaPool: [1, 2, 3, 4, 5],
      }),
    );
    expect(chunkFor(plan, 'a')?.pages).toEqual([601, 602]);
    // b gets the short boundary chunk from k1 (no spanning into the new pool).
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 6, pages: [603] });
    // c draws from the new khatma, whose rounds restart at 1.
    expect(chunkFor(plan, 'c')).toEqual({ khatmaId: null, memberId: 'c', round: 1, pages: [1, 2] });
    expect(plan.rollover).toEqual({ remainingPages: [3, 4, 5] });
    expect(plan.khatmaUpdates).toEqual([{ khatmaId: 'k1', remainingPages: [], roundCount: 6 }]);
  });

  it('drains the oldest khatma first while two coexist', () => {
    // k1 got pages back via an earlier release; k2 is the rollover khatma.
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [7, 8], 6, [assignment('a', [chunk(5, [1, 2], true)], {}, 1)]),
          khatma('k2', [10, 11, 12, 13], 1, [assignment('b', [chunk(1, [9, 9])], { 1: 1 })]),
        ],
        members: [member('a', 2), member('b', 2)],
      }),
    );
    // b is clean → served first, from the OLDEST pool (k1).
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 7, pages: [7, 8] });
    expect(chunkFor(plan, 'a')).toEqual({ khatmaId: 'k2', memberId: 'a', round: 2, pages: [10, 11] });
  });

  it('a released chunk on a sealed khatma reopens its pool instead of rolling over', () => {
    const plan = planDistribution(
      input({
        khatmas: [
          khatma('k1', [], 9, [
            assignment('a', [chunk(9, [603, 604])]), // missed the final chunk
            assignment('b', [chunk(9, [601, 602])], { 9: 1 }),
          ]),
        ],
        members: [member('a', 2), member('b', 2)],
        newKhatmaPool: [1, 2, 3],
      }),
    );
    expect(plan.releases).toEqual([{ khatmaId: 'k1', memberId: 'a', round: 9 }]);
    // The released final pages go to the clean member; k1 is NOT complete.
    expect(chunkFor(plan, 'b')).toEqual({ khatmaId: 'k1', memberId: 'b', round: 10, pages: [603, 604] });
    expect(plan.completions).toEqual([]);
    // a then draws from the new khatma.
    expect(chunkFor(plan, 'a')).toEqual({ khatmaId: null, memberId: 'a', round: 1, pages: [1, 2] });
    expect(plan.rollover).toEqual({ remainingPages: [3] });
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
    // k1's round counter is untouched; everyone is served from k2.
    expect(plan.khatmaUpdates).toEqual([
      { khatmaId: 'k1', remainingPages: [], roundCount: 9 },
      { khatmaId: 'k2', remainingPages: [], roundCount: 2 },
    ]);
    expect(chunkFor(plan, 'a')?.khatmaId).toBe('k2');
  });

  it('does not complete a khatma that seals this very round (its last chunk is pending)', () => {
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

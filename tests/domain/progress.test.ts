import { describe, expect, it } from 'vitest';
import {
  currentChunk,
  donePageCount,
  hasPendingChunk,
  isRoundDone,
  khatmaProgress,
  pendingReaders,
} from '@/domain/progress';
import type { Assignment } from '@/domain/types';

// Round 1 done, round 2 (pages 5-6) still pending.
const partly: Assignment = {
  memberId: 'a',
  rounds: [
    { round: 1, date: '2026-07-08', pages: [1, 2] },
    { round: 2, date: '2026-07-09', pages: [5, 6] },
  ],
  doneByRound: { 1: 1_000 },
  missedStreak: 0,
};

// Fully done.
const finished: Assignment = {
  memberId: 'b',
  rounds: [{ round: 1, date: '2026-07-08', pages: [10, 11] }],
  doneByRound: { 1: 3_000 },
  missedStreak: 0,
};

// Missed their round: the chunk was released, so nothing is pending.
const flagged: Assignment = {
  memberId: 'c',
  rounds: [{ round: 1, date: '2026-07-08', pages: [20, 21], released: true }],
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
    const progress = khatmaProgress({ totalPages: 10, remainingPages: [7, 8] }, [partly, finished]);
    expect(progress.donePages).toBe(4);
    expect(progress.totalPages).toBe(10);
    expect(progress.percent).toBe(40);
    expect(progress.complete).toBe(false);
  });

  it('is complete only when the pool is drained AND nothing is pending', () => {
    expect(khatmaProgress({ totalPages: 2, remainingPages: [] }, [finished]).complete).toBe(true);
    // Pool drained but a chunk is still being read.
    expect(khatmaProgress({ totalPages: 4, remainingPages: [] }, [partly]).complete).toBe(false);
    // Nothing pending but pages remain unassigned.
    expect(khatmaProgress({ totalPages: 4, remainingPages: [3] }, [finished]).complete).toBe(false);
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

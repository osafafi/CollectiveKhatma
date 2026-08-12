import { describe, expect, it } from 'vitest';
import {
  buildPageUnitMaps,
  fullyUnreadSurahIds,
  planRemainingPagesAssignment,
  removeKhatmaMember,
  resolvePageScope,
} from '@/domain/assignment';
import type { Assignment, Khatma } from '@/domain/types';

describe('resolvePageScope', () => {
  it('full defaults to the whole 604-page mushaf', () => {
    const pages = resolvePageScope({ kind: 'full' });
    expect(pages).toHaveLength(604);
    expect(pages[0]).toBe(1);
    expect(pages.at(-1)).toBe(604);
  });

  it('full honours a custom total and rejects a bad one', () => {
    expect(resolvePageScope({ kind: 'full', totalPages: 3 })).toEqual([1, 2, 3]);
    expect(() => resolvePageScope({ kind: 'full', totalPages: 0 })).toThrow();
  });

  it('range yields the inclusive span and rejects reversed/invalid ranges', () => {
    expect(resolvePageScope({ kind: 'range', fromPage: 5, toPage: 8 })).toEqual([
      5, 6, 7, 8,
    ]);
    expect(() => resolvePageScope({ kind: 'range', fromPage: 8, toPage: 5 })).toThrow();
    expect(() => resolvePageScope({ kind: 'range', fromPage: 0, toPage: 3 })).toThrow();
  });

  it('surahs unions chapter page-spans and de-dupes a shared boundary page', () => {
    // Surah 4 ends on page 106; surah 5 starts on page 106 (real KFGQPC overlap).
    const surahToPages = { 4: [77, 106], 5: [106, 127] } as Record<
      number,
      [number, number]
    >;
    const pages = resolvePageScope({ kind: 'surahs', surahIds: [4, 5] }, surahToPages);
    expect(pages[0]).toBe(77);
    expect(pages.at(-1)).toBe(127);
    expect(pages).toHaveLength(127 - 77 + 1); // 106 counted once, not twice
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('surahs requires the map and a known id', () => {
    expect(() => resolvePageScope({ kind: 'surahs', surahIds: [1] })).toThrow();
    expect(() =>
      resolvePageScope({ kind: 'surahs', surahIds: [999] }, { 1: [1, 1] }),
    ).toThrow();
  });
});

describe('fullyUnreadSurahIds', () => {
  it('keeps only Surahs whose entire distribution unit remains unread', () => {
    const maps = buildPageUnitMaps({ 1: [1, 2], 2: [3, 4], 3: [5, 6] }, { 1: [1, 6] });

    expect([...fullyUnreadSurahIds([1, 2, 4, 5, 6], maps.surah)]).toEqual([1, 3]);
  });

  it('uses the later Surah for a shared boundary page like distribution does', () => {
    const maps = buildPageUnitMaps({ 4: [77, 106], 5: [106, 107] }, { 1: [77, 107] });

    expect([...fullyUnreadSurahIds([77, 106, 107], maps.surah)]).toEqual([5]);
  });
});

describe('removeKhatmaMember', () => {
  const khatma: Pick<
    Khatma,
    'remainingPages' | 'memberIds' | 'capacities' | 'duaReciterId'
  > = {
    remainingPages: [5, 6],
    memberIds: ['removed', 'remaining'],
    capacities: {
      removed: { pages: 2, surahs: 0, juz: 0 },
      remaining: { pages: 3, surahs: 0, juz: 0 },
    },
    duaReciterId: 'removed',
  };

  it('returns held pages and clears membership, capacity, and reciter references', () => {
    const assignment: Pick<Assignment, 'rounds'> = {
      rounds: [
        {
          round: 1,
          date: '2026-08-09',
          pages: [1, 2],
          loosePages: [1, 2],
          redistributedPages: [],
        },
        {
          round: 2,
          date: '2026-08-10',
          pages: [3, 4],
          loosePages: [3, 4],
          redistributedPages: [],
          released: true,
        },
      ],
    };

    expect(removeKhatmaMember(khatma, assignment, 'removed')).toEqual({
      remainingPages: [1, 2, 5, 6],
      memberIds: ['remaining'],
      capacities: { remaining: { pages: 3, surahs: 0, juz: 0 } },
      duaReciterId: 'remaining',
    });
  });

  it('leaves no reciter when the removed member was the final participant', () => {
    expect(
      removeKhatmaMember(
        {
          remainingPages: [1],
          memberIds: ['removed'],
          capacities: { removed: { pages: 1, surahs: 0, juz: 0 } },
          duaReciterId: 'removed',
        },
        undefined,
        'removed',
      ),
    ).toMatchObject({ memberIds: [], capacities: {}, duaReciterId: '' });
  });
});

describe('planRemainingPagesAssignment', () => {
  it('moves the sorted pool into a fresh pending round for the selected member', () => {
    const assignment: Assignment = {
      memberId: 'admin',
      rounds: [
        {
          round: 3,
          date: '2026-08-10',
          pages: [1, 2],
          loosePages: [1, 2],
          redistributedPages: [],
          status: 'completed',
        },
      ],
      doneByRound: { 3: 1 },
      missedStreak: 0,
    };

    expect(
      planRemainingPagesAssignment(
        {
          status: 'active',
          memberIds: ['admin'],
          remainingPages: [601, 602, 603, 604],
          roundCount: 3,
        },
        assignment,
        'admin',
        '2026-08-12',
        'manual-1',
      ),
    ).toEqual({
      remainingPages: [],
      roundCount: 4,
      assignment: {
        ...assignment,
        rounds: [
          ...assignment.rounds,
          {
            id: 'manual-1',
            status: 'pending',
            round: 4,
            date: '2026-08-12',
            pages: [601, 602, 603, 604],
            loosePages: [601, 602, 603, 604],
            redistributedPages: [],
          },
        ],
      },
    });
  });

  it('is a no-op for an empty pool and rejects non-participants', () => {
    expect(
      planRemainingPagesAssignment(
        {
          status: 'active',
          memberIds: ['admin'],
          remainingPages: [],
          roundCount: 1,
        },
        undefined,
        'admin',
        '2026-08-12',
        'manual-1',
      ),
    ).toBeUndefined();
    expect(() =>
      planRemainingPagesAssignment(
        {
          status: 'active',
          memberIds: ['reader'],
          remainingPages: [604],
          roundCount: 1,
        },
        undefined,
        'admin',
        '2026-08-12',
        'manual-2',
      ),
    ).toThrow(/participate/);
  });
});

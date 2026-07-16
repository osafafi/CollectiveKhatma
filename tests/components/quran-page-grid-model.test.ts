import { describe, expect, it } from 'vitest';
import {
  buildQuranPageEntries,
  pageIndexAtGridPoint,
  pageFocusScale,
} from '@/components/charts/quranPageGridModel';
import type { Assignment, Khatma } from '@/domain/types';

const khatma: Khatma = {
  id: 'k1',
  seriesId: 'series-1',
  seriesName: 'أهل القرآن',
  seriesNumber: 1,
  totalPages: 6,
  scope: { kind: 'range', fromPage: 1, toPage: 6 },
  memberIds: ['p1', 'p2'],
  status: 'active',
  remainingPages: [5, 6],
  roundCount: 2,
  createdAt: 1,
};

const assignments: Assignment[] = [
  {
    memberId: 'p1',
    rounds: [{ round: 1, date: '2026-07-14', pages: [1, 2] }],
    doneByRound: { 1: 10 },
    missedStreak: 0,
  },
  {
    memberId: 'p2',
    rounds: [{ round: 2, date: '2026-07-15', pages: [3, 4] }],
    doneByRound: {},
    missedStreak: 0,
  },
];

describe('Quran page grid model', () => {
  it('maps done, live-assigned, and remaining pages with their reader', () => {
    expect(buildQuranPageEntries(khatma, assignments)).toEqual([
      { page: 1, state: 'done', memberId: 'p1' },
      { page: 2, state: 'done', memberId: 'p1' },
      { page: 3, state: 'assigned', memberId: 'p2' },
      { page: 4, state: 'assigned', memberId: 'p2' },
      { page: 5, state: 'remaining' },
      { page: 6, state: 'remaining' },
    ]);
  });

  it('linearly scales the configured neighbors without wrapping rows', () => {
    expect(pageFocusScale(5, 5, 2, 24, 3.4)).toBeCloseTo(3.4);
    expect(pageFocusScale(4, 5, 2, 24, 3.4)).toBeCloseTo(2.6);
    expect(pageFocusScale(3, 5, 2, 24, 3.4)).toBeCloseTo(1.8);
    expect(pageFocusScale(2, 5, 2, 24, 3.4)).toBe(1);
    expect(pageFocusScale(24, 23, 2, 24, 3.4)).toBe(1);
  });

  it('maps drag coordinates to page indexes in the RTL grid', () => {
    const layout = {
      left: 0,
      right: 240,
      top: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      columnGap: 0,
      rowGap: 0,
      direction: 'rtl' as const,
    };

    expect(pageIndexAtGridPoint(235, 5, 48, 24, layout)).toBe(0);
    expect(pageIndexAtGridPoint(205, 5, 48, 24, layout)).toBe(3);
    expect(pageIndexAtGridPoint(205, 15, 48, 24, layout)).toBe(27);
    expect(pageIndexAtGridPoint(-1, 5, 48, 24, layout)).toBeNull();
  });
});

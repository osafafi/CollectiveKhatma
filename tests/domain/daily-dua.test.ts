import { describe, expect, it } from 'vitest';
import { dailyDuaForDate, dailyDuaRoundDate, validDailyDuas } from '@/domain/dailyDua';
import type { Assignment } from '@/domain/types';

describe('daily prayer rotation', () => {
  it('advances by calendar date, loops, and handles dates before the epoch', () => {
    const list = ['a', 'b', 'c'];
    expect(dailyDuaForDate(list, '2026-09-07')).toBe('a');
    expect(dailyDuaForDate(list, '2026-09-08')).toBe('b');
    expect(dailyDuaForDate(list, '2026-09-10')).toBe('a');
    expect(dailyDuaForDate(list, '2026-09-06')).toBe('c');
    expect(dailyDuaForDate(['only'], '2028-02-29')).toBe('only');
  });
  it('skips empty lists and missing or invalid dates', () => {
    for (const date of [undefined, '', '2026-02-30', '2026-13-01', '09/07/2026']) {
      expect(dailyDuaForDate(['a'], date)).toBeUndefined();
    }
    expect(dailyDuaForDate([], '2026-09-07')).toBeUndefined();
  });
  it('uses the original round date for every member even after later adjustments', () => {
    const assignments = [
      {
        rounds: [
          { round: 1, date: '2026-09-07', released: true },
          { round: 1, date: '2026-09-08' },
        ],
      },
      {
        rounds: [
          { round: 1, date: '2026-09-09' },
          { round: 2, date: '2026-09-10' },
        ],
      },
    ] as Assignment[];
    expect(dailyDuaRoundDate(assignments, 1)).toBe('2026-09-07');
    expect(dailyDuaRoundDate(assignments, 2)).toBe('2026-09-10');
    expect(dailyDuaRoundDate(assignments, 3)).toBeUndefined();
  });
  it('validates custom prayers, explicit disabling, and storage limits', () => {
    expect(validDailyDuas(['sample prayer'])).toBe(true);
    expect(validDailyDuas([])).toBe(true);
    for (const invalid of [
      null,
      [' '],
      [42],
      ['x'.repeat(12001)],
      Array(101).fill('a'),
      Array(10).fill('x'.repeat(11000)),
    ])
      expect(validDailyDuas(invalid)).toBe(false);
  });
});

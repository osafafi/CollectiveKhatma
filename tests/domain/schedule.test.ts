import { describe, expect, it } from 'vitest';
import {
  addDays,
  currentDayIndex,
  daysBetween,
  daysRemaining,
  isFinalStretch,
  isWithinKhatma,
  lastDay,
} from '@/domain/schedule';

// A 7-day khatma: day indices 0..6 -> 2026-07-06 .. 2026-07-12.
const START = '2026-07-06';
const DURATION = 7;

describe('date arithmetic', () => {
  it('counts whole days between dates, including across month boundaries', () => {
    expect(daysBetween(START, START)).toBe(0);
    expect(daysBetween(START, '2026-07-13')).toBe(7);
    expect(daysBetween('2026-07-30', '2026-08-02')).toBe(3);
    expect(daysBetween(START, '2026-07-01')).toBe(-5); // before start
  });

  it('adds days (and rolls over months)', () => {
    expect(addDays(START, 6)).toBe('2026-07-12');
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
    expect(addDays(START, -1)).toBe('2026-07-05');
  });
});

describe('khatma window', () => {
  it('currentDayIndex is 0 on the start date and grows daily', () => {
    expect(currentDayIndex(START, START)).toBe(0);
    expect(currentDayIndex(START, '2026-07-12')).toBe(6);
  });

  it('lastDay is startDate + (durationDays - 1)', () => {
    expect(lastDay(START, DURATION)).toBe('2026-07-12');
  });

  it('isWithinKhatma covers [start, lastDay] inclusive', () => {
    expect(isWithinKhatma(START, DURATION, '2026-07-05')).toBe(false); // before
    expect(isWithinKhatma(START, DURATION, START)).toBe(true); // first day
    expect(isWithinKhatma(START, DURATION, '2026-07-12')).toBe(true); // last day
    expect(isWithinKhatma(START, DURATION, '2026-07-13')).toBe(false); // after
  });
});

describe('daysRemaining', () => {
  it('is durationDays at the start and 1 on the last day', () => {
    expect(daysRemaining(START, DURATION, START)).toBe(7);
    expect(daysRemaining(START, DURATION, '2026-07-12')).toBe(1);
  });

  it('is 0 once ended and clamped before the start', () => {
    expect(daysRemaining(START, DURATION, '2026-07-13')).toBe(0);
    expect(daysRemaining(START, DURATION, '2026-07-01')).toBe(7); // clamped, not > duration
  });
});

describe('isFinalStretch', () => {
  it('flags only the final two running days by default', () => {
    expect(isFinalStretch(START, DURATION, '2026-07-10')).toBe(false); // 3 days left
    expect(isFinalStretch(START, DURATION, '2026-07-11')).toBe(true); // 2 days left
    expect(isFinalStretch(START, DURATION, '2026-07-12')).toBe(true); // last day
    expect(isFinalStretch(START, DURATION, '2026-07-13')).toBe(false); // ended
  });

  it('respects a custom threshold', () => {
    expect(isFinalStretch(START, DURATION, '2026-07-10', 3)).toBe(true); // 3 days left
  });
});

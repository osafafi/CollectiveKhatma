import { describe, expect, it } from 'vitest';
import {
  planAssignments,
  resolvePageScope,
  type AssignmentResult,
  type PlanMemberInput,
} from '@/domain/assignment';

/** All pages across every member/day, in one flat array. */
function allPages(result: AssignmentResult): number[] {
  return Object.values(result).flat(2);
}

/** Per-member total page counts. */
function counts(result: AssignmentResult): number[] {
  return Object.values(result).map((days) => days.flat().length);
}

/** Flat, ordered pages assigned to one member. */
function pagesFor(result: AssignmentResult, id: string): number[] {
  return (result[id] ?? []).flat();
}

/** A member with a non-limiting capacity by default (so classic even-split cases hold). */
function member(id: string, completedPages: number[] = [], pagesPerDay = 1000): PlanMemberInput {
  return { id, completedPages, pagesPerDay, enabled: true };
}

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
    expect(resolvePageScope({ kind: 'range', fromPage: 5, toPage: 8 })).toEqual([5, 6, 7, 8]);
    expect(() => resolvePageScope({ kind: 'range', fromPage: 8, toPage: 5 })).toThrow();
    expect(() => resolvePageScope({ kind: 'range', fromPage: 0, toPage: 3 })).toThrow();
  });

  it('surahs unions chapter page-spans and de-dupes a shared boundary page', () => {
    // Surah 4 ends on page 106; surah 5 starts on page 106 (real KFGQPC overlap).
    const surahToPages = { 4: [77, 106], 5: [106, 127] } as Record<number, [number, number]>;
    const pages = resolvePageScope({ kind: 'surahs', surahIds: [4, 5] }, surahToPages);
    expect(pages[0]).toBe(77);
    expect(pages.at(-1)).toBe(127);
    expect(pages).toHaveLength(127 - 77 + 1); // 106 counted once, not twice
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('surahs requires the map and a known id', () => {
    expect(() => resolvePageScope({ kind: 'surahs', surahIds: [1] })).toThrow();
    expect(() => resolvePageScope({ kind: 'surahs', surahIds: [999] }, { 1: [1, 1] })).toThrow();
  });
});

describe('planAssignments — coverage & even split (non-limiting capacity)', () => {
  it('covers every pool page exactly once, nothing left over', () => {
    const pool = resolvePageScope({ kind: 'full' });
    const { assignments, unassigned } = planAssignments({
      pages: pool,
      days: 7,
      members: [member('a'), member('b'), member('c'), member('d'), member('e')],
    });
    expect(allPages(assignments).sort((x, y) => x - y)).toEqual(pool); // no gaps, no duplicates
    expect(unassigned).toEqual([]);
  });

  it('splits page counts across members to within one page', () => {
    const { assignments } = planAssignments({
      pages: resolvePageScope({ kind: 'full' }), // 604
      days: 7,
      members: [member('a'), member('b'), member('c')], // 604 / 3 = 202,201,201
    });
    const c = counts(assignments);
    expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    expect(c.reduce((s, n) => s + n, 0)).toBe(604);
  });

  it('splits each member evenly across the given days', () => {
    const { assignments } = planAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 20 }),
      days: 7,
      members: [member('a'), member('b')],
    });
    for (const days of Object.values(assignments)) {
      expect(days).toHaveLength(7); // always `days` entries
      const sizes = days.map((d) => d.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('with no history gives each member a contiguous block', () => {
    const { assignments } = planAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 6 }),
      days: 1,
      members: [member('a'), member('b'), member('c')],
    });
    expect(pagesFor(assignments, 'a')).toEqual([1, 2]);
    expect(pagesFor(assignments, 'b')).toEqual([3, 4]);
    expect(pagesFor(assignments, 'c')).toEqual([5, 6]);
  });

  it('rotates pages away from what a member has already completed', () => {
    // a finished 1-2, b finished 3-4 → they should swap so both read new pages.
    const { assignments } = planAssignments({
      pages: [1, 2, 3, 4],
      days: 1,
      members: [member('a', [1, 2]), member('b', [3, 4])],
    });
    expect(pagesFor(assignments, 'a')).toEqual([3, 4]);
    expect(pagesFor(assignments, 'b')).toEqual([1, 2]);
  });

  it('falls back to already-completed pages only when unavoidable', () => {
    const { assignments } = planAssignments({
      pages: [1, 2, 3, 4],
      days: 1,
      members: [member('a', [1, 2, 3, 4]), member('b', [])],
    });
    expect(pagesFor(assignments, 'b')).toEqual([1, 2]);
    expect(pagesFor(assignments, 'a')).toEqual([3, 4]);
    expect(allPages(assignments).sort((x, y) => x - y)).toEqual([1, 2, 3, 4]);
  });

  it('is deterministic', () => {
    const input = {
      pages: resolvePageScope({ kind: 'full' }),
      days: 10,
      members: [member('a', [3, 4, 5]), member('b'), member('c', [1, 2])],
    };
    expect(planAssignments(input)).toEqual(planAssignments(input));
  });

  it('handles fewer pages than members (some get empty days)', () => {
    const { assignments } = planAssignments({
      pages: [1, 2],
      days: 3,
      members: [member('a'), member('b'), member('c')],
    });
    expect(counts(assignments)).toEqual([1, 1, 0]);
    expect(assignments.c).toEqual([[], [], []]); // `days` empty arrays
  });

  it('returns the whole pool as unassigned when there are no members', () => {
    const { assignments, unassigned } = planAssignments({ pages: [1, 2], days: 3, members: [] });
    expect(assignments).toEqual({});
    expect(unassigned).toEqual([1, 2]);
  });

  it('rejects a non-positive duration', () => {
    expect(() => planAssignments({ pages: [1], days: 0, members: [member('a')] })).toThrow();
  });
});

describe('planAssignments — daily capacity, disabling & leftovers', () => {
  it('never exceeds a member per-day capacity', () => {
    // 1 member, 2 pages/day, 7 days → capacity 14; give exactly 14 pages.
    const { assignments } = planAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 14 }),
      days: 7,
      members: [{ id: 'a', completedPages: [], pagesPerDay: 2, enabled: true }],
    });
    for (const day of assignments.a ?? []) expect(day.length).toBeLessThanOrEqual(2);
    expect((assignments.a ?? []).flat()).toHaveLength(14);
  });

  it('leaves an unassigned tail when total capacity is short of the pool', () => {
    // a: 3/day, b: 2/day over 2 days → capacity 6 + 4 = 10; pool is 20.
    const { assignments, unassigned } = planAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 20 }),
      days: 2,
      members: [
        { id: 'a', completedPages: [], pagesPerDay: 3, enabled: true },
        { id: 'b', completedPages: [], pagesPerDay: 2, enabled: true },
      ],
    });
    expect(counts(assignments)).toEqual([6, 4]);
    expect(unassigned).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    for (const day of assignments.a ?? []) expect(day.length).toBeLessThanOrEqual(3);
    for (const day of assignments.b ?? []) expect(day.length).toBeLessThanOrEqual(2);
  });

  it('shares surplus capacity proportionally, capped at each capacity', () => {
    // caps 1 / 4 / 5 = 10 total over a 5-page pool (surplus): ~1 / 2 / 2.
    const { assignments, unassigned } = planAssignments({
      pages: [1, 2, 3, 4, 5],
      days: 1,
      members: [
        { id: 'a', completedPages: [], pagesPerDay: 1, enabled: true },
        { id: 'b', completedPages: [], pagesPerDay: 4, enabled: true },
        { id: 'c', completedPages: [], pagesPerDay: 5, enabled: true },
      ],
    });
    expect(counts(assignments)).toEqual([1, 2, 2]);
    expect(unassigned).toEqual([]);
  });

  it('gives a disabled member an all-empty assignment but keeps their entry', () => {
    const { assignments, unassigned } = planAssignments({
      pages: [1, 2, 3, 4],
      days: 2,
      members: [
        { id: 'a', completedPages: [], pagesPerDay: 1000, enabled: true },
        { id: 'b', completedPages: [], pagesPerDay: 5, enabled: false },
      ],
    });
    expect(assignments.b).toEqual([[], []]);
    expect(pagesFor(assignments, 'a')).toEqual([1, 2, 3, 4]);
    expect(unassigned).toEqual([]);
  });

  it('leaves the whole pool unassigned when everyone is disabled', () => {
    const { assignments, unassigned } = planAssignments({
      pages: [1, 2, 3, 4],
      days: 2,
      members: [
        { id: 'a', completedPages: [], pagesPerDay: 5, enabled: false },
        { id: 'b', completedPages: [], pagesPerDay: 5, enabled: false },
      ],
    });
    expect(assignments.a).toEqual([[], []]);
    expect(assignments.b).toEqual([[], []]);
    expect(unassigned).toEqual([1, 2, 3, 4]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  generateAssignments,
  resolvePageScope,
  type AssignmentResult,
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

function member(id: string, completedPages: number[] = []) {
  return { id, completedPages };
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

describe('generateAssignments', () => {
  it('covers every pool page exactly once across all members', () => {
    const pool = resolvePageScope({ kind: 'full' });
    const result = generateAssignments({
      pages: pool,
      durationDays: 7,
      members: [member('a'), member('b'), member('c'), member('d'), member('e')],
    });
    const flat = allPages(result).sort((x, y) => x - y);
    expect(flat).toEqual(pool); // no gaps, no duplicates
  });

  it('splits page counts across members to within one page', () => {
    const result = generateAssignments({
      pages: resolvePageScope({ kind: 'full' }), // 604
      durationDays: 7,
      members: [member('a'), member('b'), member('c')], // 604 / 3 = 202,201,201
    });
    const c = counts(result);
    expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    expect(c.reduce((s, n) => s + n, 0)).toBe(604);
  });

  it('splits each member evenly across the given days', () => {
    const result = generateAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 20 }),
      durationDays: 7,
      members: [member('a'), member('b')],
    });
    for (const days of Object.values(result)) {
      expect(days).toHaveLength(7); // always durationDays entries
      const sizes = days.map((d) => d.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('with no history gives each member a contiguous block', () => {
    const result = generateAssignments({
      pages: resolvePageScope({ kind: 'range', fromPage: 1, toPage: 6 }),
      durationDays: 1,
      members: [member('a'), member('b'), member('c')],
    });
    expect(pagesFor(result, 'a')).toEqual([1, 2]);
    expect(pagesFor(result, 'b')).toEqual([3, 4]);
    expect(pagesFor(result, 'c')).toEqual([5, 6]);
  });

  it('rotates pages away from what a member has already completed', () => {
    // a finished 1-2, b finished 3-4 → they should swap so both read new pages.
    const result = generateAssignments({
      pages: [1, 2, 3, 4],
      durationDays: 1,
      members: [member('a', [1, 2]), member('b', [3, 4])],
    });
    expect(pagesFor(result, 'a')).toEqual([3, 4]);
    expect(pagesFor(result, 'b')).toEqual([1, 2]);
  });

  it('falls back to already-completed pages only when unavoidable', () => {
    // a has read everything in the pool; b nothing. b takes the new pages,
    // a is left with completed ones (still an even split, no crash).
    const result = generateAssignments({
      pages: [1, 2, 3, 4],
      durationDays: 1,
      members: [member('a', [1, 2, 3, 4]), member('b', [])],
    });
    expect(pagesFor(result, 'b')).toEqual([1, 2]);
    expect(pagesFor(result, 'a')).toEqual([3, 4]);
    expect(allPages(result).sort((x, y) => x - y)).toEqual([1, 2, 3, 4]);
  });

  it('is deterministic', () => {
    const input = {
      pages: resolvePageScope({ kind: 'full' }),
      durationDays: 10,
      members: [member('a', [3, 4, 5]), member('b'), member('c', [1, 2])],
    };
    expect(generateAssignments(input)).toEqual(generateAssignments(input));
  });

  it('handles fewer pages than members (some get empty days)', () => {
    const result = generateAssignments({
      pages: [1, 2],
      durationDays: 3,
      members: [member('a'), member('b'), member('c')],
    });
    expect(counts(result)).toEqual([1, 1, 0]);
    expect(result.c).toEqual([[], [], []]); // durationDays empty arrays
  });

  it('returns nothing when there are no members', () => {
    expect(generateAssignments({ pages: [1, 2], durationDays: 3, members: [] })).toEqual({});
  });

  it('rejects a non-positive duration', () => {
    expect(() => generateAssignments({ pages: [1], durationDays: 0, members: [member('a')] })).toThrow();
  });
});

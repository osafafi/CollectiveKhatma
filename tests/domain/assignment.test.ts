import { describe, expect, it } from 'vitest';
import { resolvePageScope } from '@/domain/assignment';

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

import type { PageScope } from './types';

export type { PageScope };

/** Full Madinah (Hafs) mushaf length — the default khatma scope. */
const DEFAULT_TOTAL_PAGES = 604;

/** Inclusive `[from..to]` as an ascending array. Assumes `from <= to`. */
function pageRange(from: number, to: number): number[] {
  const pages: number[] = [];
  for (let p = from; p <= to; p++) pages.push(p);
  return pages;
}

/**
 * Resolve a {@link PageScope} to a sorted, de-duplicated pool of page numbers —
 * the `remainingPages` a khatma starts with (distribution then consumes it
 * from the front; see `distribution.ts`).
 *
 * Stays pure: `surahToPages` (surahId -> `[firstPage, lastPage]`) comes from the
 * bundled Quran index (`public/quran/index.json`) and is passed in by the
 * caller, so the domain layer never imports the content/loader. Adjacent
 * chapters can share a boundary page (one page ends a surah and starts the
 * next), hence the de-dup.
 */
export function resolvePageScope(
  scope: PageScope,
  surahToPages?: Record<number, [number, number]>,
): number[] {
  switch (scope.kind) {
    case 'full': {
      const total = scope.totalPages ?? DEFAULT_TOTAL_PAGES;
      if (!Number.isInteger(total) || total < 1) {
        throw new Error(`resolvePageScope: totalPages must be a positive integer (got ${total})`);
      }
      return pageRange(1, total);
    }
    case 'range': {
      const { fromPage, toPage } = scope;
      if (!Number.isInteger(fromPage) || !Number.isInteger(toPage) || fromPage < 1 || fromPage > toPage) {
        throw new Error(`resolvePageScope: invalid page range ${fromPage}..${toPage}`);
      }
      return pageRange(fromPage, toPage);
    }
    case 'surahs': {
      if (!surahToPages) {
        throw new Error('resolvePageScope: surahToPages is required to resolve a chapter scope');
      }
      const pages = new Set<number>();
      for (const id of scope.surahIds) {
        const span = surahToPages[id];
        if (!span) throw new Error(`resolvePageScope: unknown surah id ${id}`);
        for (let p = span[0]; p <= span[1]; p++) pages.add(p);
      }
      return [...pages].sort((a, b) => a - b);
    }
  }
}

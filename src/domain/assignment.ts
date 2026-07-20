import type { Khatma, MemberCapacity, PageScope } from './types';

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
        throw new Error(
          `resolvePageScope: totalPages must be a positive integer (got ${total})`,
        );
      }
      return pageRange(1, total);
    }
    case 'range': {
      const { fromPage, toPage } = scope;
      if (
        !Number.isInteger(fromPage) ||
        !Number.isInteger(toPage) ||
        fromPage < 1 ||
        fromPage > toPage
      ) {
        throw new Error(`resolvePageScope: invalid page range ${fromPage}..${toPage}`);
      }
      return pageRange(fromPage, toPage);
    }
    case 'surahs': {
      if (!surahToPages) {
        throw new Error(
          'resolvePageScope: surahToPages is required to resolve a chapter scope',
        );
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

/** Page-number → unit-id lookups for selected-Surah / selected-Juz distribution. */
export interface PageUnitMaps {
  /** page -> surah id (1..114). */
  surah: Record<number, number>;
  /** page -> juz (1..30). */
  juz: Record<number, number>;
}

/**
 * Build page → unit lookups from the bundled Quran index maps. Stays pure — the
 * caller passes `surahToPages` / `juzToPages` (from `getQuranIndex()`), so the
 * domain never imports the content loader. Distribution uses these to serve a
 * selected complete Surah or Juz without splitting it ({@link MemberCapacity}).
 *
 * A page shared by two adjacent surahs (one ends where the next begins) is
 * attributed to the surah that STARTS on it: ids are applied in ascending order
 * so the later (higher) id overwrites the boundary page.
 */
export function buildPageUnitMaps(
  surahToPages: Record<number, [number, number]>,
  juzToPages: Record<number, [number, number]>,
): PageUnitMaps {
  const surah: Record<number, number> = {};
  const juz: Record<number, number> = {};
  const fill = (
    target: Record<number, number>,
    ranges: Record<number, [number, number]>,
  ): void => {
    for (const id of Object.keys(ranges)
      .map(Number)
      .sort((a, b) => a - b)) {
      const [start, end] = ranges[id]!;
      for (let p = start; p <= end; p++) target[p] = id;
    }
  };
  fill(surah, surahToPages);
  fill(juz, juzToPages);
  return { surah, juz };
}

/** Read a required per-khatma capacity and fail loudly on invalid stored data. */
export function requiredCapacity(
  khatma: Pick<Khatma, 'id' | 'capacities'>,
  memberId: string,
): MemberCapacity {
  const capacity = khatma.capacities[memberId];
  if (!capacity) {
    throw new Error(`Khatma ${khatma.id} is missing capacity for member ${memberId}`);
  }
  return capacity;
}

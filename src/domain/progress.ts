/** Pure progress / insight calculations (REQUIREMENTS §6). */

export const QURAN_TOTAL_PAGES = 604;

/**
 * Personal lifetime completion as a whole-number percent of a full Quran.
 * e.g. 151 completed pages -> 25 (%).
 */
export function lifetimePercent(
  completedPageCount: number,
  quranPages: number = QURAN_TOTAL_PAGES,
): number {
  if (quranPages <= 0) return 0;
  return Math.round((completedPageCount / quranPages) * 100);
}

/** A khatma's group completion as a whole-number percent of its total pages. */
export function khatmaPercent(donePages: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.round((donePages / totalPages) * 100);
}

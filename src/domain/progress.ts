/** Pure progress / insight calculations (REQUIREMENTS §6, §8). */

import type { Assignment } from './types';

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

// -----------------------------------------------------------------------------
// Assignment-derived progress. Pure over `Assignment` docs (day-keyed pages +
// done marks), so both apps share one source of truth for "who's done".
// -----------------------------------------------------------------------------

/** True if the member has marked day `dayIndex` done. */
export function isDayDone(a: Assignment, dayIndex: number): boolean {
  return a.doneByDay?.[dayIndex] !== undefined;
}

/** Total pages assigned to a member across all days. */
export function assignedPageCount(a: Assignment): number {
  return a.pagesByDay.reduce((sum, day) => sum + day.length, 0);
}

/** Pages the member has actually completed (the pages on their done days). */
export function donePageCount(a: Assignment): number {
  return Object.keys(a.doneByDay ?? {}).reduce(
    (sum, key) => sum + (a.pagesByDay[Number(key)]?.length ?? 0),
    0,
  );
}

/** True while the member still has assigned-but-unread pages. */
export function hasUnreadPages(a: Assignment): boolean {
  return a.pagesByDay.some((day, i) => day.length > 0 && !isDayDone(a, i));
}

export interface KhatmaProgress {
  donePages: number;
  totalPages: number;
  percent: number;
  /** All assigned pages have been read — surfaces the du3a screen (REQUIREMENTS §7). */
  complete: boolean;
}

/** Group progress across every member's assignment in a khatma (REQUIREMENTS §6). */
export function khatmaProgress(assignments: readonly Assignment[]): KhatmaProgress {
  const donePages = assignments.reduce((sum, a) => sum + donePageCount(a), 0);
  const totalPages = assignments.reduce((sum, a) => sum + assignedPageCount(a), 0);
  return {
    donePages,
    totalPages,
    percent: khatmaPercent(donePages, totalPages),
    complete: totalPages > 0 && donePages >= totalPages,
  };
}

/** Member ids with assigned pages on `dayIndex` who haven't marked it done. */
export function pendingForDay(assignments: readonly Assignment[], dayIndex: number): string[] {
  return assignments
    .filter((a) => (a.pagesByDay[dayIndex]?.length ?? 0) > 0 && !isDayDone(a, dayIndex))
    .map((a) => a.memberId);
}

/**
 * Member ids who still have any unread pages in the khatma — the admin's
 * always-visible pending-readers list (REQUIREMENTS §8).
 */
export function pendingReaders(assignments: readonly Assignment[]): string[] {
  return assignments.filter(hasUnreadPages).map((a) => a.memberId);
}

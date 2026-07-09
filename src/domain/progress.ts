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

// -----------------------------------------------------------------------------
// Coverage vs. the scope pool. When per-person daily capacity can't cover the
// whole khatma, some pages end up assigned to no one — the admin must see these
// to read them herself or hand them to volunteers (REQUIREMENTS §8, added).
// `poolPages` is `resolvePageScope(khatma.scope)` (from the domain assignment
// module), passed in so this stays pure.
// -----------------------------------------------------------------------------

/**
 * Pool pages that no member is assigned on any day — the admin's "leftover /
 * unread" list. Ascending, following `poolPages` order.
 */
export function unassignedPages(
  poolPages: readonly number[],
  assignments: readonly Assignment[],
): number[] {
  const taken = new Set<number>();
  for (const a of assignments) for (const day of a.pagesByDay) for (const p of day) taken.add(p);
  return poolPages.filter((p) => !taken.has(p));
}

/** Pages locked to days before `fromDay` — kept intact when re-planning from `fromDay`. */
function pagesLockedBefore(assignments: readonly Assignment[], fromDay: number): Set<number> {
  const locked = new Set<number>();
  for (const a of assignments) {
    for (let d = 0; d < fromDay && d < a.pagesByDay.length; d++) {
      for (const p of a.pagesByDay[d] ?? []) locked.add(p);
    }
  }
  return locked;
}

/**
 * The pool still to distribute from `fromDay` onward when the admin regenerates
 * the remaining days: the scope pool minus everything already committed to days
 * before `fromDay` (done or not — history stays put). Includes pages currently
 * on future days (they get reshuffled) and any previously-unassigned pages.
 */
export function remainingPool(
  poolPages: readonly number[],
  assignments: readonly Assignment[],
  fromDay: number,
): number[] {
  const locked = pagesLockedBefore(assignments, fromDay);
  return poolPages.filter((p) => !locked.has(p));
}

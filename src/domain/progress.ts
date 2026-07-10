/** Pure progress / insight calculations (REQUIREMENTS §6, §8). */

import type { Assignment, Khatma, RoundChunk } from './types';

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
// Assignment-derived progress. Pure over `Assignment` docs (round chunks +
// done marks), so both apps share one source of truth for "who's done".
// -----------------------------------------------------------------------------

/** True if the member has marked round `round` done. */
export function isRoundDone(a: Assignment, round: number): boolean {
  return a.doneByRound?.[round] !== undefined;
}

/**
 * The member's pending chunk — their current pages to read. By invariant only
 * the last non-empty chunk can be pending; released or done means nothing is
 * pending until the next distribution.
 */
export function currentChunk(a: Assignment): RoundChunk | undefined {
  for (let i = a.rounds.length - 1; i >= 0; i--) {
    const chunk = a.rounds[i];
    if (!chunk || chunk.pages.length === 0) continue;
    return chunk.released !== true && !isRoundDone(a, chunk.round) ? chunk : undefined;
  }
  return undefined;
}

/** True while the member has a chunk they haven't read yet. */
export function hasPendingChunk(a: Assignment): boolean {
  return currentChunk(a) !== undefined;
}

/**
 * The member's last readable chunk — pending OR already done (skipping released
 * ones). What the assigned reader opens on, so a member can revisit the pages
 * they just finished.
 */
export function latestReadableChunk(a: Assignment): RoundChunk | undefined {
  for (let i = a.rounds.length - 1; i >= 0; i--) {
    const chunk = a.rounds[i];
    if (chunk && chunk.pages.length > 0 && chunk.released !== true) return chunk;
  }
  return undefined;
}

/** Pages the member actually completed (chunks whose round is marked done). */
export function donePageCount(a: Assignment): number {
  return a.rounds.reduce(
    (sum, chunk) =>
      chunk.released !== true && isRoundDone(a, chunk.round) ? sum + chunk.pages.length : sum,
    0,
  );
}

export interface KhatmaProgress {
  donePages: number;
  totalPages: number;
  percent: number;
  /** Every page read: pool drained and no chunk pending — surfaces the du3a screen (REQUIREMENTS §7). */
  complete: boolean;
}

/** Group progress across every member's assignment in a khatma (REQUIREMENTS §6). */
export function khatmaProgress(
  khatma: Pick<Khatma, 'totalPages' | 'remainingPages'>,
  assignments: readonly Assignment[],
): KhatmaProgress {
  const donePages = assignments.reduce((sum, a) => sum + donePageCount(a), 0);
  const { totalPages } = khatma;
  return {
    donePages,
    totalPages,
    percent: khatmaPercent(donePages, totalPages),
    complete:
      totalPages > 0 && khatma.remainingPages.length === 0 && !assignments.some(hasPendingChunk),
  };
}

/**
 * Member ids who still have a pending chunk this round — the admin's
 * always-visible pending-readers list (REQUIREMENTS §8).
 */
export function pendingReaders(assignments: readonly Assignment[]): string[] {
  return assignments.filter(hasPendingChunk).map((a) => a.memberId);
}

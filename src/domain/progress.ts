/** Pure progress / insight calculations (REQUIREMENTS §6, §8). */

import type { Assignment, Khatma, Person, RoundChunk } from './types';

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

export interface MemberReadingInsights {
  /** Unique Quran pages present in the roster's lifetime completion set. */
  completedPageCount: number;
  /** Whole-Quran completion percentage derived from that lifetime set. */
  quranPercent: number;
  /** Best-rank percentile among the current roster (ties share the better rank). */
  topReaderPercent: number;
  /** Completed khatmas in which the selected member still appears as a participant. */
  completedKhatmas: number;
  /** Pages credited by done timestamps in the reference time's local calendar month. */
  pagesReadThisMonth: number;
  /** Longest run of consecutive local calendar days containing a credited completion. */
  longestDailyStreak: number;
}

export interface MemberReadingInsightsInput {
  memberId: string;
  roster: readonly Pick<Person, 'id' | 'completedPages'>[];
  khatmas: readonly Pick<Khatma, 'status' | 'memberIds'>[];
  /** Assignment history from every selected-member khatma, active and completed. */
  assignments: readonly Assignment[];
  /** Epoch ms used to select "this month"; defaults to the user's current time. */
  referenceTime?: number;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Personal-page metadata derived entirely from the existing roster, khatma,
 * round-history, and done-timestamp fields. No persisted counters are needed.
 */
export function memberReadingInsights({
  memberId,
  roster,
  khatmas,
  assignments,
  referenceTime = Date.now(),
}: MemberReadingInsightsInput): MemberReadingInsights {
  const member = roster.find((person) => person.id === memberId);
  const completedPageCount = member?.completedPages.length ?? 0;
  const readersAhead = member
    ? roster.filter(
        (person) => person.completedPages.length > member.completedPages.length,
      ).length
    : 0;
  const topReaderPercent = member
    ? Math.ceil(((readersAhead + 1) / roster.length) * 100)
    : 0;
  const referenceDate = new Date(referenceTime);
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();
  const readingDays = new Set<number>();
  let pagesReadThisMonth = 0;

  for (const assignment of assignments) {
    if (assignment.memberId !== memberId) continue;

    for (const chunk of assignment.rounds) {
      const completedAt = assignment.doneByRound?.[chunk.round];
      if (
        chunk.released === true ||
        chunk.pages.length === 0 ||
        completedAt === undefined ||
        !Number.isFinite(completedAt)
      ) {
        continue;
      }

      const completedDate = new Date(completedAt);
      if (Number.isNaN(completedDate.getTime())) continue;

      if (
        completedDate.getFullYear() === referenceYear &&
        completedDate.getMonth() === referenceMonth
      ) {
        pagesReadThisMonth += chunk.pages.length;
      }

      readingDays.add(
        Date.UTC(
          completedDate.getFullYear(),
          completedDate.getMonth(),
          completedDate.getDate(),
        ) / DAY_MS,
      );
    }
  }

  let longestDailyStreak = 0;
  let currentStreak = 0;
  let previousDay: number | undefined;
  for (const day of [...readingDays].sort((a, b) => a - b)) {
    currentStreak =
      previousDay !== undefined && day === previousDay + 1 ? currentStreak + 1 : 1;
    longestDailyStreak = Math.max(longestDailyStreak, currentStreak);
    previousDay = day;
  }

  return {
    completedPageCount,
    quranPercent: lifetimePercent(completedPageCount),
    topReaderPercent,
    completedKhatmas: khatmas.filter(
      (khatma) => khatma.status === 'completed' && khatma.memberIds.includes(memberId),
    ).length,
    pagesReadThisMonth,
    longestDailyStreak,
  };
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
      chunk.released !== true && isRoundDone(a, chunk.round)
        ? sum + chunk.pages.length
        : sum,
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
      totalPages > 0 &&
      khatma.remainingPages.length === 0 &&
      !assignments.some(hasPendingChunk),
  };
}

/**
 * Member ids who still have a pending chunk this round — the admin's
 * always-visible pending-readers list (REQUIREMENTS §8).
 */
export function pendingReaders(assignments: readonly Assignment[]): string[] {
  return assignments.filter(hasPendingChunk).map((a) => a.memberId);
}

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
 * Resolve a {@link PageScope} to a sorted, de-duplicated pool of page numbers.
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

/** One member's inputs to the planner. */
export interface PlanMemberInput {
  id: string;
  /** Pages this member has already completed in past khatmas (for rotation). */
  completedPages: number[];
  /** Daily page capacity — how many pages they can take per day (REQUIREMENTS §5+). */
  pagesPerDay: number;
  /**
   * When `false` the member is paused (REQUIREMENTS §5+): capacity 0, so they
   * receive an all-empty assignment but still appear in the result (their doc is
   * kept, ready to be re-planned once re-enabled).
   */
  enabled: boolean;
}

export interface PlanInput {
  /**
   * The pool of page numbers to split across members — the whole scope at
   * creation, or the remaining-unread pool when re-planning. Build it with
   * {@link resolvePageScope}. De-duplicated and sorted internally.
   */
  pages: number[];
  /** Days to spread each member's pages across (a positive integer). */
  days: number;
  /** Members taking part, with capacity + lifetime completed pages. */
  members: readonly PlanMemberInput[];
}

/** memberId -> pagesByDay (`pagesByDay[dayIndex]` = page numbers for that day). */
export type AssignmentResult = Record<string, number[][]>;

export interface PlanResult {
  /** Per-member day-split assignment; every input member gets an entry. */
  assignments: AssignmentResult;
  /**
   * Pool pages that no enabled member had capacity for, ascending. Surfaced to
   * the admin to read herself or hand to volunteers (REQUIREMENTS §8, added).
   */
  unassigned: number[];
}

/** Mutable per-member bookkeeping used while distributing the pool. */
interface MemberSlot {
  id: string;
  /** Pages this member may still be given (their capacity-based target, counting down). */
  remaining: number;
  /** Pages this member has already completed in past khatmas. */
  completed: Set<number>;
  /** Pages assigned to them so far, in ascending order. */
  pages: number[];
}

/**
 * How many pages each member should receive: bounded by their capacity and
 * summing to `min(poolSize, totalCapacity)`.
 * - When capacity can't cover the pool (`totalCapacity <= poolSize`), everyone
 *   is maxed to their capacity and the rest of the pool is left unassigned.
 * - When there's surplus capacity, the pool is shared out proportional to
 *   capacity (largest-remainder), so heavier readers get proportionally more
 *   without anyone exceeding their own capacity.
 */
function computeTargets(poolSize: number, capacity: number[], totalCapacity: number): number[] {
  if (totalCapacity <= poolSize) return capacity.slice();

  // Largest-remainder apportionment, values carried on objects (no bare array
  // indexing) so it stays clean under noUncheckedIndexedAccess.
  const parts = capacity.map((cap, index) => {
    const exact = (poolSize * cap) / totalCapacity;
    const target = Math.floor(exact);
    return { index, cap, target, frac: exact - target };
  });
  let remainder = poolSize - parts.reduce((sum, p) => sum + p.target, 0);

  // Hand the leftover units to the largest fractional parts first, never
  // exceeding a member's own capacity (always possible: exact_i < capacity_i).
  const byFrac = [...parts].sort((a, b) => b.frac - a.frac || a.index - b.index);
  while (remainder > 0) {
    let progressed = false;
    for (const p of byFrac) {
      if (remainder <= 0) break;
      if (p.target < p.cap) {
        p.target++;
        remainder--;
        progressed = true;
      }
    }
    if (!progressed) break; // unreachable while totalCapacity > poolSize
  }
  return parts.map((p) => p.target);
}

/**
 * Auto-assign a pool of pages across members, honoring each member's daily
 * capacity (`pagesPerDay * days`) and preferring to give each member pages they
 * have NOT already completed, so that over many khatmas a person progressively
 * covers the whole Quran (REQUIREMENTS §5). Deterministic for a given input.
 *
 * Guarantees:
 * - Every pool page is either assigned to exactly one member or returned in
 *   `unassigned` (when total capacity is short of the pool).
 * - No member is given more than `pagesPerDay * days` pages, and their per-day
 *   counts differ by at most one — so no day exceeds `pagesPerDay`.
 * - Disabled members (capacity 0) get an all-empty assignment of length `days`.
 * - Rotation is best-effort: a member is handed a page they've already
 *   completed only when no member who still needs pages finds it new. With no
 *   history the split is contiguous blocks; the admin can override afterward.
 */
export function planAssignments(input: PlanInput): PlanResult {
  const { days, members } = input;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`planAssignments: days must be a positive integer (got ${days})`);
  }

  // Unique, ascending pool — robust to however the caller built `pages`.
  const pool = [...new Set(input.pages)].sort((a, b) => a - b);
  const assignments: AssignmentResult = {};
  if (members.length === 0) return { assignments, unassigned: pool };

  const capacity = members.map((m) =>
    m.enabled ? Math.max(0, Math.floor(m.pagesPerDay)) * days : 0,
  );
  const totalCapacity = capacity.reduce((sum, c) => sum + c, 0);
  const targets = computeTargets(pool.length, capacity, totalCapacity);

  const slots: MemberSlot[] = members.map((m, i) => ({
    id: m.id,
    remaining: targets[i] ?? 0,
    completed: new Set(m.completedPages),
    pages: [],
  }));

  // Assign each page to a member with remaining capacity, preferring one for
  // whom it's new and staying with the previous member so runs stay contiguous.
  // A page with no member left to take it becomes leftover (ascending order).
  const unassigned: number[] = [];
  let last: MemberSlot | undefined;
  for (const page of pool) {
    const eligible = slots.filter((s) => s.remaining > 0);
    if (eligible.length === 0) {
      unassigned.push(page);
      continue;
    }
    const fresh = eligible.filter((s) => !s.completed.has(page));
    const candidates = fresh.length > 0 ? fresh : eligible;

    let pick: MemberSlot | undefined = last && candidates.includes(last) ? last : undefined;
    if (!pick) for (const s of candidates) if (!pick || s.remaining > pick.remaining) pick = s;
    if (!pick) throw new Error('planAssignments: no candidate for a page (unreachable)');

    pick.pages.push(page);
    pick.remaining--;
    last = pick;
  }

  for (const s of slots) assignments[s.id] = splitAcrossDays(s.pages, days);
  return { assignments, unassigned };
}

/**
 * Split an ascending page list across `days` days as evenly as possible: the
 * first `pages.length % days` days get one extra page. Trailing days with no
 * pages are kept as empty arrays so the result length always equals `days`.
 */
function splitAcrossDays(pages: number[], days: number): number[][] {
  const per = Math.floor(pages.length / days);
  const remainder = pages.length % days;
  const out: number[][] = [];
  let cursor = 0;
  for (let day = 0; day < days; day++) {
    const size = per + (day < remainder ? 1 : 0);
    out.push(pages.slice(cursor, cursor + size));
    cursor += size;
  }
  return out;
}

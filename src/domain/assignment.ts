import type { Person } from './types';

/**
 * What a khatma should cover. The admin picks one of these; the UI resolves it
 * to a flat page pool with {@link resolvePageScope} before calling
 * {@link generateAssignments} (REQUIREMENTS §5 — assign the full mushaf, a page
 * range, or whole chapters).
 */
export type PageScope =
  | { kind: 'full'; totalPages?: number }
  | { kind: 'range'; fromPage: number; toPage: number }
  | { kind: 'surahs'; surahIds: number[] };

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

export interface AssignmentInput {
  /**
   * The pool of page numbers to split across members. Build it with
   * {@link resolvePageScope} (full mushaf, a range, or chapters). De-duplicated
   * and sorted internally, so the input's order and uniqueness don't matter.
   */
  pages: number[];
  /** Days to spread each member's pages across (a positive integer). */
  durationDays: number;
  /** Members taking part, with their lifetime completed pages (for rotation). */
  members: ReadonlyArray<Pick<Person, 'id' | 'completedPages'>>;
}

/** memberId -> pagesByDay (`pagesByDay[dayIndex]` = page numbers for that day). */
export type AssignmentResult = Record<string, number[][]>;

/** Mutable per-member bookkeeping used while distributing the pool. */
interface MemberSlot {
  id: string;
  /** Pages this member may still be given (their even-split target, counting down). */
  remaining: number;
  /** Pages this member has already completed in past khatmas. */
  completed: Set<number>;
  /** Pages assigned to them so far, in ascending order. */
  pages: number[];
}

/**
 * Auto-assign a pool of pages across members, as evenly as possible, preferring
 * to give each member pages they have NOT already completed in past khatmas, so
 * that over many khatmas a person progressively covers the whole Quran
 * (REQUIREMENTS §5). Deterministic for a given input.
 *
 * Guarantees:
 * - Every pool page goes to exactly one member (the group covers it once).
 * - Members' page counts differ by at most one ("as evenly as possible").
 * - Each member's pages are split across `durationDays` days that differ by at
 *   most one page; days past the member's page count are empty arrays, so
 *   `pagesByDay.length === durationDays` always.
 * - Rotation is best-effort: a member is handed a page they've already
 *   completed only when no member who still needs pages finds it new. With no
 *   history the split is contiguous blocks (natural to read); history reshuffles
 *   only as much as needed. The admin can override any assignment afterward.
 */
export function generateAssignments(input: AssignmentInput): AssignmentResult {
  const { durationDays, members } = input;
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error(`generateAssignments: durationDays must be a positive integer (got ${durationDays})`);
  }

  const result: AssignmentResult = {};
  if (members.length === 0) return result;

  // Unique, ascending pool — robust to however the caller built `pages`.
  const pool = [...new Set(input.pages)].sort((a, b) => a - b);

  // Even count targets: the first `remainder` members each get one extra page.
  const per = Math.floor(pool.length / members.length);
  const remainder = pool.length % members.length;
  const slots: MemberSlot[] = members.map((m, i) => ({
    id: m.id,
    remaining: per + (i < remainder ? 1 : 0),
    completed: new Set(m.completedPages),
    pages: [],
  }));

  // Assign each page to a member, preferring one for whom it's new, and staying
  // with the previous member while possible so each member's pages stay a
  // contiguous run. Remaining capacities sum to `pool.length`, so every page is
  // placed and there is always a candidate while pages remain.
  let last: MemberSlot | undefined;
  for (const page of pool) {
    const eligible = slots.filter((s) => s.remaining > 0);
    const fresh = eligible.filter((s) => !s.completed.has(page));
    const candidates = fresh.length > 0 ? fresh : eligible;

    let pick: MemberSlot | undefined;
    if (last && candidates.includes(last)) {
      pick = last; // extend the current member's contiguous run
    } else {
      // otherwise the most under-filled member, tie-broken by member order
      for (const s of candidates) if (!pick || s.remaining > pick.remaining) pick = s;
    }
    if (!pick) throw new Error('generateAssignments: no eligible member for a page (unreachable)');

    pick.pages.push(page);
    pick.remaining--;
    last = pick;
  }

  for (const s of slots) result[s.id] = splitAcrossDays(s.pages, durationDays);
  return result;
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

/**
 * The distribution round engine (REQUIREMENTS §5). Pure and deterministic:
 * given the current state of a series' active khatmas, `planDistribution`
 * decides what chunk every *ready* member receives next and whether the series
 * rolls over to a new khatma.
 *
 * Unread pages are NOT auto-reclaimed: a member still holding a pending chunk is
 * skipped (served nothing new) and their warning escalates by one — the pages
 * return to the pool only when the admin explicitly calls it in (see
 * `releaseChunk`). Each member's chunk is their additive {@link MemberCapacity}
 * (pages + a selected Surah + a selected Juz) taken from the oldest pool. Loose
 * pages advance from the front, preferring the member capacity that keeps the
 * next block consecutive; lifetime history then breaks coverage differences.
 * The data layer applies the resulting plan in one Firestore transaction.
 */

import type { PageUnitMaps } from './assignment';
import type { Assignment, MemberCapacity, WarningLevel } from './types';
import { isChunkCompleted, isChunkReleased } from './chunkStatus';

/** Roster info the planner needs about one participating member. */
export interface DistributionMember {
  id: string;
  /** Additive per-round reading capacity (pages + selected Surah + selected Juz). */
  capacity: MemberCapacity;
  /** Lifetime Quran pages already completed; used to match the next loose block. */
  completedPages: readonly number[];
  /** Disabled members are skipped entirely (no chunk, streak frozen). */
  enabled: boolean;
  /** Pending chunks keep warning normally but do not block the next assignment. */
  holdPages?: boolean;
}

/** One active khatma of the series, as read inside the transaction. */
export interface DistributionKhatmaState {
  id: string;
  /** Drives fair rotation of first-choice priority between khatma cycles. */
  seriesNumber: number;
  /** Unassigned pages, ascending. */
  remainingPages: number[];
  /** Rounds run against this khatma so far. */
  roundCount: number;
  /** This khatma's assignment docs (any subset; missing members = no history). */
  assignments: Assignment[];
}

export interface DistributionInput {
  /** The series' active khatmas ordered by `seriesNumber` ascending (1 or 2). */
  khatmas: DistributionKhatmaState[];
  /** Participating members in roster order. */
  members: DistributionMember[];
  /** Resolved scope pool used to seed khatma N+1 if this round rolls over. */
  newKhatmaPool: number[];
  /** Series number of the rollover khatma represented by `newKhatmaPool`. */
  newKhatmaSeriesNumber: number;
  /** page -> surah/juz lookups; required only when a member uses surah/juz units. */
  unitOfPage?: PageUnitMaps;
  /**
   * A redistribution reshuffles recalled loose pages inside the current round;
   * it neither advances the round counter nor rolls over to a new khatma.
   */
  mode?: 'new-round' | 'redistribution';
}

/** A chunk to append to `khatmas/{khatmaId}/assignments/{memberId}`. */
export interface PlannedChunk {
  /** Target khatma id, or `null` for the rollover khatma minted this round. */
  khatmaId: string | null;
  memberId: string;
  round: number;
  pages: number[];
  /** Subset of `pages` taken by the member's loose-page capacity. */
  loosePages: number[];
}

export interface DistributionPlan {
  /** Post-settle `missedStreak` per member (only members whose streak changed). */
  streaks: Record<string, number>;
  /** New chunk per served member. Empty-page chunks are never emitted. */
  chunks: PlannedChunk[];
  /** Post-round pool + round counter for every input khatma. */
  khatmaUpdates: Array<{
    khatmaId: string;
    remainingPages: number[];
    roundCount: number;
  }>;
  /** Present when the oldest pools drained mid-round: seed for khatma N+1. */
  rollover?: { remainingPages: number[] };
  /** Khatma ids that are fully read after settling — flip to `completed`. */
  completions: string[];
}

/** Map a missed-round streak to its admin-facing warning (REQUIREMENTS §8). */
export function warningLevel(missedStreak: number): WarningLevel {
  if (missedStreak >= 2) return 'red';
  if (missedStreak >= 1) return 'yellow';
  return 'none';
}

/** Merge `pages` into ascending `pool` keeping it sorted (both duplicate-free). */
function mergeSorted(pool: number[], pages: number[]): number[] {
  return [...pool, ...pages].sort((a, b) => a - b);
}

/**
 * Serve one member's additive capacity from `pool` (mutating it):
 * the oldest `cap.pages` loose pages, PLUS the specific Surah `cap.surahs` and
 * specific Juz `cap.juz`. Whole units are pulled from wherever they remain in
 * the pool and are never split. Surah/Juz portions need `unitOfPage` — without
 * it they are skipped.
 */
export function takeChunk(
  pool: number[],
  cap: MemberCapacity,
  unitOfPage?: PageUnitMaps,
): number[] {
  return takeChunkParts(pool, cap, unitOfPage).pages;
}

interface ChunkParts {
  pages: number[];
  loosePages: number[];
}

/** Take one additive chunk while retaining which pages came from loose capacity. */
function takeChunkParts(
  pool: number[],
  cap: MemberCapacity,
  unitOfPage?: PageUnitMaps,
): ChunkParts {
  const taken: number[] = [];
  const loosePages: number[] = [];
  const pages = Math.max(0, Math.floor(cap.pages));
  takeFrontPages(pool, loosePages, pages);
  taken.push(...loosePages);
  takeSpecificUnit(pool, taken, Math.max(0, Math.floor(cap.surahs)), unitOfPage?.surah);
  takeSpecificUnit(pool, taken, Math.max(0, Math.floor(cap.juz)), unitOfPage?.juz);
  return {
    pages: taken.sort((a, b) => a - b),
    loosePages: loosePages.sort((a, b) => a - b),
  };
}

/**
 * Take the oldest loose pages as one front slice. Because the normal pool is
 * ascending and contiguous, this keeps a member's loose assignment consecutive
 * instead of scanning past previously completed pages and creating holes.
 */
function takeFrontPages(pool: number[], taken: number[], count: number): void {
  let weightedPages = 0;
  while (pool.length > 0 && weightedPages < count) {
    const page = pool.shift()!;
    taken.push(page);
    if (page > 2) weightedPages++;
  }
}

/** The front loose block, counting Quran pages 1–2 as free pages. */
function frontLooseBlock(pool: readonly number[], capacity: number): number[] {
  const block: number[] = [];
  let weightedPages = 0;
  for (const page of pool) {
    if (weightedPages >= capacity) break;
    block.push(page);
    if (page > 2) weightedPages++;
  }
  return block;
}

/** Pull every in-pool page of the selected unit id (`0` = none) into `taken`. */
function takeSpecificUnit(
  pool: number[],
  taken: number[],
  unitId: number,
  ofPage?: Record<number, number>,
): void {
  if (unitId <= 0 || !ofPage) return;
  for (let i = 0; i < pool.length;) {
    if (ofPage[pool[i]!] === unitId) taken.push(pool.splice(i, 1)[0]!);
    else i++;
  }
}

/** Rotate a list left without mutating it. */
function rotate<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

interface FrontBlockScore {
  gaps: number;
  completed: number;
  total: number;
}

/** Consecutiveness and prior coverage of this member's next front loose block. */
function frontBlockScore(
  member: DistributionMember,
  pool: readonly number[],
): FrontBlockScore | undefined {
  const count = Math.max(0, Math.floor(member.capacity.pages));
  const block = frontLooseBlock(pool, count);
  if (block.length === 0) return undefined;
  const completed = new Set(member.completedPages);
  let gaps = 0;
  let overlap = 0;
  for (let i = 0; i < block.length; i++) {
    if (completed.has(block[i]!)) overlap++;
    if (i > 0 && block[i]! !== block[i - 1]! + 1) gaps++;
  }
  return { gaps, completed: overlap, total: block.length };
}

/**
 * Match the next front loose block to the member whose capacity introduces the
 * fewest gaps, then the lowest completed-page overlap. `members` is already in
 * warning/rotation order, which breaks equal scores. Unit-only members keep
 * their existing relative priority because a zero-page loose block cannot be
 * scored.
 */
function pickFrontBlockMatch(
  members: readonly DistributionMember[],
  pool: readonly number[],
): DistributionMember {
  let best = members[0]!;
  let bestScore = frontBlockScore(best, pool);
  for (let i = 1; i < members.length; i++) {
    const candidate = members[i]!;
    const candidateScore = frontBlockScore(candidate, pool);
    if (!bestScore || !candidateScore) continue;
    const candidateWeighted = candidateScore.completed * bestScore.total;
    const bestWeighted = bestScore.completed * candidateScore.total;
    if (
      candidateScore.gaps < bestScore.gaps ||
      (candidateScore.gaps === bestScore.gaps && candidateWeighted < bestWeighted)
    ) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

/** A member's chunk located across the series' khatmas. */
interface LocatedChunk {
  khatmaId: string;
  seriesNumber: number;
  round: number;
  date: string;
  pages: number[];
  released: boolean;
  done: boolean;
}

/**
 * The member's most recent non-empty chunk across all active khatmas — the one
 * to settle. Recency by `date` (one round per day), ties broken by khatma
 * order (a newer khatma's chunk wins).
 */
function latestChunk(
  khatmas: readonly DistributionKhatmaState[],
  memberId: string,
): LocatedChunk | undefined {
  let latest: LocatedChunk | undefined;
  for (const k of khatmas) {
    const assignment = k.assignments.find((a) => a.memberId === memberId);
    if (!assignment) continue;
    for (const chunk of assignment.rounds) {
      if (chunk.pages.length === 0) continue;
      if (
        !latest ||
        chunk.date > latest.date ||
        (chunk.date === latest.date && k.seriesNumber >= latest.seriesNumber)
      ) {
        latest = {
          khatmaId: k.id,
          seriesNumber: k.seriesNumber,
          round: chunk.round,
          date: chunk.date,
          pages: chunk.pages,
          released: isChunkReleased(chunk),
          done: isChunkCompleted(assignment, chunk),
        };
      }
    }
  }
  return latest;
}

/** Highest stored streak across the member's assignment docs (robust to drift). */
function currentStreak(
  khatmas: readonly DistributionKhatmaState[],
  memberId: string,
): number {
  let streak = 0;
  for (const k of khatmas) {
    const assignment = k.assignments.find((a) => a.memberId === memberId);
    if (assignment && assignment.missedStreak > streak) streak = assignment.missedStreak;
  }
  return streak;
}

/**
 * Plan one distribution round. Algorithm (REQUIREMENTS §5):
 *
 * 1. SETTLE the previous round (no auto-release). Per member, look at their most
 *    recent chunk. Done → streak resets to 0. Still pending (not done, not
 *    released) → the member KEEPS the pages and is skipped this round, and their
 *    `missedStreak` climbs by one (the warning escalates by rounds waited). No
 *    prior chunk (new member) or already released → nothing to settle.
 * 2. ORDER the *ready* members (enabled and not holding a pending chunk): clean
 *    members first, then flagged. Within each tier, match the oldest front pages
 *    to the capacity that introduces the fewest gaps, then to the member with
 *    the least lifetime overlap; rotated roster order breaks ties.
 * 3. SERVE each matched member their additive {@link MemberCapacity} from the
 *    oldest khatma's pool (via `takeChunk`). Loose pages come from the front so
 *    normal chunks stay consecutive and old holes do not linger. A chunk never
 *    spans two khatmas: when a pool can only partially fill it, that member gets
 *    the short chunk and the next member draws from the next pool. When every
 *    existing pool is empty, the round ROLLS OVER: khatma N+1 is minted from
 *    `newKhatmaPool` and serving continues from it.
 * 4. COMPLETE: any khatma whose pool is empty and whose chunks are all done or
 *    released (and that served nothing this round) is fully read. A pending
 *    chunk therefore blocks completion until it is done or the admin releases it.
 */
export function planDistribution(input: DistributionInput): DistributionPlan {
  const {
    khatmas,
    members,
    newKhatmaPool,
    newKhatmaSeriesNumber,
    unitOfPage,
    mode = 'new-round',
  } = input;
  const advancesRound = mode === 'new-round';

  // Working pool state per khatma, in series order.
  const pools = khatmas.map((k) => ({
    id: k.id,
    seriesNumber: k.seriesNumber,
    pages: [...k.remainingPages],
    served: false,
  }));

  const streaks: Record<string, number> = {};
  const blocked = new Set<string>(); // members still holding an unread chunk

  // 1. Settle the previous round — done resets, pending blocks + escalates.
  for (const member of members) {
    const latest = latestChunk(khatmas, member.id);
    if (!latest || latest.released) continue; // new member or already released → ready
    if (latest.done) {
      if (currentStreak(khatmas, member.id) !== 0) streaks[member.id] = 0;
      continue;
    }
    // Pending → keep the pages with the member (no release); escalate the flag.
    if (member.holdPages !== true) blocked.add(member.id);
    if (member.enabled) streaks[member.id] = currentStreak(khatmas, member.id) + 1;
  }

  const streakOf = (id: string): number => streaks[id] ?? currentStreak(khatmas, id);

  // 2. Ready members only: rotate first-choice priority, clean before flagged.
  const ready = members.filter((m) => m.enabled && !blocked.has(m.id));
  const servingSeriesNumber =
    pools.find((p) => p.pages.length > 0)?.seriesNumber ?? newKhatmaSeriesNumber;
  const rotatedReady = rotate(ready, Math.max(0, servingSeriesNumber - 1));
  const serveTiers = [
    rotatedReady.filter((m) => streakOf(m.id) === 0),
    rotatedReady.filter((m) => streakOf(m.id) > 0),
  ];

  // 3. Serve consecutive front chunks, matching history within each priority tier.
  const chunks: PlannedChunk[] = [];
  let rolloverPool: number[] | undefined;
  let rolloverServed = false;
  for (const tier of serveTiers) {
    const waiting = [...tier];
    while (waiting.length > 0) {
      const source = pools.find((p) => p.pages.length > 0);
      if (!source) rolloverPool ??= advancesRound ? [...newKhatmaPool] : [];
      const member = pickFrontBlockMatch(waiting, source?.pages ?? rolloverPool ?? []);
      waiting.splice(waiting.indexOf(member), 1);

      let khatmaId: string | null;
      let round: number;
      let parts: ChunkParts;
      if (source) {
        const khatma = khatmas.find((k) => k.id === source.id);
        parts = takeChunkParts(source.pages, member.capacity, unitOfPage);
        if (parts.pages.length > 0) source.served = true;
        khatmaId = source.id;
        round = Math.max(1, (khatma?.roundCount ?? 0) + (advancesRound ? 1 : 0));
      } else {
        // Rollover: every existing pool is empty — mint khatma N+1.
        parts = takeChunkParts(rolloverPool!, member.capacity, unitOfPage);
        khatmaId = null;
        round = 1;
        if (parts.pages.length > 0) rolloverServed = true;
      }
      if (parts.pages.length > 0) {
        chunks.push({
          khatmaId,
          memberId: member.id,
          round,
          pages: parts.pages,
          loosePages: parts.loosePages,
        });
      }
    }
  }

  // 4. Completions: pool empty, nothing served this round, all chunks settled.
  const completions: string[] = [];
  for (const k of khatmas) {
    const pool = pools.find((p) => p.id === k.id);
    if (!pool || pool.pages.length > 0 || pool.served) continue;
    const allSettled = k.assignments.every((a) =>
      a.rounds.every(
        (chunk) =>
          chunk.pages.length === 0 ||
          isChunkReleased(chunk) ||
          isChunkCompleted(a, chunk),
      ),
    );
    if (allSettled) completions.push(k.id);
  }

  return {
    streaks,
    chunks,
    khatmaUpdates: pools.map((p) => {
      const k = khatmas.find((kh) => kh.id === p.id);
      return {
        khatmaId: p.id,
        remainingPages: p.pages,
        roundCount: p.served
          ? Math.max(1, (k?.roundCount ?? 0) + (advancesRound ? 1 : 0))
          : (k?.roundCount ?? 0),
      };
    }),
    ...(rolloverServed && rolloverPool
      ? { rollover: { remainingPages: rolloverPool } }
      : {}),
    completions,
  };
}

/** The effect of manually returning a member's pending chunk to the pool. */
export interface ChunkRelease {
  /** Khatma-local rounds released together (to mark `released: true`). */
  rounds: number[];
  /** `remainingPages` after merging the released pages back in, ascending. */
  remainingPages: number[];
  /** The member's reset streak — 0, since they no longer hold the chunk. */
  missedStreak: number;
}

/**
 * Compute the admin-triggered return of a member's unread pages to the pool
 * (REQUIREMENTS §5). Finds every pending chunk, merges its pages back into
 * `remainingPages` (sorted), and resets the streak to 0. Returns
 * `undefined` when there is nothing to release. Pure — the data layer applies
 * the result (mark the chunk `released`, write the pool + streak) in one write.
 */
export function releaseChunk(
  assignment: Assignment,
  remainingPages: number[],
): ChunkRelease | undefined {
  const pending = assignment.rounds.filter(
    (chunk) =>
      chunk.pages.length > 0 &&
      !isChunkReleased(chunk) &&
      !isChunkCompleted(assignment, chunk),
  );
  if (pending.length === 0) return undefined;
  return {
    rounds: [...new Set(pending.map((chunk) => chunk.round))],
    remainingPages: mergeSorted(
      remainingPages,
      pending.flatMap((chunk) => chunk.pages),
    ),
    missedStreak: 0,
  };
}

/** Result of recalling only the loose-page portion of one pending chunk. */
export interface LoosePageRecall {
  assignment: Assignment;
  remainingPages: number[];
}

export interface PageRedistributionRecall {
  /** Post-recall khatma state used by the distribution planner. */
  khatmas: DistributionKhatmaState[];
  /** Assignment documents whose pending loose pages were recalled. */
  changedAssignments: Set<string>;
  /** Members whose unread chunk was fully recalled and may receive replacement pages. */
  eligibleMemberIds: Set<string>;
}

/** True when an assignment still contains an unread, unreleased chunk. */
function hasPendingChunk(assignment: Assignment): boolean {
  return assignment.rounds.some(
    (chunk) =>
      chunk.pages.length > 0 &&
      !isChunkReleased(chunk) &&
      !isChunkCompleted(assignment, chunk),
  );
}

/**
 * Recall unread loose pages across the selected khatmas and identify the only
 * readers who participate in the replacement distribution. A reader must have
 * actually had loose pages recalled, and must not still hold a preserved Surah
 * or Juz portion. Finished readers and readers without a current chunk remain
 * untouched.
 */
export function recallLoosePagesForRedistribution(
  khatmas: readonly DistributionKhatmaState[],
): PageRedistributionRecall {
  const changedAssignments = new Set<string>();
  const recalledMemberIds = new Set<string>();
  const recalledKhatmas = khatmas.map((khatma) => {
    let remainingPages = [...khatma.remainingPages];
    const assignments = khatma.assignments.map((assignment) => {
      const recall = recallLoosePagesFromAssignment(assignment, remainingPages);
      if (!recall) return assignment;
      remainingPages = recall.remainingPages;
      changedAssignments.add(`${khatma.id}:${assignment.memberId}`);
      recalledMemberIds.add(assignment.memberId);
      return recall.assignment;
    });
    return { ...khatma, remainingPages, assignments };
  });

  const eligibleMemberIds = new Set(
    [...recalledMemberIds].filter((memberId) =>
      recalledKhatmas.every((khatma) =>
        khatma.assignments.every(
          (assignment) =>
            assignment.memberId !== memberId || !hasPendingChunk(assignment),
        ),
      ),
    ),
  );

  return { khatmas: recalledKhatmas, changedAssignments, eligibleMemberIds };
}

/**
 * Recall loose pages for redistribution while preserving whole-surah and
 * whole-juz allocations.
 */
export function recallLoosePagesFromAssignment(
  assignment: Assignment,
  remainingPages: number[],
): LoosePageRecall | undefined {
  const rounds = [...assignment.rounds];
  let nextRemainingPages = [...remainingPages];
  let changed = false;

  for (let i = 0; i < rounds.length; i++) {
    const chunk = rounds[i]!;
    if (chunk.pages.length === 0 || isChunkReleased(chunk)) continue;
    if (isChunkCompleted(assignment, chunk)) continue;

    const recalled = new Set(
      chunk.loosePages.filter((page) => chunk.pages.includes(page)),
    );
    if (recalled.size === 0) continue;

    const pages = chunk.pages.filter((page) => !recalled.has(page));
    rounds[i] = {
      ...chunk,
      pages,
      loosePages: [],
      redistributedPages: [...new Set([...chunk.redistributedPages, ...recalled])].sort(
        (a, b) => a - b,
      ),
      ...(pages.length === 0
        ? {
            status: 'released' as const,
            released: true as const,
            releaseReason: 'redistributed' as const,
          }
        : {}),
    };
    nextRemainingPages = mergeSorted(nextRemainingPages, [...recalled]);
    changed = true;
  }

  if (!changed) return undefined;
  const nextAssignment = { ...assignment, rounds };
  return {
    assignment: {
      ...nextAssignment,
      missedStreak: hasPendingChunk(nextAssignment) ? assignment.missedStreak : 0,
    },
    remainingPages: nextRemainingPages,
  };
}

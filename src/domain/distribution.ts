/**
 * The distribution round engine (REQUIREMENTS §5). Pure and deterministic:
 * given the current state of a series' active khatmas, `planDistribution`
 * decides who gets flagged, which pages return to the pool, what chunk every
 * member receives next, and whether the series rolls over to a new khatma.
 * The data layer applies the resulting plan in one Firestore transaction.
 */

import type { Assignment, WarningLevel } from './types';

/** Roster info the planner needs about one participating member. */
export interface DistributionMember {
  id: string;
  /** Chunk size — pages handed to this member per round. */
  pagesPerDay: number;
  /** Disabled members are skipped entirely (no chunk, streak frozen). */
  enabled: boolean;
}

/** One active khatma of the series, as read inside the transaction. */
export interface DistributionKhatmaState {
  id: string;
  /** Unassigned pages, ascending (invariant: consumed from the front). */
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
}

/** A chunk to append to `khatmas/{khatmaId}/assignments/{memberId}`. */
export interface PlannedChunk {
  /** Target khatma id, or `null` for the rollover khatma minted this round. */
  khatmaId: string | null;
  memberId: string;
  round: number;
  pages: number[];
}

export interface DistributionPlan {
  /** Chunks whose member missed the round — flag `released: true` on each. */
  releases: Array<{ khatmaId: string; memberId: string; round: number }>;
  /** Post-settle `missedStreak` per member (only members with a settled chunk). */
  streaks: Record<string, number>;
  /** New chunk per served member. Empty-page chunks are never emitted. */
  chunks: PlannedChunk[];
  /** Post-round pool + round counter for every input khatma. */
  khatmaUpdates: Array<{ khatmaId: string; remainingPages: number[]; roundCount: number }>;
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

/** A member's chunk located across the series' khatmas. */
interface LocatedChunk {
  khatmaId: string;
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
      if (!latest || chunk.date >= latest.date) {
        latest = {
          khatmaId: k.id,
          round: chunk.round,
          date: chunk.date,
          pages: chunk.pages,
          released: chunk.released === true,
          done: assignment.doneByRound[chunk.round] !== undefined,
        };
      }
    }
  }
  return latest;
}

/** Highest stored streak across the member's assignment docs (robust to drift). */
function currentStreak(khatmas: readonly DistributionKhatmaState[], memberId: string): number {
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
 * 1. SETTLE the previous round: per member, look at their most recent chunk.
 *    Pending (not done, not released) → release it (pages merge back into that
 *    khatma's pool, in sorted position) and increment the member's
 *    `missedStreak`. Done → streak resets to 0. No chunk yet (new member) or
 *    already released (member was paused) → streak untouched.
 * 2. ORDER members: clean members (streak 0 after settling) first, in the
 *    given roster order, then flagged members — so released low page numbers
 *    are re-served to the group before the flagged member gets new pages.
 *    Disabled members are skipped.
 * 3. SERVE: each member takes `pagesPerDay` pages off the front of the oldest
 *    khatma's pool. A chunk never spans two khatmas: when a pool can only
 *    partially fill a chunk, that member gets the short chunk and the next
 *    member draws from the next pool. When every existing pool is empty, the
 *    round ROLLS OVER: khatma N+1 is minted from `newKhatmaPool` and serving
 *    continues from it.
 * 4. COMPLETE: any khatma whose pool is empty and whose chunks are all done or
 *    released (and that served nothing this round) is fully read.
 */
export function planDistribution(input: DistributionInput): DistributionPlan {
  const { khatmas, members, newKhatmaPool } = input;

  // Working pool state per khatma, in series order.
  const pools = khatmas.map((k) => ({
    id: k.id,
    pages: [...k.remainingPages],
    served: false,
  }));

  const releases: DistributionPlan['releases'] = [];
  const streaks: Record<string, number> = {};
  const releasedNow = new Set<string>(); // "khatmaId/memberId/round"

  // 1. Settle the previous round.
  for (const member of members) {
    const latest = latestChunk(khatmas, member.id);
    if (!latest || latest.released) continue;
    if (latest.done) {
      if (member.enabled && currentStreak(khatmas, member.id) !== 0) streaks[member.id] = 0;
      continue;
    }
    // Pending → release the pages so they never lag behind the group. A miss
    // escalates the streak; a paused (disabled) member is excused — their pages
    // return to the pool but their streak is frozen.
    releases.push({ khatmaId: latest.khatmaId, memberId: member.id, round: latest.round });
    releasedNow.add(`${latest.khatmaId}/${member.id}/${latest.round}`);
    const pool = pools.find((p) => p.id === latest.khatmaId);
    if (pool) pool.pages = mergeSorted(pool.pages, latest.pages);
    if (member.enabled) streaks[member.id] = currentStreak(khatmas, member.id) + 1;
  }

  const streakOf = (id: string): number => streaks[id] ?? currentStreak(khatmas, id);

  // 2. Clean members first (roster order), then flagged; disabled skipped.
  const enabled = members.filter((m) => m.enabled);
  const serveOrder = [
    ...enabled.filter((m) => streakOf(m.id) === 0),
    ...enabled.filter((m) => streakOf(m.id) > 0),
  ];

  // 3. Serve chunks from the front of the oldest non-empty pool.
  const chunks: PlannedChunk[] = [];
  let rolloverPool: number[] | undefined;
  let rolloverServed = false;
  for (const member of serveOrder) {
    const size = Math.max(0, Math.floor(member.pagesPerDay));
    if (size === 0) continue;

    const source = pools.find((p) => p.pages.length > 0);
    let khatmaId: string | null;
    let round: number;
    let pages: number[];
    if (source) {
      const khatma = khatmas.find((k) => k.id === source.id);
      pages = source.pages.splice(0, size); // short chunk when the pool drains
      source.served = true;
      khatmaId = source.id;
      round = (khatma?.roundCount ?? 0) + 1;
    } else {
      // Rollover: every existing pool is empty — mint khatma N+1.
      rolloverPool ??= [...newKhatmaPool];
      pages = rolloverPool.splice(0, size);
      khatmaId = null;
      round = 1;
      if (pages.length > 0) rolloverServed = true;
    }
    if (pages.length > 0) chunks.push({ khatmaId, memberId: member.id, round, pages });
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
          chunk.released === true ||
          a.doneByRound[chunk.round] !== undefined ||
          releasedNow.has(`${k.id}/${a.memberId}/${chunk.round}`),
      ),
    );
    if (allSettled) completions.push(k.id);
  }

  return {
    releases,
    streaks,
    chunks,
    khatmaUpdates: pools.map((p) => {
      const k = khatmas.find((kh) => kh.id === p.id);
      return {
        khatmaId: p.id,
        remainingPages: p.pages,
        roundCount: (k?.roundCount ?? 0) + (p.served ? 1 : 0),
      };
    }),
    ...(rolloverServed && rolloverPool ? { rollover: { remainingPages: rolloverPool } } : {}),
    completions,
  };
}

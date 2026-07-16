/**
 * Du3a2 al-khatma reciter rotation (REQUIREMENTS §7, updated). Each khatma has a
 * single designated reciter; the duty should rotate so it spreads across people
 * over successive (and concurrent) khatmas. Pure and deterministic — the caller
 * passes the existing khatmas; this never touches Firestore.
 */

import type { Khatma } from './types';

/** The khatma fields the rotation needs: who recited and when it was set/finished. */
type PriorKhatma = Pick<Khatma, 'duaReciterId' | 'completedAt' | 'createdAt'>;

/**
 * Choose the du3a reciter for a new khatma from its members. Picks the candidate
 * who has been designated **least often** across `priorKhatmas`; ties broken by
 * who was designated **longest ago** (never-designated wins), then by the order
 * of `candidateIds`. Candidate ids must be non-empty. The admin may override
 * the result.
 *
 * Counts every prior khatma that named the candidate (active or completed), so
 * that concurrently-running khatmas still rotate the designation.
 */
export function pickDuaReciter(
  candidateIds: readonly string[],
  priorKhatmas: readonly PriorKhatma[],
): string {
  const best = candidateIds[0];
  if (best === undefined)
    throw new Error('pickDuaReciter: at least one candidate is required');

  const stats = new Map<string, { count: number; lastAt: number }>();
  for (const id of candidateIds) stats.set(id, { count: 0, lastAt: -1 });

  for (const k of priorKhatmas) {
    const id = k.duaReciterId;
    const s = stats.get(id);
    if (!s) continue; // reciter isn't among this khatma's candidates — ignore
    s.count += 1;
    s.lastAt = Math.max(s.lastAt, k.completedAt ?? k.createdAt);
  }

  let winner = best;
  let winnerStats = stats.get(winner) ?? { count: 0, lastAt: -1 };
  for (const id of candidateIds.slice(1)) {
    const s = stats.get(id) ?? { count: 0, lastAt: -1 };
    if (
      s.count < winnerStats.count ||
      (s.count === winnerStats.count && s.lastAt < winnerStats.lastAt)
    ) {
      winner = id;
      winnerStats = s;
    }
  }
  return winner;
}

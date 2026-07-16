import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Assignment } from '@/domain/types';
import { db } from './firebase';

/** The all-empty assignment a member starts a khatma with. */
export function emptyAssignment(memberId: string): Assignment {
  return { memberId, rounds: [], doneByRound: {}, missedStreak: 0 };
}

/** Assignments live under each khatma: `khatmas/{khatmaId}/assignments/{memberId}`. */
export function assignmentsCol(khatmaId: string): CollectionReference {
  return collection(doc(db, 'khatmas', khatmaId), 'assignments');
}

/** Reference to one member's assignment doc (its id is the memberId). */
export function assignmentDoc(khatmaId: string, memberId: string): DocumentReference {
  return doc(assignmentsCol(khatmaId), memberId);
}

/** Live-subscribe to every member's assignment in a khatma (for progress views). */
export function subscribeAssignments(
  khatmaId: string,
  onChange: (assignments: Assignment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    assignmentsCol(khatmaId),
    (snap) => onChange(snap.docs.map((d) => d.data() as Assignment)),
    (error) => onError?.(error),
  );
}

/** Read one member's assignment once (undefined if they aren't in the khatma). */
export async function getAssignment(
  khatmaId: string,
  memberId: string,
): Promise<Assignment | undefined> {
  const snap = await getDoc(assignmentDoc(khatmaId, memberId));
  return snap.exists() ? (snap.data() as Assignment) : undefined;
}

/**
 * Thrown by {@link markRoundDone} when the chunk was already released back to
 * the pool (the member missed the round and distribution reassigned the pages).
 * The member UI catches this and shows a gentle "your pages were returned to
 * the group" note instead of an error.
 */
export class ReleasedChunkError extends Error {
  constructor() {
    super('markRoundDone: the chunk was released back to the pool');
    this.name = 'ReleasedChunkError';
  }
}

/**
 * One-tap "I finished my pages" (REQUIREMENTS §6). Atomically, in one
 * transaction:
 *  - stamps round `round` done on the member's assignment, and
 *  - unions that round's pages into the person's lifetime `completedPages`
 *    (`roster/{memberId}`), which drives the personal insight.
 *
 * Idempotent: re-tapping an already-done round is a no-op. Throws
 * {@link ReleasedChunkError} if the chunk was released by a later distribution.
 */
export function markRoundDone(
  khatmaId: string,
  memberId: string,
  round: number,
): Promise<void> {
  const assignmentRef = assignmentDoc(khatmaId, memberId);
  const personRef = doc(db, 'roster', memberId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(assignmentRef);
    if (!snap.exists()) {
      throw new Error(
        `markRoundDone: no assignment for ${memberId} in khatma ${khatmaId}`,
      );
    }
    const data = snap.data() as Assignment;
    if (data.doneByRound[round] !== undefined) return; // already done — idempotent

    const chunk = data.rounds.find((c) => c.round === round);
    if (!chunk) throw new Error(`markRoundDone: no round ${round} for ${memberId}`);
    if (chunk.released === true) throw new ReleasedChunkError();

    tx.update(assignmentRef, { [`doneByRound.${round}`]: Date.now() });
    if (chunk.pages.length > 0) {
      tx.update(personRef, { completedPages: arrayUnion(...chunk.pages) });
    }
  });
}

/**
 * Admin correction of a mistaken "read" mark (REQUIREMENTS §8) — the inverse
 * of {@link markRoundDone}: clears round `round` and pulls that round's pages
 * back out of the person's lifetime `completedPages`.
 *
 * v1 simplification: `completedPages` is a set with no read-count, so if the
 * same page was also completed via another khatma this removal drops it from
 * the lifetime total too. The pages are NOT returned to the khatma pool — the
 * member is still expected to read them (they stay pending until the next
 * distribution settles them).
 */
export function clearRoundDone(
  khatmaId: string,
  memberId: string,
  round: number,
): Promise<void> {
  const assignmentRef = assignmentDoc(khatmaId, memberId);
  const personRef = doc(db, 'roster', memberId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(assignmentRef);
    if (!snap.exists()) return;
    const data = snap.data() as Assignment;
    if (data.doneByRound[round] === undefined) return; // not done — nothing to clear

    const pages = data.rounds.find((c) => c.round === round)?.pages ?? [];
    tx.update(assignmentRef, { [`doneByRound.${round}`]: deleteField() });
    if (pages.length > 0) {
      tx.update(personRef, { completedPages: arrayRemove(...pages) });
    }
  });
}

/**
 * Admin removes a member's warning (REQUIREMENTS §8): resets `missedStreak`
 * to 0 on every given khatma (pass the series' active khatma ids so the badge
 * disappears everywhere at once).
 */
export async function clearWarning(
  khatmaIds: readonly string[],
  memberId: string,
): Promise<void> {
  const batch = writeBatch(db);
  for (const khatmaId of khatmaIds) {
    batch.set(assignmentDoc(khatmaId, memberId), { missedStreak: 0 }, { merge: true });
  }
  await batch.commit();
}

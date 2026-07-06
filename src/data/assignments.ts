import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type CollectionReference,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Assignment } from '@/domain/types';
import { db } from './firebase';

/**
 * Firestore forbids nested arrays, so the domain's `pagesByDay: number[][]` is
 * stored as an array of `{ pages }` maps and converted back on read. This quirk
 * is confined to the data layer — the rest of the app sees plain `number[][]`.
 */
interface StoredAssignment {
  memberId: string;
  pagesByDay: Array<{ pages: number[] }>;
  doneByDay?: Record<string, number>;
}

/** Wrap `number[][]` into the Firestore-safe stored shape. */
export function toStoredPages(pagesByDay: number[][]): Array<{ pages: number[] }> {
  return pagesByDay.map((pages) => ({ pages }));
}

/** Map a stored assignment doc back to the domain `Assignment`. */
function fromStored(data: StoredAssignment): Assignment {
  return {
    memberId: data.memberId,
    pagesByDay: (data.pagesByDay ?? []).map((day) => day.pages ?? []),
    doneByDay: data.doneByDay ?? {},
  };
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
    (snap) => onChange(snap.docs.map((d) => fromStored(d.data() as StoredAssignment))),
    (error) => onError?.(error),
  );
}

/** Read one member's assignment once (undefined if they aren't in the khatma). */
export async function getAssignment(
  khatmaId: string,
  memberId: string,
): Promise<Assignment | undefined> {
  const snap = await getDoc(assignmentDoc(khatmaId, memberId));
  return snap.exists() ? fromStored(snap.data() as StoredAssignment) : undefined;
}

/**
 * One-tap "I finished my pages today" (REQUIREMENTS §6). Atomically, in one
 * transaction:
 *  - stamps day `dayIndex` done on the member's assignment, and
 *  - unions that day's pages into the person's lifetime `completedPages`
 *    (`roster/{memberId}`), which drives future-khatma rotation (REQUIREMENTS §5).
 *
 * Idempotent: re-tapping an already-done day is a no-op (arrayUnion would dedupe
 * anyway, but we skip the write entirely to preserve the original timestamp).
 */
export function markDayDone(
  khatmaId: string,
  memberId: string,
  dayIndex: number,
): Promise<void> {
  const assignmentRef = assignmentDoc(khatmaId, memberId);
  const personRef = doc(db, 'roster', memberId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(assignmentRef);
    if (!snap.exists()) {
      throw new Error(`markDayDone: no assignment for ${memberId} in khatma ${khatmaId}`);
    }
    const data = fromStored(snap.data() as StoredAssignment);
    if (data.doneByDay[dayIndex] !== undefined) return; // already done — idempotent

    const pages = data.pagesByDay[dayIndex] ?? [];
    tx.update(assignmentRef, { [`doneByDay.${dayIndex}`]: Date.now() });
    if (pages.length > 0) {
      tx.update(personRef, { completedPages: arrayUnion(...pages) });
    }
  });
}

/**
 * Admin correction of a mistaken "read" mark (REQUIREMENTS §4, §8) — the inverse
 * of {@link markDayDone}: clears day `dayIndex` and pulls that day's pages back
 * out of the person's lifetime `completedPages`.
 *
 * v1 simplification: `completedPages` is a set with no read-count, so if the
 * same page was also completed via another khatma/day this removal drops it from
 * the lifetime total too. Accepted given the low stakes — see
 * ARCHITECTURE.md#firestore-data-model.
 */
export function clearDayDone(
  khatmaId: string,
  memberId: string,
  dayIndex: number,
): Promise<void> {
  const assignmentRef = assignmentDoc(khatmaId, memberId);
  const personRef = doc(db, 'roster', memberId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(assignmentRef);
    if (!snap.exists()) return;
    const data = fromStored(snap.data() as StoredAssignment);
    if (data.doneByDay[dayIndex] === undefined) return; // not done — nothing to clear

    const pages = data.pagesByDay[dayIndex] ?? [];
    tx.update(assignmentRef, { [`doneByDay.${dayIndex}`]: deleteField() });
    if (pages.length > 0) {
      tx.update(personRef, { completedPages: arrayRemove(...pages) });
    }
  });
}

/**
 * Admin override of a member's auto-generated assignment (REQUIREMENTS §5, §8).
 * Replaces `pagesByDay`; any existing done marks are preserved (merge).
 */
export function overrideAssignment(
  khatmaId: string,
  memberId: string,
  pagesByDay: number[][],
): Promise<void> {
  return setDoc(
    assignmentDoc(khatmaId, memberId),
    { memberId, pagesByDay: toStoredPages(pagesByDay) },
    { merge: true },
  );
}

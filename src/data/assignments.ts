import { collection, doc, type CollectionReference } from 'firebase/firestore';
import type { Assignment } from '@/domain/types';
import { db } from './firebase';

/** Assignments live under each khatma: `khatmas/{khatmaId}/assignments/{memberId}`. */
export function assignmentsCol(khatmaId: string): CollectionReference {
  return collection(doc(db, 'khatmas', khatmaId), 'assignments');
}

// -----------------------------------------------------------------------------
// STUBS — implemented in Stage 2 (feature work). Kept with their final
// signatures so the UI can be wired against them now.
// -----------------------------------------------------------------------------

export function subscribeAssignments(
  _khatmaId: string,
  _onChange: (assignments: Assignment[]) => void,
  _onError?: (error: Error) => void,
): never {
  throw new Error('subscribeAssignments: not implemented yet (Stage 2)');
}

/** One-tap "I finished today" — marks a member's day done (REQUIREMENTS §6). */
export function markDayDone(
  _khatmaId: string,
  _memberId: string,
  _dayIndex: number,
): Promise<void> {
  throw new Error('markDayDone: not implemented yet (Stage 2)');
}

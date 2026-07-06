import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type CollectionReference,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AssignmentResult } from '@/domain/assignment';
import type { Khatma } from '@/domain/types';
import { assignmentsCol, toStoredPages } from './assignments';
import { db } from './firebase';

/** Firestore collection handle for khatmas. */
export const khatmasCol: CollectionReference = collection(db, 'khatmas');

/** Live-subscribe to all khatmas, newest first (admin dashboard). */
export function subscribeKhatmas(
  onChange: (khatmas: Khatma[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(khatmasCol, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Khatma, 'id'>) }))),
    (error) => onError?.(error),
  );
}

/** Read one khatma once (undefined if not found). */
export async function getKhatma(id: string): Promise<Khatma | undefined> {
  const snap = await getDoc(doc(khatmasCol, id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Khatma, 'id'>) } : undefined;
}

/**
 * Create a khatma together with one assignment doc per member, atomically in a
 * single batch. `assignments` is the output of `generateAssignments`
 * (memberId -> pagesByDay). The khatma starts `active`; every assignment starts
 * with no days done. Returns the new khatma id.
 */
export async function createKhatma(
  input: Omit<Khatma, 'id' | 'createdAt' | 'status'>,
  assignments: AssignmentResult,
): Promise<string> {
  const khatmaRef = doc(khatmasCol);
  const batch = writeBatch(db);

  // Build explicitly (never spread a possibly-undefined `name` — Firestore
  // rejects undefined field values).
  batch.set(khatmaRef, {
    ...(input.name ? { name: input.name } : {}),
    totalPages: input.totalPages,
    startDate: input.startDate,
    durationDays: input.durationDays,
    memberIds: input.memberIds,
    anonymous: input.anonymous,
    status: 'active',
    createdAt: Date.now(),
  });

  const col = assignmentsCol(khatmaRef.id);
  for (const [memberId, pagesByDay] of Object.entries(assignments)) {
    batch.set(doc(col, memberId), { memberId, pagesByDay: toStoredPages(pagesByDay), doneByDay: {} });
  }

  await batch.commit();
  return khatmaRef.id;
}

/** Update editable khatma fields (name, per-khatma anonymous toggle, status). */
export function updateKhatma(
  id: string,
  changes: Partial<Pick<Khatma, 'name' | 'anonymous' | 'status'>>,
): Promise<void> {
  return updateDoc(doc(khatmasCol, id), changes);
}

/**
 * Delete a khatma and all its assignment docs. Firestore has no cascade, so we
 * batch-delete the `assignments` subcollection first, then the khatma itself.
 */
export async function deleteKhatma(id: string): Promise<void> {
  const batch = writeBatch(db);
  const assignments = await getDocs(assignmentsCol(id));
  assignments.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(khatmasCol, id));
  await batch.commit();
}

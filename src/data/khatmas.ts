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
import { assignmentsCol, fromStored, toStoredPages, type StoredAssignment } from './assignments';
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
 * single batch. `assignments` is `planAssignments(...).assignments`
 * (memberId -> pagesByDay) — it already contains an entry for every member,
 * including disabled ones (all-empty days). The khatma starts `active` with its
 * `scope` and designated du3a reciter stored; every assignment starts with no
 * days done. Returns the new khatma id.
 */
export async function createKhatma(
  input: Omit<Khatma, 'id' | 'createdAt' | 'status' | 'completedAt'>,
  assignments: AssignmentResult,
): Promise<string> {
  const khatmaRef = doc(khatmasCol);
  const batch = writeBatch(db);

  // Build explicitly (never spread a possibly-undefined field — Firestore
  // rejects undefined field values).
  batch.set(khatmaRef, {
    ...(input.name ? { name: input.name } : {}),
    totalPages: input.totalPages,
    scope: input.scope,
    startDate: input.startDate,
    durationDays: input.durationDays,
    memberIds: input.memberIds,
    anonymous: input.anonymous,
    ...(input.duaReciterId ? { duaReciterId: input.duaReciterId } : {}),
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

/** Update editable khatma fields (name, anonymous toggle, status, du3a reciter). */
export function updateKhatma(
  id: string,
  changes: Partial<Pick<Khatma, 'name' | 'anonymous' | 'status' | 'duaReciterId'>>,
): Promise<void> {
  return updateDoc(doc(khatmasCol, id), changes);
}

/**
 * Mark a khatma completed (REQUIREMENTS §7, updated): flips status and stamps
 * `completedAt`, which moves it into the admin's "previous khatmas" log. The
 * du3a reciter was chosen at creation, so it is already recorded.
 */
export function completeKhatma(id: string): Promise<void> {
  return updateDoc(doc(khatmasCol, id), { status: 'completed', completedAt: Date.now() });
}

/**
 * Regenerate a khatma's assignments from `fromDay` onward (REQUIREMENTS §5+):
 * the admin's "Regenerate remaining days" action, used after disabling someone
 * or changing capacities. `windowByMember` is `planAssignments(...).assignments`
 * planned over the remaining days only. For each member we keep days
 * `[0..fromDay-1]` exactly as they are (history + done marks untouched) and
 * replace `[fromDay..end]` with the freshly-planned window.
 */
export async function replanRemainingDays(
  khatmaId: string,
  fromDay: number,
  windowByMember: AssignmentResult,
): Promise<void> {
  const snap = await getDocs(assignmentsCol(khatmaId));
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    const current = fromStored(d.data() as StoredAssignment);
    const window = windowByMember[current.memberId];
    if (!window) continue;
    const prefix = current.pagesByDay.slice(0, fromDay);
    batch.update(d.ref, { pagesByDay: toStoredPages([...prefix, ...window]) });
  }
  await batch.commit();
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

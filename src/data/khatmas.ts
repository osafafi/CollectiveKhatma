import {
  arrayUnion,
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
import type { Khatma } from '@/domain/types';
import { assignmentsCol, emptyAssignment } from './assignments';
import { db } from './firebase';

/** Firestore collection handle for khatmas. */
export const khatmasCol: CollectionReference = collection(db, 'khatmas');

/** Live-subscribe to all khatmas, newest first (both apps subscribe to all). */
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

/** Everything the caller provides to create a khatma (the rest is stamped here). */
export type CreateKhatmaInput = Omit<
  Khatma,
  'id' | 'createdAt' | 'status' | 'completedAt' | 'roundCount' | 'lastDistributionDate'
>;

/**
 * Create a khatma together with one EMPTY assignment doc per member, atomically
 * in a single batch (REQUIREMENTS §5). Pages are handed out later by
 * distribution rounds, so assignments start with no chunks. `remainingPages`
 * must be the full resolved scope pool (`resolvePageScope(scope)`). For a new
 * series mint `seriesId` with `crypto.randomUUID()` and use `seriesNumber: 1`;
 * to continue a series pass the existing `seriesId` and the next number.
 * Returns the new khatma id.
 */
export async function createKhatma(input: CreateKhatmaInput): Promise<string> {
  const khatmaRef = doc(khatmasCol);
  const batch = writeBatch(db);

  // Build explicitly (never spread a possibly-undefined field — Firestore
  // rejects undefined field values).
  batch.set(khatmaRef, {
    seriesId: input.seriesId,
    seriesName: input.seriesName,
    seriesNumber: input.seriesNumber,
    totalPages: input.totalPages,
    scope: input.scope,
    memberIds: input.memberIds,
    anonymous: input.anonymous,
    remainingPages: input.remainingPages,
    roundCount: 0,
    ...(input.duaReciterId ? { duaReciterId: input.duaReciterId } : {}),
    status: 'active',
    createdAt: Date.now(),
  });

  const col = assignmentsCol(khatmaRef.id);
  for (const memberId of input.memberIds) {
    batch.set(doc(col, memberId), emptyAssignment(memberId));
  }

  await batch.commit();
  return khatmaRef.id;
}

/** Update editable khatma fields (anonymous toggle, status, du3a reciter). */
export function updateKhatma(
  id: string,
  changes: Partial<Pick<Khatma, 'anonymous' | 'status' | 'duaReciterId'>>,
): Promise<void> {
  return updateDoc(doc(khatmasCol, id), changes);
}

/**
 * Manually mark a khatma completed (REQUIREMENTS §7) — the admin's backstop;
 * distribution normally flips this automatically once every page is read.
 */
export function completeKhatma(id: string): Promise<void> {
  return updateDoc(doc(khatmasCol, id), { status: 'completed', completedAt: Date.now() });
}

/**
 * Add a roster member to a running khatma (REQUIREMENTS §5): joins the member
 * list and creates their empty assignment doc — they get their first chunk at
 * the next distribution, with no warning penalty.
 */
export async function addMemberToKhatma(khatmaId: string, memberId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(khatmasCol, khatmaId), { memberIds: arrayUnion(memberId) });
  batch.set(doc(assignmentsCol(khatmaId), memberId), emptyAssignment(memberId), { merge: true });
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

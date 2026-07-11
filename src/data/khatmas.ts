import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { releaseChunk } from '@/domain/distribution';
import type { Khatma, MemberCapacity } from '@/domain/types';
import { assignmentDoc, assignmentsCol, emptyAssignment, fromStored, type StoredAssignment } from './assignments';
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

/**
 * Everything the caller provides to create a khatma (the rest is stamped here).
 * `createdAt` is optional — pass it to backfill a series' real start date
 * (REQUIREMENTS §8); omit it to stamp "now".
 */
export type CreateKhatmaInput = Omit<
  Khatma,
  'id' | 'createdAt' | 'status' | 'completedAt' | 'roundCount' | 'lastDistributionDate'
> & { createdAt?: number };

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
    ...(input.capacities ? { capacities: input.capacities } : {}),
    status: 'active',
    createdAt: input.createdAt ?? Date.now(),
  });

  const col = assignmentsCol(khatmaRef.id);
  for (const memberId of input.memberIds) {
    batch.set(doc(col, memberId), emptyAssignment(memberId));
  }

  await batch.commit();
  return khatmaRef.id;
}

/**
 * Update editable khatma fields (REQUIREMENTS §8): anonymity, status, du3a
 * reciter, and the admin-editable series metadata — name, number, creation
 * date, and per-member capacities. To rename a whole series use
 * {@link renameSeries} (this only touches one khatma doc).
 */
export function updateKhatma(
  id: string,
  changes: Partial<
    Pick<
      Khatma,
      'anonymous' | 'status' | 'duaReciterId' | 'seriesName' | 'seriesNumber' | 'createdAt' | 'capacities'
    >
  >,
): Promise<void> {
  return updateDoc(doc(khatmasCol, id), changes);
}

/**
 * Rename a whole series: set `seriesName` on every khatma sharing `seriesId`
 * (REQUIREMENTS §8). Keeps `findSeriesByName` and the displayed titles correct —
 * renaming a single khatma would split the series.
 */
export async function renameSeries(seriesId: string, newName: string): Promise<void> {
  const snap = await getDocs(query(khatmasCol, where('seriesId', '==', seriesId)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { seriesName: newName }));
  await batch.commit();
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
 * list, optionally records their per-khatma capacity, and creates their empty
 * assignment doc — they get their first chunk at the next distribution, with no
 * warning penalty.
 */
export async function addMemberToKhatma(
  khatmaId: string,
  memberId: string,
  capacity?: MemberCapacity,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(khatmasCol, khatmaId), {
    memberIds: arrayUnion(memberId),
    ...(capacity ? { [`capacities.${memberId}`]: capacity } : {}),
  });
  batch.set(doc(assignmentsCol(khatmaId), memberId), emptyAssignment(memberId), { merge: true });
  await batch.commit();
}

/**
 * Return a member's unread pages to the pool at the admin's discretion
 * (REQUIREMENTS §5) — the manual replacement for the old automatic reclaim.
 * Marks their pending chunk `released`, merges its pages back into
 * `remainingPages`, and resets their streak, in one transaction.
 */
export async function releaseMemberChunk(khatmaId: string, memberId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const kRef = doc(khatmasCol, khatmaId);
    const aRef = assignmentDoc(khatmaId, memberId);
    const kSnap = await tx.get(kRef);
    const aSnap = await tx.get(aRef);
    if (!kSnap.exists() || !aSnap.exists()) return;
    const khatma = kSnap.data() as Omit<Khatma, 'id'>;
    const assignment = fromStored(aSnap.data() as StoredAssignment);
    const release = releaseChunk(assignment, khatma.remainingPages);
    if (!release) return;
    const rounds = assignment.rounds.map((c) =>
      c.round === release.round ? { ...c, released: true as const } : c,
    );
    tx.update(kRef, { remainingPages: release.remainingPages });
    tx.set(aRef, { ...assignment, rounds, missedStreak: release.missedStreak });
  });
}

/**
 * Remove a member from a khatma at any time (REQUIREMENTS §8): returns their
 * outstanding (non-released) pages to the pool so no page is orphaned
 * (invariant #1), drops them from `memberIds` and `capacities`, and deletes
 * their assignment doc — all in one transaction. Any pages they had already
 * read return to the pool to be re-read, the only invariant-safe removal.
 */
export async function removeMemberFromKhatma(khatmaId: string, memberId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const kRef = doc(khatmasCol, khatmaId);
    const aRef = assignmentDoc(khatmaId, memberId);
    const kSnap = await tx.get(kRef);
    const aSnap = await tx.get(aRef);
    if (!kSnap.exists()) return;
    const khatma = kSnap.data() as Omit<Khatma, 'id'>;
    let held: number[] = [];
    if (aSnap.exists()) {
      const assignment = fromStored(aSnap.data() as StoredAssignment);
      for (const c of assignment.rounds) {
        if (c.released !== true) held = held.concat(c.pages);
      }
    }
    const remainingPages = [...khatma.remainingPages, ...held].sort((a, b) => a - b);
    const memberIds = khatma.memberIds.filter((id) => id !== memberId);
    const capacities = { ...(khatma.capacities ?? {}) };
    delete capacities[memberId];
    tx.update(kRef, { remainingPages, memberIds, capacities });
    if (aSnap.exists()) tx.delete(aRef);
  });
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

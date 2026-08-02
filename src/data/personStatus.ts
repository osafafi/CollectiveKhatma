import {
  arrayUnion,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { releaseChunk } from '@/domain/distribution';
import type { Assignment, Khatma, MemberCapacity } from '@/domain/types';
import { assignmentDoc, emptyAssignment } from './assignments';
import { db } from './firebase';
import { khatmasCol } from './khatmas';
import { rosterCol } from './roster';

/**
 * Pause a member from their own app and return every pending chunk they hold to
 * its khatma pool. The roster flag, released chunks, and pools commit together.
 */
export async function disableSelfAndReleasePages(memberId: string): Promise<void> {
  const candidateKhatmas = await getDocs(
    query(khatmasCol, where('memberIds', 'array-contains', memberId)),
  );

  await runTransaction(db, async (tx) => {
    const targets = await Promise.all(
      candidateKhatmas.docs.map(async (candidate) => {
        const khatmaRef = doc(khatmasCol, candidate.id);
        const assignmentRef = assignmentDoc(candidate.id, memberId);
        const [khatmaSnap, assignmentSnap] = await Promise.all([
          tx.get(khatmaRef),
          tx.get(assignmentRef),
        ]);
        return { khatmaRef, assignmentRef, khatmaSnap, assignmentSnap };
      }),
    );

    tx.update(doc(rosterCol, memberId), { enabled: false });

    for (const target of targets) {
      if (!target.khatmaSnap.exists() || !target.assignmentSnap.exists()) continue;
      const khatma = target.khatmaSnap.data() as Omit<Khatma, 'id'>;
      if (khatma.status !== 'active') continue;
      const assignment = target.assignmentSnap.data() as Assignment;
      const release = releaseChunk(assignment, khatma.remainingPages);
      if (!release) continue;
      const rounds = assignment.rounds.map((chunk) =>
        chunk.round === release.round ? { ...chunk, released: true as const } : chunk,
      );
      tx.update(target.khatmaRef, { remainingPages: release.remainingPages });
      tx.set(target.assignmentRef, {
        ...assignment,
        rounds,
        missedStreak: release.missedStreak,
      });
    }
  });
}

/** Enable a paused roster member and add them to one khatma in a single batch. */
export async function activatePersonInKhatma(
  khatmaId: string,
  memberId: string,
  capacity: MemberCapacity,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(rosterCol, memberId), { enabled: true });
  batch.update(doc(khatmasCol, khatmaId), {
    memberIds: arrayUnion(memberId),
    [`capacities.${memberId}`]: capacity,
  });
  batch.set(assignmentDoc(khatmaId, memberId), emptyAssignment(memberId), {
    merge: true,
  });
  await batch.commit();
}

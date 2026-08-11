import { doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { releaseChunk } from '@/domain/distribution';
import { isChunkCompleted, isChunkReleased } from '@/domain/chunkStatus';
import type { Assignment, Khatma } from '@/domain/types';
import { assignmentDoc } from './assignments';
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
      const releasedAt = Date.now();
      const rounds = assignment.rounds.map((chunk) =>
        release.rounds.includes(chunk.round) &&
        !isChunkReleased(chunk) &&
        !isChunkCompleted(assignment, chunk)
          ? {
              ...chunk,
              status: 'released' as const,
              released: true as const,
              releasedAt,
              releaseReason: 'member-paused',
            }
          : chunk,
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

import { useEffect, useMemo } from 'react';
import { useWriteOperation } from '@/app/operations';
import {
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  selectRosterListener,
  useAppSelector,
} from '@/app/store';

/** Reconcile legacy khatma member ids after both global snapshots are complete. */
export function AdminGhostMemberCleanup() {
  const roster = useAppSelector(selectRoster);
  const rosterListener = useAppSelector(selectRosterListener);
  const khatmas = useAppSelector(selectKhatmas);
  const khatmasListener = useAppSelector(selectKhatmasListener);
  const { execute: removeMemberFromKhatma } = useWriteOperation('removeMemberFromKhatma');

  const ghosts = useMemo(() => {
    if (rosterListener.status !== 'ready' || khatmasListener.status !== 'ready') {
      return [];
    }
    const rosterIds = new Set(roster.map((person) => person.id));
    return khatmas.flatMap((khatma) =>
      khatma.memberIds
        .filter((memberId) => !rosterIds.has(memberId))
        .map((memberId) => ({ khatmaId: khatma.id, memberId })),
    );
  }, [khatmas, khatmasListener.status, roster, rosterListener.status]);

  useEffect(() => {
    for (const ghost of ghosts) {
      void removeMemberFromKhatma(ghost.khatmaId, ghost.memberId);
    }
  }, [ghosts, removeMemberFromKhatma]);

  return null;
}

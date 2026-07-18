import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  useAppSelector,
} from '@/app/store';
import { KhatmaLandingContent } from './khatma/KhatmaLandingContent';
import { LandingFeedback } from './khatma/LandingFeedback';
import { useMemberIdentity } from './memberIdentityContext';

/** Member `#/khatma/{id}` landing page and live-state boundary. */
export function KhatmaLandingPage({ khatmaId }: { khatmaId: string }) {
  const { memberId, member } = useMemberIdentity();
  const khatmas = useAppSelector(selectKhatmas);
  const khatmasListener = useAppSelector(selectKhatmasListener);
  const khatma = khatmas.find(
    (candidate) => candidate.id === khatmaId && candidate.memberIds.includes(memberId),
  );
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma?.id ?? khatmaId),
  );
  const assignmentsListener = useAppSelector((state) =>
    selectAssignmentsListener(state, khatma?.id ?? khatmaId),
  );
  const roster = useAppSelector(selectRoster);

  if (khatmasListener.status === 'error') {
    return <LandingFeedback kind="error" />;
  }

  // Exact baseline behavior: an empty khatma collection is treated as loading,
  // including before the first listener snapshot.
  if (khatmas.length === 0) {
    return <LandingFeedback kind="loading" />;
  }

  if (!khatma) {
    return <LandingFeedback kind="not-found" />;
  }

  if (assignmentsListener?.status === 'error') {
    return <LandingFeedback kind="error" />;
  }

  return (
    <KhatmaLandingContent
      khatma={khatma}
      allKhatmas={khatmas}
      assignments={assignments}
      roster={roster}
      memberId={memberId}
      paused={member ? !member.enabled : false}
    />
  );
}

import { shallowEqual } from 'react-redux';
import { selectKhatmas, useAppSelector, useAssignmentsSubscription } from '@/app/store';
import { useMemberIdentity } from './memberIdentityContext';

/**
 * Keep exactly the selected member's active-khatma assignment listeners alive.
 * This sits in the persistent member experience so routes do not restart them.
 */
export function MemberAssignmentsSubscriptions() {
  const { memberId } = useMemberIdentity();
  const khatmaIds = useAppSelector(
    (state) =>
      selectKhatmas(state)
        .filter(
          (khatma) => khatma.status === 'active' && khatma.memberIds.includes(memberId),
        )
        .map((khatma) => khatma.id),
    shallowEqual,
  );

  return khatmaIds.map((khatmaId) => (
    <AssignmentSubscription key={khatmaId} khatmaId={khatmaId} />
  ));
}

function AssignmentSubscription({ khatmaId }: { khatmaId: string }) {
  useAssignmentsSubscription(khatmaId);
  return null;
}

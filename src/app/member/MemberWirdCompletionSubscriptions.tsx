import { shallowEqual } from 'react-redux';
import {
  selectKhatmas,
  useAppSelector,
  useWirdCompletionsSubscription,
} from '@/app/store';
import { isWird } from '@/domain/wird';
import { useMemberIdentity } from './memberIdentityContext';

/** Keep the selected member's active daily Wird state live across all routes. */
export function MemberWirdCompletionSubscriptions() {
  const { memberId } = useMemberIdentity();
  const ids = useAppSelector(
    (state) =>
      selectKhatmas(state)
        .filter(
          (series) =>
            isWird(series) &&
            series.status === 'active' &&
            series.memberIds.includes(memberId),
        )
        .map((series) => series.id),
    shallowEqual,
  );
  return ids.map((id) => <WirdSubscription key={id} id={id} />);
}

function WirdSubscription({ id }: { id: string }) {
  useWirdCompletionsSubscription(id);
  return null;
}

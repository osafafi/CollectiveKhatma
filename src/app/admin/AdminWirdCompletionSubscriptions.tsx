import { shallowEqual } from 'react-redux';
import {
  selectKhatmas,
  useAppSelector,
  useWirdCompletionsSubscription,
} from '@/app/store';
import { useAdminRoute } from '@/app/routing/hooks';
import { isWird } from '@/domain/wird';

/** Active Wird counters plus the open archived detail retain their completion logs. */
export function AdminWirdCompletionSubscriptions() {
  const route = useAdminRoute();
  const openId = route.name === 'khatma' ? route.id : null;
  const ids = useAppSelector((state) => {
    const wirds = selectKhatmas(state).filter(isWird);
    const wanted = new Set(
      wirds.filter((wird) => wird.status === 'active').map((wird) => wird.id),
    );
    if (openId && wirds.some((wird) => wird.id === openId)) wanted.add(openId);
    return [...wanted];
  }, shallowEqual);
  return ids.map((id) => <WirdSubscription key={id} id={id} />);
}

function WirdSubscription({ id }: { id: string }) {
  useWirdCompletionsSubscription(id);
  return null;
}

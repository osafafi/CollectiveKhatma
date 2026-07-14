import { shallowEqual } from 'react-redux';
import { selectKhatmas, useAppSelector, useAssignmentsSubscription } from '@/app/store';
import { useAdminRoute } from '@/app/routing/hooks';

/**
 * Keep the admin's dynamic assignment listeners alive for exactly the set the
 * dashboard and detail page need — the React twin of the legacy
 * `reconcileAssignmentSubs` ([`src/ui/admin/render.ts`](../../ui/admin/render.ts)):
 * **every active khatma** (Home + Khatmas need them) **plus** the khatma open on
 * the detail route, which may itself be completed (inventory §1.4 / P9).
 *
 * Sits in the persistent admin experience so navigating between routes does not
 * restart listeners; when a khatma leaves this set the reference-counted bridge
 * releases the listener and drops its slice (P10, proven in RM-240).
 */
export function AdminAssignmentsSubscriptions() {
  const route = useAdminRoute();
  const openId = route.name === 'khatma' ? route.id : null;

  const khatmaIds = useAppSelector((state) => {
    const khatmas = selectKhatmas(state);
    const wanted = new Set(
      khatmas.filter((khatma) => khatma.status === 'active').map((khatma) => khatma.id),
    );
    // The open detail khatma is subscribed even when completed — but only once it
    // actually exists, matching the legacy guard.
    if (openId && khatmas.some((khatma) => khatma.id === openId)) wanted.add(openId);
    return [...wanted];
  }, shallowEqual);

  return khatmaIds.map((khatmaId) => (
    <AssignmentSubscription key={khatmaId} khatmaId={khatmaId} />
  ));
}

function AssignmentSubscription({ khatmaId }: { khatmaId: string }) {
  useAssignmentsSubscription(khatmaId);
  return null;
}

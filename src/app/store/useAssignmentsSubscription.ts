import { useContext, useEffect } from 'react';
import { FirestoreSubscriptionContext } from './firestoreSubscriptionContext';

/** Retain one khatma's dynamic assignments listener for this component's life. */
export function useAssignmentsSubscription(khatmaId: string | null): void {
  const bridge = useContext(FirestoreSubscriptionContext);

  if (!bridge) {
    throw new Error('useAssignmentsSubscription must be used inside AppStoreProvider.');
  }

  useEffect(() => {
    if (khatmaId === null) return undefined;
    return bridge.retainAssignmentsSubscription(khatmaId);
  }, [bridge, khatmaId]);
}

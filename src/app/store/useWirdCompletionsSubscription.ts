import { useContext, useEffect } from 'react';
import { FirestoreSubscriptionContext } from './firestoreSubscriptionContext';

export function useWirdCompletionsSubscription(wirdId: string | null): void {
  const bridge = useContext(FirestoreSubscriptionContext);
  if (!bridge) {
    throw new Error(
      'useWirdCompletionsSubscription must be used inside AppStoreProvider.',
    );
  }
  useEffect(() => {
    if (wirdId === null) return undefined;
    return bridge.retainWirdCompletionsSubscription(wirdId);
  }, [bridge, wirdId]);
}

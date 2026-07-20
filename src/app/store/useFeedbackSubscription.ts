import { useContext, useEffect } from 'react';
import { FirestoreSubscriptionContext } from './firestoreSubscriptionContext';

/** Retain the feedback listener for the mounted admin experience only. */
export function useFeedbackSubscription(): void {
  const bridge = useContext(FirestoreSubscriptionContext);

  if (!bridge) {
    throw new Error('useFeedbackSubscription must be used inside AppStoreProvider.');
  }

  useEffect(() => bridge.retainFeedbackSubscription(), [bridge]);
}

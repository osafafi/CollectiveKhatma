import { subscribeAssignments } from '@/data/assignments';
import { subscribeGlobalContent } from '@/data/content';
import { subscribeKhatmas } from '@/data/khatmas';
import { subscribeRoster } from '@/data/roster';
import type { FirestoreSubscriptionSources } from './firestoreSubscriptionBridge';

/** Production data-boundary functions; tests inject deterministic substitutes. */
export const firestoreSubscriptionSources: FirestoreSubscriptionSources = {
  roster: subscribeRoster,
  content: subscribeGlobalContent,
  feedback: (onChange, onError) => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void import('@/data/feedbackSubscription')
      .then(({ subscribeFeedback }) => {
        if (!active) return;
        unsubscribe = subscribeFeedback(onChange, onError);
      })
      .catch((error: unknown) => {
        if (active) onError(error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  },
  khatmas: subscribeKhatmas,
  assignments: subscribeAssignments,
};

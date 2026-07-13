import { subscribeAssignments } from '@/data/assignments';
import { subscribeGlobalContent } from '@/data/content';
import { subscribeKhatmas } from '@/data/khatmas';
import { subscribeRoster } from '@/data/roster';
import type { FirestoreSubscriptionSources } from './firestoreSubscriptionBridge';

/** Production data-boundary functions; tests inject deterministic substitutes. */
export const firestoreSubscriptionSources: FirestoreSubscriptionSources = {
  roster: subscribeRoster,
  content: subscribeGlobalContent,
  khatmas: subscribeKhatmas,
  assignments: subscribeAssignments,
};

import { createContext } from 'react';
import type { FirestoreSubscriptionBridge } from './firestoreSubscriptionBridge';

export const FirestoreSubscriptionContext =
  createContext<FirestoreSubscriptionBridge | null>(null);

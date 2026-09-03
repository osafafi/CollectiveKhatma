import { useSyncExternalStore } from 'react';

/**
 * Whether the browser currently believes it can reach the network.
 *
 * `navigator.onLine` is a hint, not proof — it reports a network connection,
 * not a working internet — but it is the same signal the background mushaf
 * sweep already stands down on, and it is what the browser fires `online` and
 * `offline` events for. Used to say "you are offline, this is last-known data"
 * rather than to decide whether a read succeeds; Firestore's own cache answers
 * that question for itself.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

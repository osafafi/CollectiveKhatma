import {
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type FirestoreLocalCache,
} from 'firebase/firestore';

/**
 * Which local cache Firestore keeps its documents in.
 *
 * The persistent cache mirrors every document a listener has seen into
 * IndexedDB, so `onSnapshot` answers from disk when the network is gone — that
 * is what lets an offline member still see their roster, khatmas, and assigned
 * pages instead of an empty app. `persistentMultipleTabManager` is required
 * because this origin serves two entries (member and the hidden admin HTML),
 * which a member may have open at the same time; the single-tab manager would
 * make the second one fail to start.
 *
 * IndexedDB is not everywhere. It is absent in Node (the opt-in emulator smoke
 * test) and in some private-browsing modes and embedded webviews, and forcing
 * the persistent cache there stops the Firestore client from starting at all —
 * which would break the app online as well as off. Falling back to the
 * in-memory cache costs offline reading on those clients and nothing else.
 */
export function firestoreLocalCache(
  hasIndexedDb: boolean = typeof indexedDB !== 'undefined',
): FirestoreLocalCache {
  if (!hasIndexedDb) return memoryLocalCache();
  return persistentLocalCache({ tabManager: persistentMultipleTabManager() });
}

import { describe, expect, it } from 'vitest';
import { firestoreLocalCache } from '@/data/localCache';

describe('firestore local cache', () => {
  it('persists to IndexedDB when the browser has it', () => {
    // The whole point of Layer 3: without the persistent cache `onSnapshot`
    // has nothing to answer from offline, and the member app comes up empty.
    expect(firestoreLocalCache(true).kind).toBe('persistent');
  });

  it('falls back to memory where IndexedDB does not exist', () => {
    // Node (the emulator smoke test) and some private-browsing modes. Forcing
    // the persistent cache there stops the client starting at all.
    expect(firestoreLocalCache(false).kind).toBe('memory');
  });

  it('reads the current environment when no override is given', () => {
    // These tests run under the node project, so the default resolves to memory
    // rather than throwing on a missing global.
    expect(firestoreLocalCache().kind).toBe(
      typeof indexedDB === 'undefined' ? 'memory' : 'persistent',
    );
  });
});

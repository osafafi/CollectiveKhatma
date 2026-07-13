import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import {
  createAppStore,
  createFirestoreSubscriptionBridge,
  selectRoster,
  selectRosterListener,
  type FirestoreSubscriptionSources,
  type SubscriptionCleanup,
} from '@/app/store';
import { subscribeRoster, updatePerson } from '@/data/roster';

const runEmulatorSmoke = process.env.RUN_FIRESTORE_EMULATOR_SMOKE === 'true';
const emulatorDescribe = runEmulatorSmoke ? describe : describe.skip;

function immediateSource<Value>(value: Value) {
  return (onChange: (nextValue: Value) => void): SubscriptionCleanup => {
    onChange(value);
    return () => undefined;
  };
}

emulatorDescribe('Phase 2 Firestore emulator smoke', () => {
  it('streams initial, local-write, and remote snapshots through Redux', async () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();

    const adminApp = initializeApp(
      { projectId: 'collectivekhatma' },
      `rm260-${Date.now()}`,
    );
    const adminDb = getFirestore(adminApp);
    const personId = `rm260-person-${Date.now()}`;
    const personRef = adminDb.collection('roster').doc(personId);
    const appStore = createAppStore();
    const sources: FirestoreSubscriptionSources = {
      roster: subscribeRoster,
      content: immediateSource(undefined),
      khatmas: immediateSource([]),
      assignments: (_khatmaId, onChange) => immediateSource([])(onChange),
    };
    const bridge = createFirestoreSubscriptionBridge(appStore, sources);
    let releaseSubscriptions: SubscriptionCleanup | undefined;

    try {
      await personRef.set({
        name: 'RM-260 initial',
        completedPages: [],
        pagesPerDay: 2,
        enabled: true,
        createdAt: Date.now(),
      });

      releaseSubscriptions = bridge.startGlobalSubscriptions();
      await vi.waitFor(
        () => {
          expect(selectRosterListener(appStore.getState()).status).toBe('ready');
          expect(selectRoster(appStore.getState())).toEqual([
            expect.objectContaining({ id: personId, name: 'RM-260 initial' }),
          ]);
        },
        { timeout: 10_000, interval: 50 },
      );

      const localWrite = updatePerson(personId, { name: 'RM-260 local' });
      await vi.waitFor(
        () => {
          expect(selectRoster(appStore.getState())[0]?.name).toBe('RM-260 local');
        },
        { timeout: 10_000, interval: 50 },
      );
      await localWrite;

      await personRef.update({ name: 'RM-260 remote' });
      await vi.waitFor(
        () => {
          expect(selectRoster(appStore.getState())[0]?.name).toBe('RM-260 remote');
        },
        { timeout: 10_000, interval: 50 },
      );

      releaseSubscriptions();
      releaseSubscriptions = undefined;
      expect(selectRosterListener(appStore.getState()).status).toBe('idle');
    } finally {
      releaseSubscriptions?.();
      await personRef.delete();
      await deleteApp(adminApp);
    }
  }, 30_000);
});

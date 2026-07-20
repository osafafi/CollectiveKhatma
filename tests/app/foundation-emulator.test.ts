import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import {
  createAppStore,
  createFirestoreSubscriptionBridge,
  selectAssignmentByMemberId,
  selectAssignmentsListener,
  selectKhatmaById,
  selectKhatmasListener,
  selectPersonById,
  selectRosterListener,
  type AppStore,
  type FirestoreSubscriptionBridge,
  type SubscriptionCleanup,
} from '@/app/store';
import { selectFeedback } from '@/app/store/feedbackSelectors';
import { firestoreSubscriptionSources } from '@/app/store/firestoreSubscriptionSources';
import { markRoundDone } from '@/data/assignments';
import { runDistribution } from '@/data/distribution';
import { deleteFeedback, setFeedbackRead, submitFeedback } from '@/data/feedback';
import { createKhatma } from '@/data/khatmas';
import { addPerson, updatePerson } from '@/data/roster';

const runEmulatorSmoke = process.env.RUN_FIRESTORE_EMULATOR_SMOKE === 'true';
const emulatorDescribe = runEmulatorSmoke ? describe : describe.skip;

interface TestClient {
  store: AppStore;
  bridge: FirestoreSubscriptionBridge;
  releaseGlobal: SubscriptionCleanup;
  releaseAssignments?: SubscriptionCleanup;
  releaseFeedback?: SubscriptionCleanup;
}

function createClient(): TestClient {
  const store = createAppStore();
  const bridge = createFirestoreSubscriptionBridge(store, firestoreSubscriptionSources);
  return { store, bridge, releaseGlobal: bridge.startGlobalSubscriptions() };
}

function retainAssignments(client: TestClient, khatmaId: string): void {
  client.releaseAssignments = client.bridge.retainAssignmentsSubscription(khatmaId);
}

function retainFeedback(client: TestClient): void {
  client.releaseFeedback = client.bridge.retainFeedbackSubscription();
}

function releaseClient(client: TestClient): void {
  client.releaseFeedback?.();
  client.releaseFeedback = undefined;
  client.releaseAssignments?.();
  client.releaseAssignments = undefined;
  client.releaseGlobal();
}

async function expectGlobalState(
  client: TestClient,
  personId: string,
  khatmaId: string,
): Promise<void> {
  await vi.waitFor(
    () => {
      expect(selectRosterListener(client.store.getState()).status).toBe('ready');
      expect(selectKhatmasListener(client.store.getState()).status).toBe('ready');
      expect(selectPersonById(client.store.getState(), personId)?.name).toBe(
        'Emulator reader',
      );
      expect(selectKhatmaById(client.store.getState(), khatmaId)?.status).toBe('active');
    },
    { timeout: 10_000, interval: 50 },
  );
}

emulatorDescribe('Firestore emulator cross-client validation', () => {
  it('propagates writes, distribution, completion, reloads, and listener cleanup', async () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const adminApp = initializeApp({ projectId: 'collectivekhatma' }, `rm640-${suffix}`);
    const adminDb = getFirestore(adminApp);
    let personId: string | undefined;
    let khatmaId: string | undefined;
    const feedbackIds: string[] = [];
    const clients: TestClient[] = [];

    try {
      const adminClient = createClient();
      const memberClient = createClient();
      clients.push(adminClient, memberClient);

      personId = await addPerson({ name: 'Emulator reader', pagesPerDay: 2 });
      await vi.waitFor(
        () => {
          expect(selectPersonById(adminClient.store.getState(), personId!)).toBeDefined();
          expect(
            selectPersonById(memberClient.store.getState(), personId!),
          ).toBeDefined();
          expect(
            selectPersonById(adminClient.store.getState(), personId!)?.emoji,
          ).toBeUndefined();
        },
        { timeout: 10_000, interval: 50 },
      );

      await updatePerson(personId, { emoji: '📖' });
      await vi.waitFor(
        () => {
          expect(selectPersonById(adminClient.store.getState(), personId!)?.emoji).toBe(
            '📖',
          );
          expect(selectPersonById(memberClient.store.getState(), personId!)?.emoji).toBe(
            '📖',
          );
        },
        { timeout: 10_000, interval: 50 },
      );

      await updatePerson(personId, { emoji: undefined });
      await vi.waitFor(
        () => {
          expect(
            selectPersonById(adminClient.store.getState(), personId!)?.emoji,
          ).toBeUndefined();
          expect(
            selectPersonById(memberClient.store.getState(), personId!)?.emoji,
          ).toBeUndefined();
        },
        { timeout: 10_000, interval: 50 },
      );

      retainFeedback(adminClient);
      feedbackIds.push(
        await submitFeedback(personId, 'Emulator reader', 'First emulator feedback'),
        await submitFeedback(personId, 'Emulator reader', 'Second emulator feedback'),
      );
      await vi.waitFor(
        () => {
          const feedback = selectFeedback(adminClient.store.getState());
          expect(feedback).toHaveLength(2);
          expect(feedback.every((item) => item.memberId === personId)).toBe(true);
          expect(feedback.every((item) => item.memberName === 'Emulator reader')).toBe(
            true,
          );
        },
        { timeout: 10_000, interval: 50 },
      );

      await setFeedbackRead(feedbackIds[0]!, true);
      await deleteFeedback(feedbackIds[1]!);
      await vi.waitFor(
        () => {
          expect(selectFeedback(adminClient.store.getState())).toEqual([
            expect.objectContaining({ id: feedbackIds[0], isRead: true }),
          ]);
        },
        { timeout: 10_000, interval: 50 },
      );

      khatmaId = await createKhatma({
        seriesId: `emulator-series-${suffix}`,
        seriesName: 'Emulator series',
        seriesNumber: 1,
        totalPages: 2,
        scope: { kind: 'range', fromPage: 1, toPage: 2 },
        memberIds: [personId],
        capacities: { [personId]: { pages: 2, surahs: 0, juz: 0 } },
        duaReciterId: personId,
        remainingPages: [1, 2],
      });
      retainAssignments(adminClient, khatmaId);
      retainAssignments(memberClient, khatmaId);

      await Promise.all([
        expectGlobalState(adminClient, personId, khatmaId),
        expectGlobalState(memberClient, personId, khatmaId),
      ]);
      await vi.waitFor(
        () => {
          expect(
            selectAssignmentsListener(adminClient.store.getState(), khatmaId!)?.status,
          ).toBe('ready');
          expect(
            selectAssignmentsListener(memberClient.store.getState(), khatmaId!)?.status,
          ).toBe('ready');
        },
        { timeout: 10_000, interval: 50 },
      );

      const distribution = await runDistribution({
        khatmaIds: [khatmaId],
        members: [
          {
            id: personId,
            capacity: { pages: 2, surahs: 0, juz: 0 },
            completedPages: [],
            enabled: true,
          },
        ],
        today: '2099-06-14',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Emulator series',
          seriesNumber: 2,
          totalPages: 2,
          scope: { kind: 'range', fromPage: 1, toPage: 2 },
          memberIds: [personId],
          capacities: { [personId]: { pages: 2, surahs: 0, juz: 0 } },
          duaReciterId: personId,
          pool: [1, 2],
        },
      });
      expect(distribution).toEqual({ completedKhatmaIds: [], chunkCount: 1 });

      await vi.waitFor(
        () => {
          for (const client of [adminClient, memberClient]) {
            expect(
              selectKhatmaById(client.store.getState(), khatmaId!)?.remainingPages,
            ).toEqual([]);
            expect(
              selectAssignmentByMemberId(client.store.getState(), khatmaId!, personId!)
                ?.rounds,
            ).toEqual([expect.objectContaining({ round: 1, pages: [1, 2] })]);
          }
        },
        { timeout: 10_000, interval: 50 },
      );

      await markRoundDone(khatmaId, personId, 1);
      await vi.waitFor(
        () => {
          for (const client of [adminClient, memberClient]) {
            expect(
              selectAssignmentByMemberId(client.store.getState(), khatmaId!, personId!)
                ?.doneByRound[1],
            ).toEqual(expect.any(Number));
            expect(
              selectPersonById(client.store.getState(), personId!)?.completedPages,
            ).toEqual([1, 2]);
          }
        },
        { timeout: 10_000, interval: 50 },
      );

      releaseClient(memberClient);
      expect(selectRosterListener(memberClient.store.getState()).status).toBe('idle');
      expect(
        selectAssignmentsListener(memberClient.store.getState(), khatmaId),
      ).toBeUndefined();

      const reloadedMemberClient = createClient();
      clients.push(reloadedMemberClient);
      retainAssignments(reloadedMemberClient, khatmaId);
      await expectGlobalState(reloadedMemberClient, personId, khatmaId);
      await vi.waitFor(
        () => {
          const restored = selectAssignmentByMemberId(
            reloadedMemberClient.store.getState(),
            khatmaId!,
            personId!,
          );
          expect(restored?.rounds).toHaveLength(1);
          expect(restored?.doneByRound[1]).toEqual(expect.any(Number));
        },
        { timeout: 10_000, interval: 50 },
      );

      const completion = await runDistribution({
        khatmaIds: [khatmaId],
        members: [
          {
            id: personId,
            capacity: { pages: 2, surahs: 0, juz: 0 },
            completedPages: [1, 2],
            enabled: false,
          },
        ],
        today: '2099-06-15',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Emulator series',
          seriesNumber: 2,
          totalPages: 2,
          scope: { kind: 'range', fromPage: 1, toPage: 2 },
          memberIds: [personId],
          capacities: { [personId]: { pages: 2, surahs: 0, juz: 0 } },
          duaReciterId: personId,
          pool: [1, 2],
        },
      });
      expect(completion).toEqual({
        completedKhatmaIds: [khatmaId],
        chunkCount: 0,
      });
      await vi.waitFor(
        () => {
          expect(selectKhatmaById(adminClient.store.getState(), khatmaId!)?.status).toBe(
            'completed',
          );
          expect(
            selectKhatmaById(reloadedMemberClient.store.getState(), khatmaId!)?.status,
          ).toBe('completed');
        },
        { timeout: 10_000, interval: 50 },
      );

      releaseClient(adminClient);
      const stoppedName = selectPersonById(adminClient.store.getState(), personId)?.name;
      await updatePerson(personId, { name: 'Emulator reader after cleanup' });
      await vi.waitFor(
        () => {
          expect(
            selectPersonById(reloadedMemberClient.store.getState(), personId!)?.name,
          ).toBe('Emulator reader after cleanup');
        },
        { timeout: 10_000, interval: 50 },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(selectRosterListener(adminClient.store.getState()).status).toBe('idle');
      expect(selectPersonById(adminClient.store.getState(), personId)?.name).toBe(
        stoppedName,
      );
    } finally {
      for (const client of clients.reverse()) releaseClient(client);
      if (khatmaId && personId) {
        await adminDb
          .collection('khatmas')
          .doc(khatmaId)
          .collection('assignments')
          .doc(personId)
          .delete();
      }
      if (khatmaId) await adminDb.collection('khatmas').doc(khatmaId).delete();
      if (personId) await adminDb.collection('roster').doc(personId).delete();
      for (const feedbackId of feedbackIds) {
        await adminDb
          .collection('content')
          .doc('feedback')
          .collection('messages')
          .doc(feedbackId)
          .delete();
      }
      await deleteApp(adminApp);
    }
  }, 60_000);
});

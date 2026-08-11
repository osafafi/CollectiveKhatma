import { deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
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
import { commitDistributionRun, runDistribution } from '@/data/distribution';
import { deleteFeedback, setFeedbackRead, submitFeedback } from '@/data/feedback';
import { createKhatma, FullQuranKhatmaRequiredError } from '@/data/khatmas';
import { disableSelfAndReleasePages } from '@/data/personStatus';
import { addPerson, updatePerson } from '@/data/roster';
import {
  buildDistributionDraft,
  defaultDistributionAdjustments,
} from '@/domain/distributionDraft';

const runEmulatorSmoke = process.env.RUN_FIRESTORE_EMULATOR_SMOKE === 'true';
const emulatorDescribe = runEmulatorSmoke ? describe : describe.skip;
const FULL_QURAN_PAGES = Array.from({ length: 604 }, (_, index) => index + 1);
const FULL_QURAN_CAPACITY = { pages: 602, surahs: 0, juz: 0 };

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
    let distributionRunId: string | undefined;
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

      // Production contains roster records created before lifetime page tracking.
      // The UI and transaction must see the same logical empty page history.
      await adminDb
        .collection('roster')
        .doc(personId)
        .update({ completedPages: FieldValue.delete() });
      await vi.waitFor(
        () => {
          expect(
            selectPersonById(adminClient.store.getState(), personId!)?.completedPages,
          ).toEqual([]);
        },
        { timeout: 10_000, interval: 50 },
      );

      await expect(
        createKhatma({
          seriesId: `partial-series-${suffix}`,
          seriesName: 'Partial khatma must be rejected',
          seriesNumber: 1,
          totalPages: 2,
          scope: { kind: 'range', fromPage: 1, toPage: 2 },
          memberIds: [personId],
          capacities: { [personId]: { pages: 2, surahs: 0, juz: 0 } },
          duaReciterId: personId,
          remainingPages: [1, 2],
        }),
      ).rejects.toBeInstanceOf(FullQuranKhatmaRequiredError);

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
        totalPages: 604,
        scope: { kind: 'full' },
        memberIds: [personId],
        capacities: { [personId]: FULL_QURAN_CAPACITY },
        duaReciterId: personId,
        remainingPages: FULL_QURAN_PAGES,
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

      const distributionMembers = [
        {
          id: personId,
          capacity: FULL_QURAN_CAPACITY,
          completedPages: [],
          enabled: true,
          holdPages: false,
        },
      ];
      const adjustments = defaultDistributionAdjustments();
      const preview = buildDistributionDraft({
        mode: 'new-round',
        khatmas: [
          {
            id: khatmaId,
            seriesNumber: 1,
            remainingPages: FULL_QURAN_PAGES,
            roundCount: 0,
            assignments: [
              { memberId: personId, rounds: [], doneByRound: {}, missedStreak: 0 },
            ],
          },
        ],
        members: distributionMembers,
        newKhatmaPool: FULL_QURAN_PAGES,
        // This metadata is intentionally stale. The plan stays in the current
        // khatma, so an unused rollover template must not block confirmation.
        newKhatmaSeriesNumber: 99,
        adjustments,
      });
      const distribution = await commitDistributionRun({
        khatmaIds: [khatmaId],
        mode: 'new-round',
        expectedSourceRevision: preview.sourceRevision,
        adjustments,
        today: '2099-06-14',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Unused stale rollover label',
          seriesNumber: 99,
          totalPages: 604,
          scope: { kind: 'full' },
          memberIds: [personId],
          capacities: { [personId]: FULL_QURAN_CAPACITY },
          duaReciterId: personId,
          pool: FULL_QURAN_PAGES,
        },
      });
      distributionRunId = distribution.runId;
      expect(distribution).toMatchObject({
        revision: 1,
        completedKhatmaIds: [],
        chunkCount: 1,
      });
      expect(distributionRunId).toEqual(expect.any(String));
      expect(
        (
          await adminDb.collection('distributionRuns').doc(distributionRunId!).get()
        ).data(),
      ).toMatchObject({
        status: 'open',
        number: 1,
        revision: 1,
        khatmaIds: [khatmaId],
      });

      await vi.waitFor(
        () => {
          for (const client of [adminClient, memberClient]) {
            expect(
              selectKhatmaById(client.store.getState(), khatmaId!)?.remainingPages,
            ).toEqual([]);
            expect(
              selectAssignmentByMemberId(client.store.getState(), khatmaId!, personId!)
                ?.rounds,
            ).toEqual([
              expect.objectContaining({
                runId: distributionRunId,
                status: 'pending',
                round: 1,
                pages: FULL_QURAN_PAGES,
              }),
            ]);
          }
        },
        { timeout: 10_000, interval: 50 },
      );

      const currentAssignment = selectAssignmentByMemberId(
        adminClient.store.getState(),
        khatmaId,
        personId,
      )!;
      const adjustmentPreview = buildDistributionDraft({
        mode: 'adjust-current',
        khatmas: [
          {
            id: khatmaId,
            seriesNumber: 1,
            remainingPages: [],
            roundCount: 1,
            assignments: [currentAssignment],
          },
        ],
        members: distributionMembers,
        newKhatmaPool: FULL_QURAN_PAGES,
        newKhatmaSeriesNumber: 2,
        adjustments,
      });
      const redistribution = await commitDistributionRun({
        khatmaIds: [khatmaId],
        mode: 'adjust-current',
        expectedSourceRevision: adjustmentPreview.sourceRevision,
        adjustments,
        today: '2099-06-14',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Emulator series',
          seriesNumber: 2,
          totalPages: 604,
          scope: { kind: 'full' },
          memberIds: [personId],
          capacities: { [personId]: FULL_QURAN_CAPACITY },
          duaReciterId: personId,
          pool: FULL_QURAN_PAGES,
        },
      });
      expect(redistribution).toMatchObject({
        runId: distributionRunId,
        revision: 2,
        completedKhatmaIds: [],
        chunkCount: 1,
        releaseCount: 1,
      });
      expect(
        (
          await adminDb.collection('distributionRuns').doc(distributionRunId!).get()
        ).data(),
      ).toMatchObject({
        status: 'open',
        number: 1,
        revision: 2,
        mode: 'adjust-current',
      });

      await vi.waitFor(
        () => {
          const state = adminClient.store.getState();
          expect(selectKhatmaById(state, khatmaId!)?.roundCount).toBe(1);
          expect(selectAssignmentByMemberId(state, khatmaId!, personId!)?.rounds).toEqual(
            [
              expect.objectContaining({
                runId: distributionRunId,
                status: 'released',
                round: 1,
                pages: [],
                released: true,
              }),
              expect.objectContaining({
                runId: distributionRunId,
                status: 'pending',
                round: 1,
                pages: FULL_QURAN_PAGES,
              }),
            ],
          );
        },
        { timeout: 10_000, interval: 50 },
      );

      // The stale-preview regression is now proven; restore the modern schema
      // before the remainder of this smoke exercises roster update rules.
      await adminDb.collection('roster').doc(personId).update({ completedPages: [] });
      await disableSelfAndReleasePages(personId);
      await vi.waitFor(
        () => {
          for (const client of [adminClient, memberClient]) {
            expect(selectPersonById(client.store.getState(), personId!)?.enabled).toBe(
              false,
            );
            expect(
              selectKhatmaById(client.store.getState(), khatmaId!)?.remainingPages,
            ).toEqual(FULL_QURAN_PAGES);
            expect(
              selectAssignmentByMemberId(client.store.getState(), khatmaId!, personId!)
                ?.rounds[1],
            ).toMatchObject({
              round: 1,
              pages: FULL_QURAN_PAGES,
              released: true,
            });
          }
        },
        { timeout: 10_000, interval: 50 },
      );

      await updatePerson(personId, { enabled: true });
      const reassignment = await runDistribution({
        khatmaIds: [khatmaId],
        members: [
          {
            id: personId,
            capacity: FULL_QURAN_CAPACITY,
            completedPages: [],
            enabled: true,
          },
        ],
        today: '2099-06-15',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Emulator series',
          seriesNumber: 2,
          totalPages: 604,
          scope: { kind: 'full' },
          memberIds: [personId],
          capacities: { [personId]: FULL_QURAN_CAPACITY },
          duaReciterId: personId,
          pool: FULL_QURAN_PAGES,
        },
      });
      expect(reassignment).toEqual({ completedKhatmaIds: [], chunkCount: 1 });
      await vi.waitFor(
        () => {
          expect(
            selectAssignmentByMemberId(adminClient.store.getState(), khatmaId!, personId!)
              ?.rounds,
          ).toEqual([
            expect.objectContaining({ round: 1, released: true }),
            expect.objectContaining({ round: 1, released: true }),
            expect.objectContaining({ round: 2, pages: FULL_QURAN_PAGES }),
          ]);
        },
        { timeout: 10_000, interval: 50 },
      );

      await adminDb
        .collection('khatmas')
        .doc(khatmaId)
        .collection('assignments')
        .doc(personId)
        .update({ missedStreak: 2 });
      await updatePerson(personId, { holdPages: true });
      await markRoundDone(khatmaId, personId, 2);
      await vi.waitFor(
        () => {
          for (const client of [adminClient, memberClient]) {
            const assignment = selectAssignmentByMemberId(
              client.store.getState(),
              khatmaId!,
              personId!,
            );
            expect(assignment?.doneByRound[2]).toEqual(expect.any(Number));
            expect(assignment?.missedStreak).toBe(0);
            expect(
              selectPersonById(client.store.getState(), personId!)?.completedPages,
            ).toEqual(FULL_QURAN_PAGES);
            expect(selectPersonById(client.store.getState(), personId!)?.holdPages).toBe(
              true,
            );
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
          expect(restored?.rounds).toHaveLength(3);
          expect(restored?.doneByRound[2]).toEqual(expect.any(Number));
        },
        { timeout: 10_000, interval: 50 },
      );

      const completion = await runDistribution({
        khatmaIds: [khatmaId],
        members: [
          {
            id: personId,
            capacity: FULL_QURAN_CAPACITY,
            completedPages: FULL_QURAN_PAGES,
            enabled: false,
          },
        ],
        today: '2099-06-16',
        rolloverSeed: {
          seriesId: `emulator-series-${suffix}`,
          seriesName: 'Emulator series',
          seriesNumber: 2,
          totalPages: 604,
          scope: { kind: 'full' },
          memberIds: [personId],
          capacities: { [personId]: FULL_QURAN_CAPACITY },
          duaReciterId: personId,
          pool: FULL_QURAN_PAGES,
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
      if (distributionRunId)
        await adminDb.collection('distributionRuns').doc(distributionRunId).delete();
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

  it('atomically creates a full-Quran rollover with its first pages assigned', async () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const adminApp = initializeApp({ projectId: 'collectivekhatma' }, `roll-${suffix}`);
    const adminDb = getFirestore(adminApp);
    const memberIds: string[] = [];
    let khatmaId: string | undefined;
    let rolloverKhatmaId: string | undefined;
    let runId: string | undefined;

    try {
      const finishingMemberId = await addPerson({
        name: `Rollover finisher ${suffix}`,
        pagesPerDay: 4,
      });
      const nextMemberId = await addPerson({
        name: `Rollover next reader ${suffix}`,
        pagesPerDay: 2,
      });
      memberIds.push(finishingMemberId, nextMemberId);
      const capacities = {
        [finishingMemberId]: { pages: 4, surahs: 0, juz: 0 },
        [nextMemberId]: { pages: 2, surahs: 0, juz: 0 },
      };

      khatmaId = await createKhatma({
        seriesId: `rollover-series-${suffix}`,
        seriesName: 'Emulator rollover series',
        seriesNumber: 1,
        totalPages: 604,
        scope: { kind: 'full' },
        memberIds,
        capacities,
        duaReciterId: finishingMemberId,
        remainingPages: FULL_QURAN_PAGES,
      });
      await adminDb
        .collection('khatmas')
        .doc(khatmaId)
        .update({
          remainingPages: [601, 602, 603, 604],
          roundCount: 46,
        });

      const members = [
        {
          id: finishingMemberId,
          capacity: capacities[finishingMemberId]!,
          completedPages: [],
          enabled: true,
          holdPages: false,
        },
        {
          id: nextMemberId,
          capacity: capacities[nextMemberId]!,
          completedPages: [],
          enabled: true,
          holdPages: false,
        },
      ];
      const adjustments = defaultDistributionAdjustments();
      const preview = buildDistributionDraft({
        mode: 'new-round',
        khatmas: [
          {
            id: khatmaId,
            seriesNumber: 1,
            remainingPages: [601, 602, 603, 604],
            roundCount: 46,
            assignments: memberIds.map((memberId) => ({
              memberId,
              rounds: [],
              doneByRound: {},
              missedStreak: 0,
            })),
          },
        ],
        members,
        newKhatmaPool: FULL_QURAN_PAGES,
        newKhatmaSeriesNumber: 2,
        adjustments,
      });
      expect(preview.plan.rollover).toBeDefined();

      const outcome = await commitDistributionRun({
        khatmaIds: [khatmaId],
        mode: 'new-round',
        expectedSourceRevision: preview.sourceRevision,
        adjustments,
        today: '2099-06-17',
        rolloverSeed: {
          seriesId: `rollover-series-${suffix}`,
          seriesName: 'Emulator rollover series',
          seriesNumber: 2,
          totalPages: 604,
          scope: { kind: 'full' },
          memberIds,
          capacities,
          duaReciterId: finishingMemberId,
          pool: FULL_QURAN_PAGES,
        },
      });
      rolloverKhatmaId = outcome.rolloverKhatmaId;
      runId = outcome.runId;

      expect(rolloverKhatmaId).toEqual(expect.any(String));
      const rollover = (
        await adminDb.collection('khatmas').doc(rolloverKhatmaId!).get()
      ).data();
      expect(rollover).toMatchObject({
        seriesNumber: 2,
        totalPages: 604,
        scope: { kind: 'full' },
        roundCount: 1,
      });
      expect(rollover?.remainingPages).toHaveLength(600);
    } finally {
      for (const id of [khatmaId, rolloverKhatmaId]) {
        if (!id) continue;
        for (const memberId of memberIds) {
          await adminDb
            .collection('khatmas')
            .doc(id)
            .collection('assignments')
            .doc(memberId)
            .delete();
        }
        await adminDb.collection('khatmas').doc(id).delete();
      }
      if (runId) await adminDb.collection('distributionRuns').doc(runId).delete();
      for (const memberId of memberIds) {
        await adminDb.collection('roster').doc(memberId).delete();
      }
      await deleteApp(adminApp);
    }
  }, 30_000);
});

import { describe, expect, it } from 'vitest';
import {
  createAppStore,
  createFirestoreSubscriptionBridge,
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectContent,
  selectContentListener,
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  selectRosterListener,
  type FirestoreSubscriptionSources,
  type SubscriptionCleanup,
} from '@/app/store';
import { selectFeedback, selectFeedbackListener } from '@/app/store/feedbackSelectors';
import type {
  Assignment,
  GlobalContent,
  Khatma,
  MemberFeedback,
  Person,
} from '@/domain/types';

interface TestSource<Value> {
  subscribe: (
    onChange: (value: Value) => void,
    onError: (error: unknown) => void,
  ) => SubscriptionCleanup;
  emit: (value: Value) => void;
  fail: (error: unknown) => void;
  starts: () => number;
  stops: () => number;
  active: () => number;
  maxActive: () => number;
}

function createTestSource<Value>(): TestSource<Value> {
  const listeners = new Set<{
    onChange: (value: Value) => void;
    onError: (error: unknown) => void;
  }>();
  let startCount = 0;
  let stopCount = 0;
  let maximumActive = 0;

  return {
    subscribe(onChange, onError) {
      const listener = { onChange, onError };
      listeners.add(listener);
      startCount += 1;
      maximumActive = Math.max(maximumActive, listeners.size);
      return () => {
        if (listeners.delete(listener)) stopCount += 1;
      };
    },
    emit(value) {
      for (const listener of listeners) listener.onChange(value);
    },
    fail(error) {
      for (const listener of listeners) listener.onError(error);
    },
    starts: () => startCount,
    stops: () => stopCount,
    active: () => listeners.size,
    maxActive: () => maximumActive,
  };
}

const person: Person = {
  id: 'person-1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

const khatma: Khatma = {
  id: 'khatma-1',
  seriesId: 'series-1',
  seriesName: 'Series',
  seriesNumber: 1,
  totalPages: 604,
  scope: { kind: 'full' },
  memberIds: [person.id],
  capacities: { [person.id]: { pages: 2, surahs: 0, juz: 0 } },
  duaReciterId: person.id,
  status: 'active',
  remainingPages: [1],
  roundCount: 0,
  createdAt: 2,
};

const assignment: Assignment = {
  memberId: person.id,
  rounds: [],
  doneByRound: {},
  missedStreak: 0,
};

const feedbackMessage: MemberFeedback = {
  id: 'feedback-1',
  memberId: person.id,
  memberName: person.name,
  message: 'A useful feedback message',
  isRead: false,
  createdAt: 3,
};

function createSources() {
  const roster = createTestSource<Person[]>();
  const content = createTestSource<GlobalContent | undefined>();
  const feedback = createTestSource<MemberFeedback[]>();
  const khatmas = createTestSource<Khatma[]>();
  const assignmentsByKhatma = new Map<string, TestSource<Assignment[]>>();

  const sources: FirestoreSubscriptionSources = {
    roster: roster.subscribe,
    content: content.subscribe,
    feedback: feedback.subscribe,
    khatmas: khatmas.subscribe,
    assignments(khatmaId, onChange, onError) {
      let source = assignmentsByKhatma.get(khatmaId);
      if (!source) {
        source = createTestSource<Assignment[]>();
        assignmentsByKhatma.set(khatmaId, source);
      }
      return source.subscribe(onChange, onError);
    },
  };

  return { sources, roster, content, feedback, khatmas, assignmentsByKhatma };
}

describe('Firestore subscription bridge', () => {
  it('dispatches global snapshots and errors while sharing one active listener', () => {
    const appStore = createAppStore();
    const test = createSources();
    const bridge = createFirestoreSubscriptionBridge(appStore, test.sources);

    const releaseFirst = bridge.startGlobalSubscriptions();
    const releaseSecond = bridge.startGlobalSubscriptions();

    expect([test.roster.starts(), test.content.starts(), test.khatmas.starts()]).toEqual([
      1, 1, 1,
    ]);
    expect(selectRosterListener(appStore.getState()).status).toBe('loading');

    test.roster.emit([person]);
    test.content.emit(undefined);
    test.khatmas.emit([khatma]);

    expect(selectRoster(appStore.getState())).toEqual([person]);
    expect(selectContent(appStore.getState())).toBeNull();
    expect(selectKhatmas(appStore.getState())).toEqual([khatma]);
    expect(selectKhatmasListener(appStore.getState()).status).toBe('ready');

    test.content.fail(new Error('permission denied'));
    expect(selectContentListener(appStore.getState())).toEqual({
      status: 'error',
      error: 'permission denied',
    });

    releaseFirst();
    expect(test.roster.active()).toBe(1);
    releaseSecond();
    releaseSecond();

    expect([test.roster.stops(), test.content.stops(), test.khatmas.stops()]).toEqual([
      1, 1, 1,
    ]);
    expect(selectRosterListener(appStore.getState()).status).toBe('idle');
    expect(selectContentListener(appStore.getState()).status).toBe('idle');
    expect(selectKhatmasListener(appStore.getState()).status).toBe('idle');
  });

  it('isolates, reference-counts, and removes dynamic assignment listeners', () => {
    const appStore = createAppStore();
    const test = createSources();
    const bridge = createFirestoreSubscriptionBridge(appStore, test.sources);

    const releaseFirst = bridge.retainAssignmentsSubscription(khatma.id);
    const releaseSecond = bridge.retainAssignmentsSubscription(khatma.id);
    const source = test.assignmentsByKhatma.get(khatma.id)!;

    expect(source.starts()).toBe(1);
    source.emit([assignment]);
    expect(selectAssignmentsForKhatma(appStore.getState(), khatma.id)).toEqual([
      assignment,
    ]);

    source.fail('assignments unavailable');
    expect(selectAssignmentsListener(appStore.getState(), khatma.id)).toEqual({
      status: 'error',
      error: 'assignments unavailable',
    });

    releaseFirst();
    expect(source.active()).toBe(1);
    releaseSecond();

    expect(source.stops()).toBe(1);
    expect(selectAssignmentsForKhatma(appStore.getState(), khatma.id)).toEqual([]);
    expect(selectAssignmentsListener(appStore.getState(), khatma.id)).toBeUndefined();
  });

  it('retains feedback only on demand and clears it after the final admin release', () => {
    const appStore = createAppStore();
    const test = createSources();
    const bridge = createFirestoreSubscriptionBridge(appStore, test.sources);

    expect(test.feedback.starts()).toBe(0);
    const releaseFirst = bridge.retainFeedbackSubscription();
    const releaseSecond = bridge.retainFeedbackSubscription();

    expect(test.feedback.starts()).toBe(1);
    test.feedback.emit([feedbackMessage]);
    expect(selectFeedback(appStore.getState())).toEqual([feedbackMessage]);
    expect(selectFeedbackListener(appStore.getState()).status).toBe('ready');

    releaseFirst();
    expect(test.feedback.active()).toBe(1);
    releaseSecond();

    expect(test.feedback.stops()).toBe(1);
    expect(selectFeedback(appStore.getState())).toEqual([]);
    expect(selectFeedbackListener(appStore.getState()).status).toBe('idle');
  });

  it('does not overlap listeners across Strict Mode-style setup/cleanup cycles', () => {
    const appStore = createAppStore();
    const test = createSources();
    const bridge = createFirestoreSubscriptionBridge(appStore, test.sources);

    bridge.startGlobalSubscriptions()();
    const finalCleanup = bridge.startGlobalSubscriptions();

    expect(test.roster.starts()).toBe(2);
    expect(test.roster.stops()).toBe(1);
    expect(test.roster.active()).toBe(1);
    expect(test.roster.maxActive()).toBe(1);

    finalCleanup();
    expect(test.roster.active()).toBe(0);
    expect(test.roster.stops()).toBe(2);
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WriteOperationsProvider,
  writeOperations,
  type WriteOperations,
} from '@/app/operations';
import { AppStoreProvider } from '@/app/providers/AppStoreProvider';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import { MemberRouteLink } from '@/app/routing/RouteLink';
import { useMemberRoute } from '@/app/routing/hooks';
import {
  createAppStore,
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectContent,
  selectContentListener,
  selectKhatmas,
  selectKhatmasListener,
  selectRoster,
  selectRosterListener,
  useAppSelector,
  useAssignmentsSubscription,
  type FirestoreSubscriptionSources,
  type SubscriptionCleanup,
} from '@/app/store';
import { useWriteOperation } from '@/app/operations';
import type { Assignment, GlobalContent, Khatma, Person } from '@/domain/types';

interface TestSource<Value> {
  subscribe: (
    onChange: (value: Value) => void,
    onError: (error: unknown) => void,
  ) => SubscriptionCleanup;
  emit: (value: Value) => void;
  fail: (error: unknown) => void;
  counts: () => { starts: number; stops: number; active: number };
}

function createTestSource<Value>(): TestSource<Value> {
  const listeners = new Set<{
    onChange: (value: Value) => void;
    onError: (error: unknown) => void;
  }>();
  let starts = 0;
  let stops = 0;

  return {
    subscribe(onChange, onError) {
      const listener = { onChange, onError };
      listeners.add(listener);
      starts += 1;
      return () => {
        if (listeners.delete(listener)) stops += 1;
      };
    },
    emit(value) {
      for (const listener of listeners) listener.onChange(value);
    },
    fail(error) {
      for (const listener of listeners) listener.onError(error);
    },
    counts: () => ({ starts, stops, active: listeners.size }),
  };
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

function createSources() {
  const roster = createTestSource<Person[]>();
  const content = createTestSource<GlobalContent | undefined>();
  const khatmas = createTestSource<Khatma[]>();
  const assignments = createTestSource<Assignment[]>();

  const sources: FirestoreSubscriptionSources = {
    roster: roster.subscribe,
    content: content.subscribe,
    khatmas: khatmas.subscribe,
    assignments: (_khatmaId, onChange, onError) =>
      assignments.subscribe(onChange, onError),
  };

  return { sources, roster, content, khatmas, assignments };
}

function FoundationProbe() {
  useAssignmentsSubscription(khatma.id);
  const route = useMemberRoute();
  const roster = useAppSelector(selectRoster);
  const rosterListener = useAppSelector(selectRosterListener);
  const content = useAppSelector(selectContent);
  const contentListener = useAppSelector(selectContentListener);
  const khatmas = useAppSelector(selectKhatmas);
  const khatmasListener = useAppSelector(selectKhatmasListener);
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatma.id),
  );
  const assignmentsListener = useAppSelector((state) =>
    selectAssignmentsListener(state, khatma.id),
  );
  const updatePerson = useWriteOperation('updatePerson');

  return (
    <main>
      <output data-testid="route">{route.name}</output>
      <MemberRouteLink to={{ name: 'settings' }}>Open settings</MemberRouteLink>
      <output data-testid="roster-value">{roster[0]?.name ?? 'none'}</output>
      <output data-testid="content-value">{content?.du3aText ?? 'none'}</output>
      <output data-testid="khatma-count">{khatmas.length}</output>
      <output data-testid="assignment-count">{assignments.length}</output>
      <output data-testid="listener-status">
        {[
          rosterListener.status,
          contentListener.status,
          khatmasListener.status,
          assignmentsListener?.status ?? 'missing',
        ].join('|')}
      </output>
      <output data-testid="write-status">{updatePerson.state.status}</output>
      {rosterListener.error ? <p role="alert">{rosterListener.error}</p> : null}
      <button
        type="button"
        onClick={() => void updatePerson.execute(person.id, { name: 'Amina local' })}
      >
        Rename locally
      </button>
    </main>
  );
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Phase 2 foundation behavior', () => {
  it('composes navigation, realtime state, local write feedback, errors, and cleanup', async () => {
    window.history.replaceState(null, '', '/#/khatmas');
    const user = userEvent.setup();
    const appStore = createAppStore();
    const test = createSources();
    const writePending = deferred<void>();
    const updatePerson = vi.fn<WriteOperations['updatePerson']>(() => {
      // Firestore listeners surface latency-compensated local writes before the
      // server promise settles; the bridge must render that snapshot normally.
      test.roster.emit([{ ...person, name: 'Amina local' }]);
      return writePending.promise;
    });
    const operations = { ...writeOperations, updatePerson };
    const foundation = (
      <AppStoreProvider appStore={appStore} sources={test.sources}>
        <WriteOperationsProvider operations={operations}>
          <AppHashRouter>
            <FoundationProbe />
          </AppHashRouter>
        </WriteOperationsProvider>
      </AppStoreProvider>
    );
    const rendered = render(foundation);

    expect(screen.getByTestId('listener-status')).toHaveTextContent(
      'loading|loading|loading|loading',
    );
    expect(test.roster.counts()).toEqual({ starts: 1, stops: 0, active: 1 });
    expect(test.assignments.counts()).toEqual({ starts: 1, stops: 0, active: 1 });

    act(() => {
      test.roster.emit([person]);
      test.content.emit({ du3aText: 'Initial prayer' });
      test.khatmas.emit([khatma]);
      test.assignments.emit([assignment]);
    });

    expect(screen.getByTestId('listener-status')).toHaveTextContent(
      'ready|ready|ready|ready',
    );
    expect(screen.getByTestId('roster-value')).toHaveTextContent('Amina');
    expect(screen.getByTestId('content-value')).toHaveTextContent('Initial prayer');
    expect(screen.getByTestId('khatma-count')).toHaveTextContent('1');
    expect(screen.getByTestId('assignment-count')).toHaveTextContent('1');

    act(() => {
      test.roster.emit([{ ...person, name: 'Amina remote' }]);
      test.content.emit({ du3aText: 'Remote prayer' });
    });
    expect(screen.getByTestId('roster-value')).toHaveTextContent('Amina remote');
    expect(screen.getByTestId('content-value')).toHaveTextContent('Remote prayer');

    await user.click(screen.getByRole('link', { name: 'Open settings' }));
    await waitFor(() => {
      expect(window.location.hash).toBe('#/settings');
      expect(screen.getByTestId('route')).toHaveTextContent('settings');
    });

    await user.click(screen.getByRole('button', { name: 'Rename locally' }));
    expect(updatePerson).toHaveBeenCalledWith(person.id, { name: 'Amina local' });
    expect(screen.getByTestId('roster-value')).toHaveTextContent('Amina local');
    expect(screen.getByTestId('write-status')).toHaveTextContent('pending');

    await act(async () => {
      test.roster.emit([{ ...person, name: 'Amina confirmed' }]);
      writePending.resolve();
      await writePending.promise;
    });
    expect(screen.getByTestId('roster-value')).toHaveTextContent('Amina confirmed');
    expect(screen.getByTestId('write-status')).toHaveTextContent('success');

    act(() => test.roster.fail(new Error('roster unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('roster unavailable');
    expect(screen.getByTestId('listener-status')).toHaveTextContent(
      'error|ready|ready|ready',
    );

    // A refresh-style rerender keeps one subscription set and current route.
    rendered.rerender(foundation);
    expect(test.roster.counts()).toEqual({ starts: 1, stops: 0, active: 1 });
    expect(test.assignments.counts()).toEqual({ starts: 1, stops: 0, active: 1 });
    expect(screen.getByTestId('route')).toHaveTextContent('settings');

    rendered.unmount();
    expect(test.roster.counts()).toEqual({ starts: 1, stops: 1, active: 0 });
    expect(test.content.counts()).toEqual({ starts: 1, stops: 1, active: 0 });
    expect(test.khatmas.counts()).toEqual({ starts: 1, stops: 1, active: 0 });
    expect(test.assignments.counts()).toEqual({ starts: 1, stops: 1, active: 0 });
    expect(selectRosterListener(appStore.getState()).status).toBe('idle');
    expect(selectAssignmentsListener(appStore.getState(), khatma.id)).toBeUndefined();
  });
});

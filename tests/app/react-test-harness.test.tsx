import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemberRouteLink } from '@/app/routing/RouteLink';
import { useMemberRoute } from '@/app/routing/hooks';
import {
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectContent,
  selectKhatmas,
  selectRoster,
  selectRosterListener,
  useAppSelector,
  useAssignmentsSubscription,
} from '@/app/store';
import type { Assignment, Khatma, Person } from '@/domain/types';
import { renderWithAppProviders } from '../support/reactTestHarness';

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

function HarnessProbe({ khatmaId = khatma.id }: { khatmaId?: string }) {
  useAssignmentsSubscription(khatmaId);
  const route = useMemberRoute();
  const roster = useAppSelector(selectRoster);
  const rosterListener = useAppSelector(selectRosterListener);
  const content = useAppSelector(selectContent);
  const khatmas = useAppSelector(selectKhatmas);
  const assignments = useAppSelector((state) =>
    selectAssignmentsForKhatma(state, khatmaId),
  );
  const assignmentsListener = useAppSelector((state) =>
    selectAssignmentsListener(state, khatmaId),
  );

  return (
    <main>
      <output data-testid="route">{route.name}</output>
      <output data-testid="roster">{roster[0]?.name ?? 'none'}</output>
      <output data-testid="content">{content?.du3aText ?? 'none'}</output>
      <output data-testid="khatmas">{khatmas.length}</output>
      <output data-testid="assignments">{assignments.length}</output>
      <output data-testid="statuses">
        {`${rosterListener.status}|${assignmentsListener?.status ?? 'missing'}`}
      </output>
      <MemberRouteLink to={{ name: 'settings' }}>Open settings</MemberRouteLink>
    </main>
  );
}

describe('shared React test harness', () => {
  it('renders seeded Redux data through the production MUI and router providers', async () => {
    const harness = renderWithAppProviders(<HarnessProbe />, {
      route: '/khatmas',
      data: {
        roster: [person],
        content: { du3aText: 'Test prayer' },
        khatmas: [khatma],
        assignments: { [khatma.id]: [assignment] },
      },
    });

    expect(screen.getByTestId('route')).toHaveTextContent('khatmas');
    expect(screen.getByTestId('roster')).toHaveTextContent('Amina');
    expect(screen.getByTestId('content')).toHaveTextContent('Test prayer');
    expect(screen.getByTestId('khatmas')).toHaveTextContent('1');
    expect(screen.getByTestId('assignments')).toHaveTextContent('1');
    expect(screen.getByTestId('statuses')).toHaveTextContent('ready|ready');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(selectRoster(harness.store.getState())).toEqual([person]);

    await harness.user.click(screen.getByRole('link', { name: 'Open settings' }));
    await waitFor(() => {
      expect(window.location.hash).toBe('#/settings');
      expect(screen.getByTestId('route')).toHaveTextContent('settings');
    });
  });

  it('publishes deterministic global and per-khatma updates and errors', () => {
    const harness = renderWithAppProviders(<HarnessProbe />);

    expect(screen.getByTestId('statuses')).toHaveTextContent('loading|loading');

    harness.subscriptions.roster.emit([person]);
    harness.subscriptions.content.emit({ du3aText: 'Published prayer' });
    harness.subscriptions.khatmas.emit([khatma]);
    harness.subscriptions.assignment(khatma.id).emit([assignment]);

    expect(screen.getByTestId('roster')).toHaveTextContent('Amina');
    expect(screen.getByTestId('content')).toHaveTextContent('Published prayer');
    expect(screen.getByTestId('khatmas')).toHaveTextContent('1');
    expect(screen.getByTestId('assignments')).toHaveTextContent('1');
    expect(screen.getByTestId('statuses')).toHaveTextContent('ready|ready');

    harness.subscriptions.roster.fail(new Error('roster unavailable'));
    expect(selectRosterListener(harness.store.getState())).toEqual({
      status: 'error',
      error: 'roster unavailable',
    });
  });

  it('cleans up listeners and isolates store, data, and route between renders', () => {
    const first = renderWithAppProviders(<HarnessProbe />, {
      route: '/settings',
      data: { roster: [person], assignments: { [khatma.id]: [assignment] } },
    });
    const firstStore = first.store;
    const firstSubscriptions = first.subscriptions;

    expect(firstSubscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });
    expect(firstSubscriptions.assignment(khatma.id).counts().active).toBe(1);

    first.rerender(<HarnessProbe />);
    expect(screen.getByTestId('route')).toHaveTextContent('settings');
    expect(firstSubscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });

    first.unmount();
    expect(firstSubscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 1,
      active: 0,
    });
    expect(firstSubscriptions.assignment(khatma.id).counts().active).toBe(0);

    const otherPerson = { ...person, id: 'person-2', name: 'Maryam' };
    const second = renderWithAppProviders(<HarnessProbe />, {
      route: '/quran',
      data: { roster: [otherPerson], assignments: { [khatma.id]: [] } },
    });

    expect(second.store).not.toBe(firstStore);
    expect(second.subscriptions).not.toBe(firstSubscriptions);
    expect(screen.getByTestId('route')).toHaveTextContent('quran');
    expect(screen.getByTestId('roster')).toHaveTextContent('Maryam');
    expect(selectRoster(second.store.getState())).toEqual([otherPerson]);
  });
});

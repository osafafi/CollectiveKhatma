import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assignmentsActions,
  contentActions,
  createAppStore,
  khatmasActions,
  rosterActions,
  selectAssignmentByMemberId,
  selectAssignmentsForKhatma,
  selectAssignmentsListener,
  selectContent,
  selectKhatmaById,
  selectKhatmas,
  selectPersonById,
  selectRoster,
  selectRosterListener,
  type AppDispatch,
  type RootState,
} from '@/app/store';
import type { Assignment, GlobalContent, Khatma, Person } from '@/domain/types';

const person: Person = {
  id: 'person-1',
  name: 'أمينة',
  completedPages: [1],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

const khatma: Khatma = {
  id: 'khatma-1',
  seriesId: 'series-1',
  seriesName: 'أهل القرآن',
  seriesNumber: 1,
  totalPages: 604,
  scope: { kind: 'full' },
  memberIds: [person.id],
  status: 'active',
  remainingPages: [2, 3],
  roundCount: 1,
  createdAt: 2,
};

const assignment: Assignment = {
  memberId: person.id,
  rounds: [{ round: 1, date: '2026-07-13', pages: [1] }],
  doneByRound: {},
  missedStreak: 0,
};

describe('Redux store foundation', () => {
  it('exposes typed state and starts every listener domain idle', () => {
    const appStore = createAppStore();
    const state = appStore.getState();

    expectTypeOf(state).toEqualTypeOf<RootState>();
    expectTypeOf(appStore.dispatch).toEqualTypeOf<AppDispatch>();
    expectTypeOf(selectPersonById(state, person.id)).toEqualTypeOf<Person | undefined>();
    expectTypeOf(selectKhatmaById(state, khatma.id)).toEqualTypeOf<Khatma | undefined>();
    expectTypeOf(selectContent(state)).toEqualTypeOf<GlobalContent | null>();

    expect(state).toEqual({
      roster: { ids: [], entities: {}, listener: { status: 'idle', error: null } },
      khatmas: { ids: [], entities: {}, listener: { status: 'idle', error: null } },
      assignments: { byKhatmaId: {} },
      content: { value: null, listener: { status: 'idle', error: null } },
    });
  });

  it('replaces normalized snapshots while selectors preserve source order', () => {
    const appStore = createAppStore();

    appStore.dispatch(rosterActions.rosterSubscriptionStarted());
    expect(selectRosterListener(appStore.getState())).toEqual({
      status: 'loading',
      error: null,
    });

    const secondPerson = { ...person, id: 'person-2', name: 'زينب' };
    appStore.dispatch(rosterActions.rosterSnapshotReceived([secondPerson, person]));
    appStore.dispatch(khatmasActions.khatmasSnapshotReceived([khatma]));
    appStore.dispatch(contentActions.contentSnapshotReceived({ du3aText: 'دعاء' }));

    expect(selectRoster(appStore.getState())).toEqual([secondPerson, person]);
    expect(selectPersonById(appStore.getState(), person.id)).toBe(person);
    expect(selectKhatmas(appStore.getState())).toEqual([khatma]);
    expect(selectKhatmaById(appStore.getState(), khatma.id)).toBe(khatma);
    expect(selectContent(appStore.getState())).toEqual({ du3aText: 'دعاء' });

    appStore.dispatch(rosterActions.rosterSnapshotReceived([person]));
    expect(selectPersonById(appStore.getState(), secondPerson.id)).toBeUndefined();
  });

  it('isolates assignment snapshots and lifecycle state by khatma', () => {
    const appStore = createAppStore();
    const otherKhatmaId = 'khatma-2';

    appStore.dispatch(
      assignmentsActions.assignmentsSnapshotReceived({
        khatmaId: khatma.id,
        assignments: [assignment],
      }),
    );
    appStore.dispatch(
      assignmentsActions.assignmentsSubscriptionFailed({
        khatmaId: otherKhatmaId,
        error: 'permission denied',
      }),
    );

    expect(selectAssignmentsForKhatma(appStore.getState(), khatma.id)).toEqual([
      assignment,
    ]);
    expect(selectAssignmentByMemberId(appStore.getState(), khatma.id, person.id)).toBe(
      assignment,
    );
    expect(selectAssignmentsListener(appStore.getState(), khatma.id)).toEqual({
      status: 'ready',
      error: null,
    });
    expect(selectAssignmentsForKhatma(appStore.getState(), otherKhatmaId)).toEqual([]);
    expect(selectAssignmentsListener(appStore.getState(), otherKhatmaId)).toEqual({
      status: 'error',
      error: 'permission denied',
    });

    appStore.dispatch(assignmentsActions.assignmentsRemoved({ khatmaId: khatma.id }));
    expect(selectAssignmentsForKhatma(appStore.getState(), khatma.id)).toEqual([]);
    expect(selectAssignmentsListener(appStore.getState(), khatma.id)).toBeUndefined();
  });

  it('keeps the complete store state JSON-serializable', () => {
    const appStore = createAppStore();
    appStore.dispatch(rosterActions.rosterSnapshotReceived([person]));
    appStore.dispatch(khatmasActions.khatmasSnapshotReceived([khatma]));
    appStore.dispatch(
      assignmentsActions.assignmentsSnapshotReceived({
        khatmaId: khatma.id,
        assignments: [assignment],
      }),
    );
    appStore.dispatch(contentActions.contentSnapshotReceived(null));

    const state = appStore.getState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

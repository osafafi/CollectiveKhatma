import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStoreProvider } from '@/app/providers/AppStoreProvider';
import {
  createAppStore,
  selectAssignmentsListener,
  selectRosterListener,
  type FirestoreSubscriptionSources,
  type SubscriptionCleanup,
  useAssignmentsSubscription,
} from '@/app/store';

function countingSubscription() {
  let starts = 0;
  let stops = 0;
  let active = 0;
  let maxActive = 0;

  return {
    subscribe: (): SubscriptionCleanup => {
      starts += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      return () => {
        stops += 1;
        active -= 1;
      };
    },
    counts: () => ({ starts, stops, active, maxActive }),
  };
}

function AssignmentConsumer() {
  useAssignmentsSubscription('khatma-1');
  return <div>child</div>;
}

describe('AppStoreProvider', () => {
  it('owns one active global listener set and cleans it after Strict Mode unmount', () => {
    const roster = countingSubscription();
    const content = countingSubscription();
    const khatmas = countingSubscription();
    const assignments = countingSubscription();
    const sources: FirestoreSubscriptionSources = {
      roster: roster.subscribe,
      content: content.subscribe,
      khatmas: khatmas.subscribe,
      assignments: assignments.subscribe,
    };
    const appStore = createAppStore();

    const rendered = render(
      <StrictMode>
        <AppStoreProvider appStore={appStore} sources={sources}>
          <AssignmentConsumer />
        </AppStoreProvider>
      </StrictMode>,
    );

    expect(roster.counts()).toEqual({ starts: 2, stops: 1, active: 1, maxActive: 1 });
    expect(content.counts()).toEqual({ starts: 2, stops: 1, active: 1, maxActive: 1 });
    expect(khatmas.counts()).toEqual({ starts: 2, stops: 1, active: 1, maxActive: 1 });
    expect(assignments.counts()).toEqual({
      starts: 2,
      stops: 1,
      active: 1,
      maxActive: 1,
    });
    expect(selectRosterListener(appStore.getState()).status).toBe('loading');
    expect(selectAssignmentsListener(appStore.getState(), 'khatma-1')?.status).toBe(
      'loading',
    );

    rendered.unmount();

    expect(roster.counts()).toEqual({ starts: 2, stops: 2, active: 0, maxActive: 1 });
    expect(content.counts()).toEqual({ starts: 2, stops: 2, active: 0, maxActive: 1 });
    expect(khatmas.counts()).toEqual({ starts: 2, stops: 2, active: 0, maxActive: 1 });
    expect(assignments.counts()).toEqual({
      starts: 2,
      stops: 2,
      active: 0,
      maxActive: 1,
    });
    expect(selectRosterListener(appStore.getState()).status).toBe('idle');
    expect(selectAssignmentsListener(appStore.getState(), 'khatma-1')).toBeUndefined();
  });
});

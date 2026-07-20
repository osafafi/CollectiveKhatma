import type { PropsWithChildren, ReactElement } from 'react';
import {
  act,
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WriteOperations } from '@/app/operations';
import { AppProviders } from '@/app/providers/AppProviders';
import {
  createAppStore,
  type AppStore,
  type FirestoreSubscriptionSources,
  type SubscriptionCleanup,
} from '@/app/store';
import type {
  Assignment,
  GlobalContent,
  Khatma,
  MemberFeedback,
  Person,
} from '@/domain/types';

export interface TestAppData {
  roster?: Person[];
  content?: GlobalContent | undefined;
  feedback?: MemberFeedback[];
  khatmas?: Khatma[];
  assignments?: Readonly<Record<string, Assignment[]>>;
}

export interface SubscriptionCounts {
  starts: number;
  stops: number;
  active: number;
}

export interface TestSubscriptionPublisher<Value> {
  emit: (value: Value) => void;
  fail: (error: unknown) => void;
  counts: () => SubscriptionCounts;
}

interface TestSubscriptionSource<Value> extends TestSubscriptionPublisher<Value> {
  subscribe: (
    onChange: (value: Value) => void,
    onError: (error: unknown) => void,
  ) => SubscriptionCleanup;
}

export interface TestFirestoreSubscriptions {
  sources: FirestoreSubscriptionSources;
  roster: TestSubscriptionPublisher<Person[]>;
  content: TestSubscriptionPublisher<GlobalContent | undefined>;
  feedback: TestSubscriptionPublisher<MemberFeedback[]>;
  khatmas: TestSubscriptionPublisher<Khatma[]>;
  assignment: (khatmaId: string) => TestSubscriptionPublisher<Assignment[]>;
}

export interface RenderWithAppProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Hash path with or without the leading `#` (defaults to `/`). */
  route?: string;
  /** Optional store override; a fresh app store is created by default. */
  store?: AppStore;
  /** Optional source override; otherwise fresh deterministic publishers are created. */
  subscriptions?: TestFirestoreSubscriptions;
  /** Synchronous snapshots emitted as each matching listener starts. */
  data?: TestAppData;
  /** Optional write-operation override passed through the production provider stack. */
  operations?: WriteOperations;
}

export interface RenderWithAppProvidersResult extends RenderResult {
  store: AppStore;
  subscriptions: TestFirestoreSubscriptions;
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Render through the production React provider composition with isolated test
 * state, deterministic Firestore publishers, RTL MUI, and hash routing.
 */
export function renderWithAppProviders(
  ui: ReactElement,
  options: RenderWithAppProvidersOptions = {},
): RenderWithAppProvidersResult {
  const {
    route = '/',
    store = createAppStore(),
    subscriptions = createTestFirestoreSubscriptions(options.data),
    operations,
    data: _data,
    ...renderOptions
  } = options;

  setHashRoute(route);
  const user = userEvent.setup();
  const Wrapper = ({ children }: PropsWithChildren) => (
    <AppProviders
      appStore={store}
      sources={subscriptions.sources}
      operations={operations}
    >
      {children}
    </AppProviders>
  );
  const rendered = render(ui, { ...renderOptions, wrapper: Wrapper });

  return { ...rendered, store, subscriptions, user };
}

/** Create one isolated set of controllable Firestore subscription sources. */
export function createTestFirestoreSubscriptions(
  data: TestAppData = {},
): TestFirestoreSubscriptions {
  const roster = createTestSubscriptionSource<Person[]>(
    hasOwn(data, 'roster') ? { value: data.roster! } : undefined,
  );
  const content = createTestSubscriptionSource<GlobalContent | undefined>(
    hasOwn(data, 'content') ? { value: data.content } : undefined,
  );
  const feedback = createTestSubscriptionSource<MemberFeedback[]>(
    hasOwn(data, 'feedback') ? { value: data.feedback! } : undefined,
  );
  const khatmas = createTestSubscriptionSource<Khatma[]>(
    hasOwn(data, 'khatmas') ? { value: data.khatmas! } : undefined,
  );
  const assignments = new Map<string, TestSubscriptionSource<Assignment[]>>();

  const assignment = (khatmaId: string): TestSubscriptionSource<Assignment[]> => {
    let source = assignments.get(khatmaId);
    if (!source) {
      const initial = hasOwn(data.assignments, khatmaId)
        ? { value: data.assignments![khatmaId]! }
        : undefined;
      source = createTestSubscriptionSource(initial);
      assignments.set(khatmaId, source);
    }
    return source;
  };

  const sources: FirestoreSubscriptionSources = {
    roster: roster.subscribe,
    content: content.subscribe,
    feedback: feedback.subscribe,
    khatmas: khatmas.subscribe,
    assignments: (khatmaId, onChange, onError) =>
      assignment(khatmaId).subscribe(onChange, onError),
  };

  return { sources, roster, content, feedback, khatmas, assignment };
}

function createTestSubscriptionSource<Value>(initial?: {
  value: Value;
}): TestSubscriptionSource<Value> {
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
      if (initial) onChange(initial.value);

      return () => {
        if (listeners.delete(listener)) stops += 1;
      };
    },
    emit(value) {
      act(() => {
        for (const listener of [...listeners]) listener.onChange(value);
      });
    },
    fail(error) {
      act(() => {
        for (const listener of [...listeners]) listener.onError(error);
      });
    },
    counts: () => ({ starts, stops, active: listeners.size }),
  };
}

function hasOwn(object: object | undefined, key: PropertyKey): boolean {
  return object !== undefined && Object.prototype.hasOwnProperty.call(object, key);
}

function setHashRoute(route: string): void {
  const path = route.startsWith('#')
    ? route
    : `#${route.startsWith('/') ? route : `/${route}`}`;
  window.history.replaceState(null, '', `/${path}`);
}

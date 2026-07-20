import type {
  Assignment,
  GlobalContent,
  Khatma,
  MemberFeedback,
  Person,
} from '@/domain/types';
import { assignmentsActions } from './assignmentsSlice';
import { contentActions } from './contentSlice';
import { feedbackActions } from './feedbackSlice';
import { khatmasActions } from './khatmasSlice';
import { rosterActions } from './rosterSlice';
import type { AppStore } from './store';

export type SubscriptionCleanup = () => void;

type SubscribeToValue<Value> = (
  onChange: (value: Value) => void,
  onError: (error: unknown) => void,
) => SubscriptionCleanup;

/** Data-boundary listener functions consumed by the Redux bridge. */
export interface FirestoreSubscriptionSources {
  roster: SubscribeToValue<Person[]>;
  content: SubscribeToValue<GlobalContent | undefined>;
  feedback: SubscribeToValue<MemberFeedback[]>;
  khatmas: SubscribeToValue<Khatma[]>;
  assignments: (
    khatmaId: string,
    onChange: (assignments: Assignment[]) => void,
    onError: (error: unknown) => void,
  ) => SubscriptionCleanup;
}

export interface FirestoreSubscriptionBridge {
  /** Retain the shared roster, global content, and khatma listeners. */
  startGlobalSubscriptions: () => SubscriptionCleanup;
  /** Retain the assignments listener for one khatma. */
  retainAssignmentsSubscription: (khatmaId: string) => SubscriptionCleanup;
  /** Retain the admin feedback inbox listener. */
  retainFeedbackSubscription: () => SubscriptionCleanup;
}

interface SharedSubscription {
  consumers: number;
  close: SubscriptionCleanup;
}

const NOOP: SubscriptionCleanup = () => undefined;

function once(cleanup: SubscriptionCleanup): SubscriptionCleanup {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    cleanup();
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return 'Unknown Firestore subscription error';
}

/**
 * Open one guarded listener. Late callbacks are ignored after cleanup, and the
 * stopped action is dispatched even if an underlying unsubscribe throws.
 */
function openSubscription<Value>(
  subscribe: SubscribeToValue<Value>,
  onStarted: () => void,
  onChange: (value: Value) => void,
  onError: (message: string) => void,
  onStopped: () => void,
): SubscriptionCleanup {
  let active = true;
  let unsubscribe = NOOP;

  onStarted();
  try {
    unsubscribe = subscribe(
      (value) => {
        if (active) onChange(value);
      },
      (error) => {
        if (active) onError(errorMessage(error));
      },
    );
  } catch (error) {
    onError(errorMessage(error));
  }

  return once(() => {
    active = false;
    try {
      unsubscribe();
    } finally {
      onStopped();
    }
  });
}

/**
 * Connect Firestore's callback subscriptions to one Redux store.
 *
 * Consumers receive idempotent release functions. Reference counting prevents
 * multiple mounted consumers from creating duplicate listeners, while the
 * guarded callbacks and final-release cleanup keep Strict Mode and Fast Refresh
 * setup/cleanup cycles safe.
 */
export function createFirestoreSubscriptionBridge(
  appStore: AppStore,
  sources: FirestoreSubscriptionSources,
): FirestoreSubscriptionBridge {
  const dispatch = appStore.dispatch;
  let globalConsumers = 0;
  let closeGlobalSubscriptions: SubscriptionCleanup[] = [];
  const assignmentSubscriptions = new Map<string, SharedSubscription>();
  let feedbackSubscription: SharedSubscription | null = null;

  function startGlobalSubscriptions(): SubscriptionCleanup {
    globalConsumers += 1;

    if (globalConsumers === 1) {
      closeGlobalSubscriptions = [
        openSubscription(
          sources.roster,
          () => dispatch(rosterActions.rosterSubscriptionStarted()),
          (people) => dispatch(rosterActions.rosterSnapshotReceived(people)),
          (error) => dispatch(rosterActions.rosterSubscriptionFailed(error)),
          () => dispatch(rosterActions.rosterSubscriptionStopped()),
        ),
        openSubscription(
          sources.content,
          () => dispatch(contentActions.contentSubscriptionStarted()),
          (content) => dispatch(contentActions.contentSnapshotReceived(content ?? null)),
          (error) => dispatch(contentActions.contentSubscriptionFailed(error)),
          () => dispatch(contentActions.contentSubscriptionStopped()),
        ),
        openSubscription(
          sources.khatmas,
          () => dispatch(khatmasActions.khatmasSubscriptionStarted()),
          (khatmas) => dispatch(khatmasActions.khatmasSnapshotReceived(khatmas)),
          (error) => dispatch(khatmasActions.khatmasSubscriptionFailed(error)),
          () => dispatch(khatmasActions.khatmasSubscriptionStopped()),
        ),
      ];
    }

    return once(() => {
      globalConsumers -= 1;
      if (globalConsumers !== 0) return;

      const subscriptions = closeGlobalSubscriptions;
      closeGlobalSubscriptions = [];
      let cleanupFailed = false;
      let cleanupError: unknown;
      for (const close of subscriptions.reverse()) {
        try {
          close();
        } catch (error) {
          if (!cleanupFailed) cleanupError = error;
          cleanupFailed = true;
        }
      }
      if (cleanupFailed) throw cleanupError;
    });
  }

  function retainAssignmentsSubscription(khatmaId: string): SubscriptionCleanup {
    const existing = assignmentSubscriptions.get(khatmaId);
    if (existing) {
      existing.consumers += 1;
      return createAssignmentRelease(khatmaId, existing);
    }

    const shared: SharedSubscription = {
      consumers: 1,
      close: openSubscription<Assignment[]>(
        (onChange, onError) => sources.assignments(khatmaId, onChange, onError),
        () => dispatch(assignmentsActions.assignmentsSubscriptionStarted({ khatmaId })),
        (assignments) =>
          dispatch(
            assignmentsActions.assignmentsSnapshotReceived({ khatmaId, assignments }),
          ),
        (error) =>
          dispatch(assignmentsActions.assignmentsSubscriptionFailed({ khatmaId, error })),
        () => dispatch(assignmentsActions.assignmentsSubscriptionStopped({ khatmaId })),
      ),
    };
    assignmentSubscriptions.set(khatmaId, shared);
    return createAssignmentRelease(khatmaId, shared);
  }

  function createAssignmentRelease(
    khatmaId: string,
    shared: SharedSubscription,
  ): SubscriptionCleanup {
    return once(() => {
      if (assignmentSubscriptions.get(khatmaId) !== shared) return;

      shared.consumers -= 1;
      if (shared.consumers !== 0) return;

      assignmentSubscriptions.delete(khatmaId);
      try {
        shared.close();
      } finally {
        dispatch(assignmentsActions.assignmentsRemoved({ khatmaId }));
      }
    });
  }

  function retainFeedbackSubscription(): SubscriptionCleanup {
    if (feedbackSubscription) {
      feedbackSubscription.consumers += 1;
      return createFeedbackRelease(feedbackSubscription);
    }

    const shared: SharedSubscription = {
      consumers: 1,
      close: openSubscription<MemberFeedback[]>(
        sources.feedback,
        () => dispatch(feedbackActions.feedbackSubscriptionStarted()),
        (feedback) => dispatch(feedbackActions.feedbackSnapshotReceived(feedback)),
        (error) => dispatch(feedbackActions.feedbackSubscriptionFailed(error)),
        () => dispatch(feedbackActions.feedbackSubscriptionStopped()),
      ),
    };
    feedbackSubscription = shared;
    return createFeedbackRelease(shared);
  }

  function createFeedbackRelease(shared: SharedSubscription): SubscriptionCleanup {
    return once(() => {
      if (feedbackSubscription !== shared) return;

      shared.consumers -= 1;
      if (shared.consumers !== 0) return;

      feedbackSubscription = null;
      shared.close();
    });
  }

  return {
    startGlobalSubscriptions,
    retainAssignmentsSubscription,
    retainFeedbackSubscription,
  };
}

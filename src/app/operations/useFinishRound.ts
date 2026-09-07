import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import {
  getQueuedFinishes,
  isFinishQueued,
  queueFinish,
  replayFinishQueue,
  REPLAY_TIMEOUT_MS,
  subscribeToFinishQueue,
} from './finishQueue';
import { useOperation } from './useOperation';
import { WriteOperationsContext } from './writeOperationsContext';

/**
 * How long a finish tap may sit before it is treated as unreachable and queued.
 *
 * `navigator.onLine` reports a network, not a working internet, so a member on
 * a connected-but-dead wifi passes the offline check and then waits on a
 * transaction that cannot complete. Queuing after the wait costs nothing when
 * the write does eventually land: `markRoundDone` is idempotent, so the replay
 * is a no-op.
 */
const UNREACHABLE_AFTER_MS = REPLAY_TIMEOUT_MS;

/**
 * How often a non-empty queue retries while the app is open.
 *
 * `online` fires only when the browser noticed the connection drop. It often
 * does not: a tap can be queued by the timeout above with `navigator.onLine`
 * still reporting true the whole time (seen against a killed emulator), and
 * then no event ever arrives to trigger a retry. Without this the member would
 * sit looking at "saved, waiting for a connection" until they relaunched the
 * app. The timer only runs while something is actually queued.
 */
const RETRY_INTERVAL_MS = 60_000;

export interface FinishRoundTarget {
  khatmaId: string;
  memberId: string;
  round: number;
  activeSeriesKhatmaIds: readonly string[];
  /** This tap landed or was durably queued. Never called by background replay. */
  onAccepted?: () => void;
}

export interface FinishRoundResult {
  /** Send the tap, or queue it if the write cannot reach Firestore. */
  run: () => void;
  /** The write is in flight. */
  isPending: boolean;
  /** The write landed this session. */
  isDone: boolean;
  /** The tap is saved on this device, waiting for a connection. */
  isQueued: boolean;
  /** A real failure — never set for a tap that was queued instead. */
  error: Error | null;
}

/**
 * One member's "I finished my pages" action, for one round.
 *
 * Offline the tap is kept on the device instead of thrown away, and the caller
 * renders `isQueued` rather than success: nothing has been saved to the group
 * yet, and saying otherwise would be a lie the member acts on.
 */
export function useFinishRound(target: FinishRoundTarget): FinishRoundResult {
  const { khatmaId, memberId, round, activeSeriesKhatmaIds, onAccepted } = target;
  const markDone = useWriteOperationRaw();
  const operation = useOperation(markDone);
  const queue = useFinishQueue();

  const { execute } = operation;
  const run = useCallback((): void => {
    const entry = { khatmaId, memberId, round, activeSeriesKhatmaIds };
    // Read at click time rather than subscribing: this is a decision made once,
    // per tap, and `src/app/operations` has no business depending on a hook
    // that belongs to the member feature.
    if (!isOnline()) {
      queueFinish(entry);
      onAccepted?.();
      return;
    }
    void Promise.race([
      execute(khatmaId, memberId, round, activeSeriesKhatmaIds),
      timeout(UNREACHABLE_AFTER_MS),
    ]).then((settled) => {
      if (settled === TIMED_OUT) {
        queueFinish(entry);
        onAccepted?.();
      } else if (settled.status === 'success') onAccepted?.();
    });
  }, [execute, khatmaId, memberId, round, activeSeriesKhatmaIds, onAccepted]);

  const isQueued = isFinishQueued(queue, khatmaId, memberId, round);

  return {
    run,
    // A queued tap has nothing in flight and nothing to apologise for, whatever
    // the underlying operation is still doing with its timed-out promise.
    isPending: operation.isPending && !isQueued,
    isDone: operation.state.status === 'success',
    isQueued,
    error: isQueued ? null : operation.state.error,
  };
}

/**
 * Drain the finish queue: once when the app starts, and again whenever the
 * connection comes back. Mounted once, high in the member tree, so a tap saved
 * on one screen still lands when the member is somewhere else entirely.
 */
export function useFinishQueueReplay(): void {
  const markDone = useWriteOperationRaw();
  const hasQueued = useFinishQueue().length > 0;

  useEffect(() => {
    let cancelled = false;
    const replay = (): void => {
      if (cancelled || !isOnline()) return;
      void replayFinishQueue(markDone);
    };
    const replayWhenVisible = (): void => {
      if (document.visibilityState === 'visible') replay();
    };

    replay();
    window.addEventListener('online', replay);
    // Coming back to a backgrounded phone app is the other moment a connection
    // has quietly returned.
    document.addEventListener('visibilitychange', replayWhenVisible);
    const timer = hasQueued ? setInterval(replay, RETRY_INTERVAL_MS) : undefined;

    return () => {
      cancelled = true;
      window.removeEventListener('online', replay);
      document.removeEventListener('visibilitychange', replayWhenVisible);
      if (timer !== undefined) clearInterval(timer);
    };
  }, [markDone, hasQueued]);
}

/** Subscribe to the queue itself, so a queued tap re-renders its own button. */
function useFinishQueue() {
  return useSyncExternalStore(subscribeToFinishQueue, getQueuedFinishes);
}

/**
 * The injected `markRoundDone` without `useOperation`'s feedback state — the
 * replay path has no button to report to, and the queue module must stay free
 * of React context.
 */
function useWriteOperationRaw() {
  return useContext(WriteOperationsContext).markRoundDone;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

const TIMED_OUT = Symbol('finish-timed-out');

function timeout(ms: number): Promise<typeof TIMED_OUT> {
  return new Promise((resolve) => setTimeout(() => resolve(TIMED_OUT), ms));
}

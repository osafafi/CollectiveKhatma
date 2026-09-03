import { ReleasedChunkError } from './writeOperations';

/**
 * Durable queue of "I finished my pages" taps that could not reach Firestore.
 *
 * `markRoundDone` runs in a transaction, and a Firestore transaction always
 * reads from the server — persistence does not help it. Offline the tap has
 * nowhere to go, so the intent is written to `localStorage` instead and
 * replayed when the connection returns. `markRoundDone` is idempotent, so a
 * replay that turns out to be a duplicate costs nothing.
 *
 * This module holds no React and no Firebase: a plain external store the UI
 * subscribes to with `useSyncExternalStore`, plus a replay loop that takes the
 * write as an argument so tests can drive it.
 */

const STORAGE_KEY = 'khatma.pendingFinishes';

/**
 * How many replay attempts an entry gets before it is dropped. Replay only runs
 * while the browser reports a connection, so these are five separate returns to
 * the network, not five retries in a row. The cap exists so an entry that can
 * never succeed — an assignment deleted while the member was away, say — does
 * not retry for the rest of the app's life.
 */
const MAX_ATTEMPTS = 5;

/**
 * How long one replayed write may run before the replay moves on.
 *
 * A Firestore transaction with no reachable server does not reject — it hangs,
 * confirmed against a killed emulator. Without a bound, one unreachable entry
 * would hold the replay lock forever and no later tap would ever be sent. A
 * timed-out write is left queued and not counted as a failed attempt: it may
 * still be in flight, and if it lands the next replay is a harmless no-op.
 */
export const REPLAY_TIMEOUT_MS = 8000;

export interface QueuedFinish {
  khatmaId: string;
  memberId: string;
  round: number;
  /** Khatmas whose warning this tap also clears; see `markRoundDone`. */
  activeSeriesKhatmaIds: readonly string[];
  queuedAt: number;
  attempts: number;
}

export type MarkRoundDone = (
  khatmaId: string,
  memberId: string,
  round: number,
  activeSeriesKhatmaIds: readonly string[],
) => Promise<void>;

/** Identity of one queued tap: one member, one round, in one khatma. */
export function finishKey(khatmaId: string, memberId: string, round: number): string {
  return `${khatmaId}:${memberId}:${round}`;
}

function entryKey(entry: QueuedFinish): string {
  return finishKey(entry.khatmaId, entry.memberId, entry.round);
}

let snapshot: readonly QueuedFinish[] | undefined;
const listeners = new Set<() => void>();

/**
 * The queue as it stands. Identity is stable between mutations, which is what
 * `useSyncExternalStore` requires to avoid re-rendering on every check.
 */
export function getQueuedFinishes(): readonly QueuedFinish[] {
  snapshot ??= readStoredQueue();
  return snapshot;
}

export function subscribeToFinishQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Remember one tap. Re-queuing the same round refreshes it rather than doubling it. */
export function queueFinish(
  entry: Omit<QueuedFinish, 'queuedAt' | 'attempts'> & Partial<QueuedFinish>,
): void {
  const key = finishKey(entry.khatmaId, entry.memberId, entry.round);
  const queued: QueuedFinish = {
    khatmaId: entry.khatmaId,
    memberId: entry.memberId,
    round: entry.round,
    activeSeriesKhatmaIds: [...entry.activeSeriesKhatmaIds],
    queuedAt: entry.queuedAt ?? Date.now(),
    attempts: 0,
  };
  commit([...getQueuedFinishes().filter((item) => entryKey(item) !== key), queued]);
}

export function dropQueuedFinish(key: string): void {
  const next = getQueuedFinishes().filter((item) => entryKey(item) !== key);
  if (next.length !== getQueuedFinishes().length) commit(next);
}

/** Whether this exact round is waiting to be sent. */
export function isFinishQueued(
  queue: readonly QueuedFinish[],
  khatmaId: string,
  memberId: string,
  round: number,
): boolean {
  const key = finishKey(khatmaId, memberId, round);
  return queue.some((item) => entryKey(item) === key);
}

export interface ReplayFinishQueueResult {
  sent: number;
  released: QueuedFinish[];
  kept: number;
}

let replaying = false;

/**
 * Send everything the queue is holding, oldest first.
 *
 * Entries are dropped when the write lands, and when it fails in a way no retry
 * can fix: a chunk released back to the pool while the member was away, or an
 * entry that has used up its attempts. Anything else — the network dropping
 * again mid-replay — leaves the entry in place for the next reconnect.
 *
 * Only one replay runs at a time; a second call while one is in flight is a
 * no-op rather than a second pass over the same entries.
 */
export async function replayFinishQueue(
  markRoundDone: MarkRoundDone,
  timeoutMs: number = REPLAY_TIMEOUT_MS,
): Promise<ReplayFinishQueueResult> {
  const result: ReplayFinishQueueResult = { sent: 0, released: [], kept: 0 };
  if (replaying) return result;
  replaying = true;

  try {
    for (const entry of [...getQueuedFinishes()]) {
      const key = entryKey(entry);
      try {
        const sent = await Promise.race([
          markRoundDone(
            entry.khatmaId,
            entry.memberId,
            entry.round,
            entry.activeSeriesKhatmaIds,
          ).then(() => true),
          timeout(timeoutMs),
        ]);
        if (!sent) {
          // Still hanging. Leave it exactly as it is and stop holding the lock.
          result.kept += 1;
          continue;
        }
        dropQueuedFinish(key);
        result.sent += 1;
      } catch (error) {
        if (error instanceof ReleasedChunkError) {
          dropQueuedFinish(key);
          result.released.push(entry);
          continue;
        }
        const attempts = entry.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          dropQueuedFinish(key);
          continue;
        }
        commit(
          getQueuedFinishes().map((item) =>
            entryKey(item) === key ? { ...item, attempts } : item,
          ),
        );
        result.kept += 1;
      }
    }
  } finally {
    replaying = false;
  }

  return result;
}

/** Test seam: forget everything, including the cached snapshot. */
export function resetFinishQueue(): void {
  snapshot = undefined;
  replaying = false;
  removeStored();
  for (const listener of listeners) listener();
}

function timeout(ms: number): Promise<false> {
  return new Promise((resolve) => setTimeout(() => resolve(false), ms));
}

function commit(next: readonly QueuedFinish[]): void {
  snapshot = next;
  writeStoredQueue(next);
  for (const listener of listeners) listener();
}

function readStoredQueue(): readonly QueuedFinish[] {
  const raw = readStored();
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything malformed is dropped rather than replayed: a bad entry would
    // otherwise fail on every reconnect until it burned through its attempts.
    return parsed.filter(isQueuedFinish);
  } catch {
    return [];
  }
}

function isQueuedFinish(value: unknown): value is QueuedFinish {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.khatmaId === 'string' &&
    typeof entry.memberId === 'string' &&
    Number.isInteger(entry.round) &&
    Array.isArray(entry.activeSeriesKhatmaIds) &&
    entry.activeSeriesKhatmaIds.every((id) => typeof id === 'string') &&
    typeof entry.queuedAt === 'number' &&
    Number.isInteger(entry.attempts)
  );
}

function readStored(): string | null {
  try {
    return typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredQueue(queue: readonly QueuedFinish[]): void {
  if (queue.length === 0) {
    removeStored();
    return;
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Storage blocked: the queue still works for this session, it just does not
    // survive a reload. Losing it is better than losing the tap outright.
  }
}

function removeStored(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above — nothing useful to do if storage refuses.
  }
}

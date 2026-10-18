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
  /** Missing on persisted legacy entries and therefore treated as `khatma`. */
  kind?: 'khatma' | 'wird';
  khatmaId: string;
  memberId: string;
  round: number;
  /** Khatmas whose warning this tap also clears; see `markRoundDone`. */
  activeSeriesKhatmaIds: readonly string[];
  queuedAt: number;
  attempts: number;
  /** Wird-only local day and content snapshot captured when the member tapped. */
  date?: string;
  contentKind?: 'quran' | 'dua';
  pages?: readonly number[];
}

export type MarkRoundDone = (
  khatmaId: string,
  memberId: string,
  round: number,
  activeSeriesKhatmaIds: readonly string[],
) => Promise<void>;

export type CompleteWirdDay = (input: {
  wirdId: string;
  memberId: string;
  date: string;
  completedAt: number;
  contentKind: 'quran' | 'dua';
  pages: number[];
}) => Promise<void>;

export interface FinishQueueWriters {
  markRoundDone: MarkRoundDone;
  completeWirdDay: CompleteWirdDay;
}

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
    ...(entry.kind ? { kind: entry.kind } : {}),
    khatmaId: entry.khatmaId,
    memberId: entry.memberId,
    round: entry.round,
    activeSeriesKhatmaIds: [...entry.activeSeriesKhatmaIds],
    queuedAt: entry.queuedAt ?? Date.now(),
    attempts: 0,
    ...(entry.date ? { date: entry.date } : {}),
    ...(entry.contentKind ? { contentKind: entry.contentKind } : {}),
    ...(entry.pages ? { pages: [...entry.pages] } : {}),
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
  writers: MarkRoundDone | FinishQueueWriters,
  timeoutMs: number = REPLAY_TIMEOUT_MS,
): Promise<ReplayFinishQueueResult> {
  const result: ReplayFinishQueueResult = { sent: 0, released: [], kept: 0 };
  if (replaying) return result;
  replaying = true;

  try {
    for (const entry of [...getQueuedFinishes()]) {
      const key = entryKey(entry);
      try {
        const write =
          entry.kind === 'wird'
            ? typeof writers === 'function'
              ? Promise.reject(new Error('No Wird completion writer is configured'))
              : writers.completeWirdDay({
                  wirdId: entry.khatmaId,
                  memberId: entry.memberId,
                  date: entry.date!,
                  completedAt: entry.queuedAt,
                  contentKind: entry.contentKind!,
                  pages: [...(entry.pages ?? [])],
                })
            : (typeof writers === 'function' ? writers : writers.markRoundDone)(
                entry.khatmaId,
                entry.memberId,
                entry.round,
                entry.activeSeriesKhatmaIds,
              );
        const sent = await Promise.race([write.then(() => true), timeout(timeoutMs)]);
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
  const base =
    typeof entry.khatmaId === 'string' &&
    typeof entry.memberId === 'string' &&
    Number.isInteger(entry.round) &&
    Array.isArray(entry.activeSeriesKhatmaIds) &&
    entry.activeSeriesKhatmaIds.every((id) => typeof id === 'string') &&
    typeof entry.queuedAt === 'number' &&
    Number.isInteger(entry.attempts);
  if (!base) return false;
  if (entry.kind !== 'wird') return entry.kind === undefined || entry.kind === 'khatma';
  return (
    typeof entry.date === 'string' &&
    (entry.contentKind === 'quran' || entry.contentKind === 'dua') &&
    Array.isArray(entry.pages) &&
    entry.pages.every((page) => Number.isInteger(page))
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

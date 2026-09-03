import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getQueuedFinishes,
  isFinishQueued,
  queueFinish,
  replayFinishQueue,
  resetFinishQueue,
  subscribeToFinishQueue,
  type MarkRoundDone,
} from '@/app/operations/finishQueue';
import { ReleasedChunkError } from '@/data/assignments';

const entry = {
  khatmaId: 'k1',
  memberId: 'p1',
  round: 3,
  activeSeriesKhatmaIds: ['k1', 'k2'],
};

beforeEach(() => {
  resetFinishQueue();
});

describe('finish queue', () => {
  it('keeps a tap and reports it as queued for that round only', () => {
    queueFinish(entry);

    const queue = getQueuedFinishes();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ khatmaId: 'k1', memberId: 'p1', round: 3 });
    expect(isFinishQueued(queue, 'k1', 'p1', 3)).toBe(true);
    expect(isFinishQueued(queue, 'k1', 'p1', 4)).toBe(false);
    expect(isFinishQueued(queue, 'k2', 'p1', 3)).toBe(false);
  });

  it('refreshes rather than doubles a re-queued round', () => {
    queueFinish(entry);
    queueFinish(entry);

    expect(getQueuedFinishes()).toHaveLength(1);
  });

  it('notifies subscribers and keeps snapshot identity stable between changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFinishQueue(listener);

    const before = getQueuedFinishes();
    expect(getQueuedFinishes()).toBe(before); // stable — useSyncExternalStore needs this

    queueFinish(entry);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getQueuedFinishes()).not.toBe(before);

    unsubscribe();
    queueFinish({ ...entry, round: 4 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sends every queued tap and empties itself', async () => {
    const markRoundDone = vi.fn<MarkRoundDone>().mockResolvedValue(undefined);
    queueFinish(entry);
    queueFinish({ ...entry, round: 4 });

    const result = await replayFinishQueue(markRoundDone);

    expect(result.sent).toBe(2);
    expect(markRoundDone).toHaveBeenNthCalledWith(1, 'k1', 'p1', 3, ['k1', 'k2']);
    expect(markRoundDone).toHaveBeenNthCalledWith(2, 'k1', 'p1', 4, ['k1', 'k2']);
    expect(getQueuedFinishes()).toHaveLength(0);
  });

  it('drops a chunk released while the member was offline', async () => {
    const markRoundDone = vi
      .fn<MarkRoundDone>()
      .mockRejectedValue(new ReleasedChunkError());
    queueFinish(entry);

    const result = await replayFinishQueue(markRoundDone);

    // No retry can fix it: the pages went back to the pool and to someone else.
    expect(result.released).toHaveLength(1);
    expect(result.released[0]).toMatchObject({ round: 3 });
    expect(getQueuedFinishes()).toHaveLength(0);
  });

  it('keeps a tap that failed on the network, and counts the attempt', async () => {
    const markRoundDone = vi
      .fn<MarkRoundDone>()
      .mockRejectedValue(new Error('network request failed'));
    queueFinish(entry);

    const result = await replayFinishQueue(markRoundDone);

    expect(result.kept).toBe(1);
    expect(getQueuedFinishes()).toHaveLength(1);
    expect(getQueuedFinishes()[0]?.attempts).toBe(1);
  });

  it('gives up on an entry that can never land', async () => {
    const markRoundDone = vi
      .fn<MarkRoundDone>()
      .mockRejectedValue(new Error('no assignment for p1 in khatma k1'));
    queueFinish(entry);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await replayFinishQueue(markRoundDone);
    }

    expect(markRoundDone).toHaveBeenCalledTimes(5);
    expect(getQueuedFinishes()).toHaveLength(0);
  });

  it('does not let a hanging write jam the queue', async () => {
    // A Firestore transaction with no reachable server hangs rather than
    // rejecting — verified against a killed emulator. Without a bound, this
    // entry would hold the replay lock and nothing would ever be sent again.
    const markRoundDone = vi
      .fn<MarkRoundDone>()
      .mockImplementation(() => new Promise<void>(() => undefined));
    queueFinish(entry);

    const result = await replayFinishQueue(markRoundDone, 10);

    expect(result.kept).toBe(1);
    expect(getQueuedFinishes()).toHaveLength(1);
    // Not counted against its attempts: the write may yet land, and a member
    // must not lose a completion to a slow network.
    expect(getQueuedFinishes()[0]?.attempts).toBe(0);

    // The lock is free, so a later reconnect still gets its turn.
    const landed = vi.fn<MarkRoundDone>().mockResolvedValue(undefined);
    await replayFinishQueue(landed, 10);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(getQueuedFinishes()).toHaveLength(0);
  });

  it('runs one replay at a time', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const markRoundDone = vi.fn<MarkRoundDone>().mockImplementation(() => gate);
    queueFinish(entry);

    const first = replayFinishQueue(markRoundDone);
    const second = await replayFinishQueue(markRoundDone);

    expect(second).toEqual({ sent: 0, released: [], kept: 0 });
    release();
    await first;
    expect(markRoundDone).toHaveBeenCalledTimes(1);
  });
});

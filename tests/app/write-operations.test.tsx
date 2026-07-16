import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  WriteOperationsProvider,
  useOperation,
  useWriteOperation,
  writeOperations,
  type WriteOperations,
} from '@/app/operations';
import { clearRoundDone, clearWarning, markRoundDone } from '@/data/assignments';
import { setDu3aText } from '@/data/content';
import { runDistribution } from '@/data/distribution';
import {
  addMemberToKhatma,
  completeKhatma,
  createKhatma,
  deleteKhatma,
  releaseMemberChunk,
  removeMemberFromKhatma,
  renameSeries,
  setSeriesImage,
  updateKhatma,
} from '@/data/khatmas';
import { addPerson, removePerson, renamePerson, updatePerson } from '@/data/roster';

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('write operations', () => {
  it('exposes every existing mutation through the UI-facing data adapter', () => {
    expect(writeOperations).toEqual({
      addPerson,
      renamePerson,
      updatePerson,
      removePerson,
      setDu3aText,
      createKhatma,
      setSeriesImage,
      updateKhatma,
      renameSeries,
      completeKhatma,
      addMemberToKhatma,
      releaseMemberChunk,
      removeMemberFromKhatma,
      deleteKhatma,
      markRoundDone,
      clearRoundDone,
      clearWarning,
      runDistribution,
    });
  });

  it('reports pending and success while returning the write result', async () => {
    const pending = deferred<string>();
    const operation = vi.fn<(input: string) => Promise<string>>(() => pending.promise);
    const { result } = renderHook(() => useOperation(operation));

    let outcomePromise!: ReturnType<typeof result.current.execute>;
    act(() => {
      outcomePromise = result.current.execute('input');
    });

    expect(operation).toHaveBeenCalledWith('input');
    expect(result.current.state).toEqual({
      status: 'pending',
      result: undefined,
      error: null,
    });
    expect(result.current.isPending).toBe(true);

    await act(async () => pending.resolve('saved-id'));

    await expect(outcomePromise).resolves.toEqual({
      status: 'success',
      result: 'saved-id',
      error: null,
    });
    expect(result.current.state).toEqual({
      status: 'success',
      result: 'saved-id',
      error: null,
    });
  });

  it('preserves typed failures and permits a clean retry', async () => {
    class ExpectedWriteError extends Error {}
    const expectedError = new ExpectedWriteError('try again');
    const operation = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(expectedError)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useOperation(operation));

    await act(async () => {
      const outcome = await result.current.execute();
      expect(outcome).toEqual({
        status: 'failure',
        result: undefined,
        error: expectedError,
      });
    });
    expect(result.current.state.status).toBe('failure');
    if (result.current.state.status === 'failure') {
      expect(result.current.state.error).toBe(expectedError);
    }

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.state).toEqual({
      status: 'success',
      result: undefined,
      error: null,
    });
  });

  it('lets only the latest overlapping call update visible feedback', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const operation = vi
      .fn<(key: string) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useOperation(operation));

    act(() => {
      void result.current.execute('first');
      void result.current.execute('second');
    });
    await act(async () => second.resolve('newest'));
    expect(result.current.state).toMatchObject({ status: 'success', result: 'newest' });

    await act(async () => first.resolve('stale'));
    expect(result.current.state).toMatchObject({ status: 'success', result: 'newest' });
  });

  it('calls an injected typed write through useWriteOperation', async () => {
    const addPersonOverride = vi.fn<WriteOperations['addPerson']>(async () => 'person-1');
    const operations = { ...writeOperations, addPerson: addPersonOverride };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WriteOperationsProvider operations={operations}>
        {children}
      </WriteOperationsProvider>
    );
    const { result } = renderHook(() => useWriteOperation('addPerson'), { wrapper });
    const input = { name: 'Amina', pagesPerDay: 3 };

    await act(async () => {
      await result.current.execute(input);
    });

    expect(addPersonOverride).toHaveBeenCalledWith(input);
    expect(result.current.state).toMatchObject({
      status: 'success',
      result: 'person-1',
    });
  });
});

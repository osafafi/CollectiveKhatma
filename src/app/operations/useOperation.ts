import { useCallback, useEffect, useRef, useState } from 'react';

export type OperationStatus = 'idle' | 'pending' | 'success' | 'failure';

export type OperationState<Result> =
  | { status: 'idle'; result: undefined; error: null }
  | { status: 'pending'; result: undefined; error: null }
  | { status: 'success'; result: Result; error: null }
  | { status: 'failure'; result: undefined; error: Error };

export type SettledOperationState<Result> = Extract<
  OperationState<Result>,
  { status: 'success' | 'failure' }
>;

export interface UseOperationResult<Arguments extends unknown[], Result> {
  state: OperationState<Result>;
  isPending: boolean;
  execute: (...args: Arguments) => Promise<SettledOperationState<Result>>;
  reset: () => void;
}

function idleState<Result>(): OperationState<Result> {
  return { status: 'idle', result: undefined, error: null };
}

/** Keep failures renderable while preserving typed data-layer Error subclasses. */
export function toOperationError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'string' && reason.trim()) return new Error(reason);
  return new Error('The operation failed.');
}

/**
 * Run a UI-triggered async action with one consistent local feedback contract.
 * Every invocation executes; if calls overlap, only the latest invocation may
 * update visible state. Reset also invalidates pending feedback without trying
 * to cancel a Firestore write that may already be in flight.
 */
export function useOperation<Arguments extends unknown[], Result>(
  operation: (...args: Arguments) => Promise<Result>,
): UseOperationResult<Arguments, Result> {
  const [state, setState] = useState<OperationState<Result>>(idleState);
  const mountedRef = useRef(true);
  const latestInvocationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      latestInvocationRef.current += 1;
    };
  }, []);

  const execute = useCallback(
    async (...args: Arguments): Promise<SettledOperationState<Result>> => {
      const invocation = ++latestInvocationRef.current;
      if (mountedRef.current) {
        setState({ status: 'pending', result: undefined, error: null });
      }

      try {
        const result = await operation(...args);
        const settled = { status: 'success', result, error: null } as const;
        if (mountedRef.current && invocation === latestInvocationRef.current) {
          setState(settled);
        }
        return settled;
      } catch (reason) {
        const settled = {
          status: 'failure',
          result: undefined,
          error: toOperationError(reason),
        } as const;
        if (mountedRef.current && invocation === latestInvocationRef.current) {
          setState(settled);
        }
        return settled;
      }
    },
    [operation],
  );

  const reset = useCallback(() => {
    latestInvocationRef.current += 1;
    if (mountedRef.current) setState(idleState);
  }, []);

  return { state, isPending: state.status === 'pending', execute, reset };
}

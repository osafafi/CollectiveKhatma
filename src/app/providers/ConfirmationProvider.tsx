import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmationDialog } from '@/components/primitives/ConfirmationDialog';
import {
  ConfirmationContext,
  type ConfirmationContextValue,
  type ConfirmationOptions,
} from './confirmationContext';

interface PendingConfirmation {
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
}

interface ConfirmationProviderProps {
  children: ReactNode;
}

/**
 * App-wide asynchronous confirmation pattern. Requests are shown FIFO, one at a
 * time, and resolve false on cancel, escape/backdrop close, or provider unmount.
 */
export function ConfirmationProvider({ children }: ConfirmationProviderProps) {
  const [active, setActive] = useState<PendingConfirmation | null>(null);
  const activeRef = useRef<PendingConfirmation | null>(null);
  const queueRef = useRef<PendingConfirmation[]>([]);

  const confirm = useCallback((input: ConfirmationOptions | string) => {
    const options = typeof input === 'string' ? { message: input } : input;
    return new Promise<boolean>((resolve) => {
      const request: PendingConfirmation = { options, resolve };
      if (activeRef.current) {
        queueRef.current.push(request);
        return;
      }
      activeRef.current = request;
      setActive(request);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    current.resolve(confirmed);

    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  useEffect(
    () => () => {
      activeRef.current?.resolve(false);
      for (const pending of queueRef.current) pending.resolve(false);
      activeRef.current = null;
      queueRef.current = [];
    },
    [],
  );

  const value = useMemo<ConfirmationContextValue>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        open={Boolean(active)}
        message={active?.options.message ?? ''}
        title={active?.options.title}
        confirmLabel={active?.options.confirmLabel}
        cancelLabel={active?.options.cancelLabel}
        tone={active?.options.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmationContext.Provider>
  );
}

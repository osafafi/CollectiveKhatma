import { useMemo, useRef, type ReactNode } from 'react';
import {
  CreateKhatmaPrefillContext,
  type CreateKhatmaPrefill,
  type CreateKhatmaPrefillContextValue,
} from './createKhatmaPrefillContext';

/**
 * Holds the pending create-khatma prefill (see {@link CreateKhatmaPrefill}) in a
 * ref that outlives route changes — it lives at the `AdminExperience` level, above
 * the router content. A ref, not state, because the handoff is a synchronous
 * set-then-navigate: the detail page stashes the prefill and the freshly mounted
 * Khatmas page reads it during its first render, so no re-render of this provider
 * is needed or wanted.
 *
 * Consumption is split into a pure `peekPrefill` (safe to call while the create
 * form initializes its state, and idempotent under a StrictMode double render) and
 * a `clearPrefill` the form calls from an effect once it has seeded — so a later,
 * ordinary navigation to `#/khatmas` never re-consumes a stale prefill.
 */
export function CreateKhatmaPrefillProvider({ children }: { children: ReactNode }) {
  const pendingRef = useRef<CreateKhatmaPrefill | null>(null);
  const value = useMemo<CreateKhatmaPrefillContextValue>(
    () => ({
      requestPrefill: (prefill) => {
        pendingRef.current = prefill;
      },
      peekPrefill: () => pendingRef.current,
      clearPrefill: () => {
        pendingRef.current = null;
      },
    }),
    [],
  );
  return (
    <CreateKhatmaPrefillContext.Provider value={value}>
      {children}
    </CreateKhatmaPrefillContext.Provider>
  );
}

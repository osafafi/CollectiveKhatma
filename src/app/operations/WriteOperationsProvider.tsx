import type { ReactNode } from 'react';
import { WriteOperationsContext } from './writeOperationsContext';
import type { WriteOperations } from './writeOperations';

interface WriteOperationsProviderProps {
  children: ReactNode;
  operations: WriteOperations;
}

/** Optional override boundary for previews, component tests, and future emulators. */
export function WriteOperationsProvider({
  children,
  operations,
}: WriteOperationsProviderProps) {
  return (
    <WriteOperationsContext.Provider value={operations}>
      {children}
    </WriteOperationsContext.Provider>
  );
}

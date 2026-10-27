import { useContext, useSyncExternalStore } from 'react';
import { RecitationContext, type RecitationContextValue } from './recitationContext';
import type { RecitationSnapshot } from './recitationEngine';

export function useRecitation(): RecitationContextValue {
  const value = useContext(RecitationContext);
  if (!value) throw new Error('useRecitation must be used inside RecitationProvider');
  return value;
}

/** The engine's current state, re-rendering on every transition. */
export function useRecitationSnapshot(): RecitationSnapshot {
  const { engine } = useRecitation();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}

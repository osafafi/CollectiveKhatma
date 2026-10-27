import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQariPreference } from '@/app/persistence';
import { RecitationUnavailableDialog } from '@/components/recitation';
import { browserRecitationEnvironment } from './browserRecitationEnvironment';
import { RecitationContext } from './recitationContext';
import { createRecitationEngine, type RecitationEnvironment } from './recitationEngine';

/**
 * One recitation engine for the member app, above every route, plus the single
 * "not available on this device" dialog every failure ends in. The voice
 * preference is hoisted here so Settings and the readers share one value.
 */
export function RecitationProvider({
  children,
  environment = browserRecitationEnvironment,
}: {
  children: ReactNode;
  /** Test seam; the browser's own audio and network otherwise. */
  environment?: RecitationEnvironment;
}) {
  // Construction has no side effects (the element is created on first start),
  // so StrictMode's double initialisation is harmless.
  const [engine] = useState(() => createRecitationEngine(environment));
  const [qariId, setQariId] = useQariPreference();
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => () => engine.stop(), [engine]);

  const value = useMemo(
    () => ({ engine, qariId, setQariId }),
    [engine, qariId, setQariId],
  );

  return (
    <RecitationContext.Provider value={value}>
      {children}
      <RecitationUnavailableDialog
        open={snapshot.status === 'unavailable'}
        onClose={engine.acknowledgeUnavailable}
      />
    </RecitationContext.Provider>
  );
}

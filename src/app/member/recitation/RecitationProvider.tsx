import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQariPreference } from '@/app/persistence';
import { getSurahs } from '@/content/quran/loader';
import { strings } from '@/content/strings.ar';
import { RecitationUnavailableDialog } from '@/components/recitation';
import { browserRecitationEnvironment } from './browserRecitationEnvironment';
import { RecitationContext } from './recitationContext';
import { createRecitationEngine, type RecitationEnvironment } from './recitationEngine';
import {
  browserMediaSessionPorts,
  browserWakeLockPorts,
  connectMediaSession,
  connectWakeLock,
  type DescribeRecitation,
} from './recitationBridges';
import { verseLabel } from './recitationLabels';

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

  useEffect(() => {
    const disconnectWakeLock = connectWakeLock(engine, browserWakeLockPorts());
    const disconnectMediaSession = connectMediaSession(
      engine,
      browserMediaSessionPorts(),
      describeForLockScreen,
    );
    return () => {
      disconnectWakeLock();
      disconnectMediaSession();
    };
  }, [engine]);

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

/** Surah names for the lock screen, fetched the first time a reader recites. */
let surahNames: ReadonlyMap<number, string> | undefined;
let surahNamesRequested = false;

const describeForLockScreen: DescribeRecitation = (item, qariId) => {
  if (!surahNamesRequested) {
    surahNamesRequested = true;
    getSurahs()
      .then((surahs) => {
        surahNames = new Map(surahs.map((surah) => [surah.id, surah.name]));
      })
      .catch(() => {
        surahNamesRequested = false;
      });
  }
  return {
    title: verseLabel(item, surahNames?.get(item.surah)),
    artist: strings.recitation.qariNames[qariId],
    album: strings.common.appName,
  };
};

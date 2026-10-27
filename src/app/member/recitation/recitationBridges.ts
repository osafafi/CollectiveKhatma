import type { QariId } from '@/content/quran/recitation';
import type { RecitationEngine, RecitationSnapshot } from './recitationEngine';
import type { RecitationItem } from './recitationPlaylist';

/**
 * Best-effort ties between the recitation engine and the device: keep the
 * screen awake while a reader recites, and show the verse with play, pause,
 * next and previous on the lock screen / media notification. Both subscribe
 * to engine snapshots, so the engine stays a plain transport, and every
 * platform failure is swallowed — neither may ever break playback.
 */

const isReciting = (snapshot: RecitationSnapshot): boolean =>
  snapshot.kind === 'reader' &&
  (snapshot.status === 'playing' || snapshot.status === 'loading');

// --- Screen Wake Lock ----------------------------------------------------------

export interface WakeLockHandle {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockPorts {
  /** Undefined when the browser has no Screen Wake Lock. */
  request(): Promise<WakeLockHandle> | undefined;
  isVisible(): boolean;
  onVisibilityChange(listener: () => void): () => void;
}

/**
 * Hold a screen wake lock while a reader is reciting and the page is visible.
 * Browsers drop the lock whenever the page is hidden, so it is requested again
 * when the member comes back.
 */
export function connectWakeLock(
  engine: RecitationEngine,
  ports: WakeLockPorts,
): () => void {
  let lock: WakeLockHandle | undefined;
  let requesting = false;

  const wanted = (): boolean => isReciting(engine.getSnapshot()) && ports.isVisible();

  const release = (): void => {
    const held = lock;
    lock = undefined;
    held?.release().catch(() => undefined);
  };

  const sync = (): void => {
    if (!wanted()) {
      release();
      return;
    }
    if (lock || requesting) return;
    let pending: Promise<WakeLockHandle> | undefined;
    try {
      pending = ports.request();
    } catch {
      return;
    }
    if (!pending) return;
    requesting = true;
    pending.then(
      (granted) => {
        requesting = false;
        if (!wanted()) {
          granted.release().catch(() => undefined);
          return;
        }
        lock = granted;
        granted.addEventListener?.('release', () => {
          if (lock === granted) lock = undefined;
        });
      },
      () => {
        requesting = false;
      },
    );
  };

  const unsubscribe = engine.subscribe(sync);
  const unwatch = ports.onVisibilityChange(sync);
  return () => {
    unsubscribe();
    unwatch();
    release();
  };
}

// --- Media Session --------------------------------------------------------------

export type MediaAction =
  | 'play'
  | 'pause'
  | 'nexttrack'
  | 'previoustrack'
  | 'seekto'
  | 'seekbackward'
  | 'seekforward';

export interface MediaMetadataFields {
  title: string;
  artist: string;
  album: string;
}

export interface MediaSessionPorts {
  setMetadata(metadata: MediaMetadataFields | null): void;
  setPlaybackState(state: 'none' | 'paused' | 'playing'): void;
  setActionHandler(action: MediaAction, handler: (() => void) | null): void;
}

export type DescribeRecitation = (
  item: RecitationItem,
  qariId: QariId,
) => MediaMetadataFields;

/**
 * Mirror a reader session onto the OS media controls. Seek actions are cleared
 * so iOS shows previous/next verse buttons rather than ±10 seconds.
 */
export function connectMediaSession(
  engine: RecitationEngine,
  ports: MediaSessionPorts | undefined,
  describe: DescribeRecitation,
): () => void {
  if (!ports) return () => undefined;
  let active = false;
  let described: string | undefined;

  const attempt = (run: () => void): void => {
    try {
      run();
    } catch {
      // A platform that rejects one action must not stop the others.
    }
  };

  const handlers: Record<MediaAction, (() => void) | null> = {
    play: () => engine.resume(),
    pause: () => engine.pause(),
    nexttrack: () => engine.next(),
    previoustrack: () => engine.previous(),
    seekto: null,
    seekbackward: null,
    seekforward: null,
  };

  const clear = (): void => {
    if (!active) return;
    active = false;
    described = undefined;
    attempt(() => ports.setMetadata(null));
    attempt(() => ports.setPlaybackState('none'));
    for (const action of Object.keys(handlers) as MediaAction[]) {
      attempt(() => ports.setActionHandler(action, null));
    }
  };

  const sync = (): void => {
    const snapshot = engine.getSnapshot();
    if (snapshot.kind !== 'reader' || snapshot.status === 'idle' || !snapshot.item) {
      clear();
      return;
    }
    if (!active) {
      active = true;
      for (const [action, handler] of Object.entries(handlers) as [
        MediaAction,
        (() => void) | null,
      ][]) {
        attempt(() => ports.setActionHandler(action, handler));
      }
    }
    const key = `${snapshot.sessionId}:${snapshot.index}`;
    if (key !== described && snapshot.qariId) {
      described = key;
      const metadata = describe(snapshot.item, snapshot.qariId);
      attempt(() => ports.setMetadata(metadata));
    }
    const state = snapshot.status === 'playing' || snapshot.status === 'loading';
    attempt(() => ports.setPlaybackState(state ? 'playing' : 'paused'));
  };

  const unsubscribe = engine.subscribe(sync);
  return () => {
    unsubscribe();
    clear();
  };
}

// --- Browser ports --------------------------------------------------------------

export function browserWakeLockPorts(): WakeLockPorts {
  return {
    request: () =>
      typeof navigator !== 'undefined' && 'wakeLock' in navigator
        ? navigator.wakeLock.request('screen')
        : undefined,
    isVisible: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible',
    onVisibilityChange(listener) {
      if (typeof document === 'undefined') return () => undefined;
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}

export function browserMediaSessionPorts(): MediaSessionPorts | undefined {
  if (
    typeof navigator === 'undefined' ||
    !('mediaSession' in navigator) ||
    typeof MediaMetadata === 'undefined'
  ) {
    return undefined;
  }
  const session = navigator.mediaSession;
  return {
    setMetadata: (metadata) => {
      session.metadata = metadata ? new MediaMetadata(metadata) : null;
    },
    setPlaybackState: (state) => {
      session.playbackState = state;
    },
    setActionHandler: (action, handler) => session.setActionHandler(action, handler),
  };
}

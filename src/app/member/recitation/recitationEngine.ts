import { ayahAudioUrls, BASMALA_REF, type QariId } from '@/content/quran/recitation';
import {
  previousTarget,
  type RecitationItem,
  type RecitationPlaylist,
} from './recitationPlaylist';

/**
 * Framework-free recitation transport: one media element, a playlist, and the
 * failure rules that keep a member on a WhatsApp-only bundle (online, yet
 * unable to reach the audio hosts) from ever seeing a crash or a misleading
 * error — every dead end becomes the single `unavailable` state.
 *
 * iOS rules shape it: `start` reaches `audio.play()` synchronously so the tap
 * that called it unlocks the element, and the element is created once and
 * reused for every ayah (later programmatic `play()` calls on an unlocked
 * element are allowed). React reads it through `useSyncExternalStore`.
 */

/** A host gets this long to start playing an ayah before the next one is tried. */
export const LOAD_TIMEOUT_MS = 7000;
/** Playback that buffers this long without progress counts as a lost connection. */
export const STALL_TIMEOUT_MS = 12000;
/** Ceiling on the in-memory prefetch of the next ayah. */
export const PREFETCH_TIMEOUT_MS = 20000;

export type RecitationAudioEvent =
  'playing' | 'pause' | 'ended' | 'error' | 'waiting' | 'timeupdate';

/** The slice of `HTMLAudioElement` the engine uses, so tests can fake it. */
export interface RecitationAudio {
  src: string;
  currentTime: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void> | undefined;
  pause(): void;
  load(): void;
  removeAttribute(name: 'src'): void;
  addEventListener(type: RecitationAudioEvent, listener: () => void): void;
}

export interface RecitationEnvironment {
  /** Called at most once, lazily, on the first start. */
  createAudio(): RecitationAudio;
  fetch(url: string, init: { signal: AbortSignal }): Promise<Response>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  isOnline(): boolean;
  /** True when the member has asked their browser to conserve data. */
  savesData(): boolean;
}

export type RecitationStatus =
  'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'unavailable';

export type RecitationKind = 'reader' | 'preview';

export interface RecitationSession {
  /** Who started it; `stop(owner)` from anyone else is ignored. */
  owner: string;
  kind: RecitationKind;
  qariId: QariId;
  playlist: RecitationPlaylist;
  startIndex?: number;
}

export interface RecitationSnapshot {
  readonly status: RecitationStatus;
  readonly sessionId: number;
  readonly owner: string | undefined;
  readonly kind: RecitationKind | undefined;
  readonly qariId: QariId | undefined;
  readonly index: number;
  readonly item: RecitationItem | undefined;
  /** Paused by something other than the member: the OS, a call, another app. */
  readonly interrupted: boolean;
}

export interface RecitationEngine {
  getSnapshot(): RecitationSnapshot;
  subscribe(listener: () => void): () => void;
  /** Must be called from a user gesture: it plays synchronously. */
  start(session: RecitationSession): void;
  pause(): void;
  resume(): void;
  next(): void;
  /** Back rule: early in an item, the one before; otherwise restart this one. */
  previous(): void;
  /** Play a known item of the current session from its start. */
  playIndex(index: number): void;
  /** Stop and release everything; with an owner, only that owner's session. */
  stop(owner?: string): void;
  /** Close the unavailable state: paused where it stopped, or idle if nothing played. */
  acknowledgeUnavailable(): void;
}

const IDLE_SNAPSHOT: RecitationSnapshot = {
  status: 'idle',
  sessionId: 0,
  owner: undefined,
  kind: undefined,
  qariId: undefined,
  index: 0,
  item: undefined,
  interrupted: false,
};

export function createRecitationEngine(env: RecitationEnvironment): RecitationEngine {
  const listeners = new Set<() => void>();
  let snapshot = IDLE_SNAPSHOT;
  let audio: RecitationAudio | undefined;
  let session: RecitationSession | undefined;
  let sessionId = 0;

  // Per session.
  let mirrorPreferred = false;
  let hasPlayed = false;
  /** The element no longer holds a playable source for the current item. */
  let needsReload = false;
  /** Index the player is moving to while the playlist resolves it. */
  let pendingAdvance: number | undefined;
  /** Bumped whenever an async continuation (advance, prefetch) goes stale. */
  let advanceToken = 0;
  /** Canonical (primary-host) URL → object URL of a prefetched ayah. */
  const blobs = new Map<string, string>();
  let prefetch:
    { controller: AbortController; timer: ReturnType<typeof setTimeout> } | undefined;

  // Per load attempt.
  let attemptId = 0;
  let candidates: string[] = [];
  let candidatePos = 0;
  let mirrorUrl: string | undefined;
  let expectedSrc: string | undefined;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let lastProgressTime = 0;
  /** Our own `pause()` call; its event is not an interruption. */
  let selfPause = false;

  function emit(patch: Partial<RecitationSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of [...listeners]) listener();
  }

  function media(): RecitationAudio {
    if (audio) return audio;
    const created = env.createAudio();
    created.addEventListener('playing', onPlaying);
    created.addEventListener('pause', onPause);
    created.addEventListener('ended', onEnded);
    created.addEventListener('error', onError);
    created.addEventListener('waiting', onWaiting);
    created.addEventListener('timeupdate', onTimeUpdate);
    audio = created;
    return created;
  }

  const isCurrentSource = (): boolean =>
    audio !== undefined && expectedSrc !== undefined && audio.src === expectedSrc;

  function urlsFor(item: RecitationItem, qariId: QariId): string[] {
    const ref = item.kind === 'basmala' ? BASMALA_REF : item;
    return ayahAudioUrls(qariId, ref.surah, ref.ayah);
  }

  function hostOrder(urls: string[]): string[] {
    return mirrorPreferred && urls.length > 1 ? [urls[1]!, urls[0]!] : urls;
  }

  function basmalaUrl(): string | undefined {
    return session
      ? ayahAudioUrls(session.qariId, BASMALA_REF.surah, BASMALA_REF.ayah)[0]
      : undefined;
  }

  // --- timers and resources -------------------------------------------------

  function clearLoadTimer(): void {
    if (loadTimer !== undefined) clearTimeout(loadTimer);
    loadTimer = undefined;
  }

  function clearStallTimer(): void {
    if (stallTimer !== undefined) clearTimeout(stallTimer);
    stallTimer = undefined;
  }

  function clearTimers(): void {
    clearLoadTimer();
    clearStallTimer();
  }

  function cancelPrefetch(): void {
    if (!prefetch) return;
    clearTimeout(prefetch.timer);
    prefetch.controller.abort();
    prefetch = undefined;
  }

  /** Keep only the blob about to play and the session-long basmala. */
  function releaseBlobsExcept(keep: string): void {
    const basmala = basmalaUrl();
    for (const [url, objectUrl] of blobs) {
      if (url === keep || url === basmala) continue;
      env.revokeObjectURL(objectUrl);
      blobs.delete(url);
    }
  }

  function revokeAllBlobs(): void {
    for (const objectUrl of blobs.values()) env.revokeObjectURL(objectUrl);
    blobs.clear();
  }

  function pauseMedia(): void {
    if (audio && !audio.paused) {
      selfPause = true;
      audio.pause();
    }
  }

  // --- loading ----------------------------------------------------------------

  function loadItem(index: number): void {
    if (!session) return;
    const item = session.playlist.items[index];
    if (!item) {
      finish();
      return;
    }
    advanceToken += 1;
    pendingAdvance = undefined;
    needsReload = false;
    clearTimers();
    cancelPrefetch();

    const urls = urlsFor(item, session.qariId);
    const canonical = urls[0]!;
    const blob = blobs.get(canonical);
    mirrorUrl = urls[1];
    candidates = blob ? [blob, ...hostOrder(urls)] : hostOrder(urls);
    candidatePos = 0;
    emit({ status: 'loading', index, item, interrupted: false });
    tryCandidate();
    releaseBlobsExcept(canonical);
  }

  function tryCandidate(): void {
    const url = candidates[candidatePos];
    if (url === undefined || (!url.startsWith('blob:') && !env.isOnline())) {
      becomeUnavailable();
      return;
    }
    const id = (attemptId += 1);
    const element = media();
    expectedSrc = url;
    element.src = url;
    // Read back what the element stores, which may be a normalised form.
    expectedSrc = element.src;
    loadTimer = setTimeout(() => failAttempt(id), LOAD_TIMEOUT_MS);
    playElement(element, id);
  }

  function playElement(element: RecitationAudio, id: number): void {
    let result: Promise<void> | undefined;
    try {
      result = element.play();
    } catch (error) {
      onPlayRejected(error, id);
      return;
    }
    if (result && typeof result.catch === 'function') {
      result.catch((error: unknown) => onPlayRejected(error, id));
    }
  }

  function onPlayRejected(error: unknown, id: number): void {
    if (id !== attemptId) return;
    const name = (error as { name?: unknown } | null)?.name;
    // A newer src or our own pause interrupted it; that path owns the state.
    if (name === 'AbortError') return;
    // The browser wants a fresh tap (iOS after the screen woke, say): hold here.
    if (name === 'NotAllowedError') {
      if (snapshot.status !== 'loading') return;
      clearLoadTimer();
      emit({ status: 'paused', interrupted: false });
      return;
    }
    failAttempt(id);
  }

  function failAttempt(id: number): void {
    if (id !== attemptId || snapshot.status !== 'loading') return;
    clearLoadTimer();
    candidatePos += 1;
    tryCandidate();
  }

  function advance(index: number): void {
    if (!session) return;
    if (session.playlist.items[index]) {
      loadItem(index);
      return;
    }
    if (session.playlist.complete) {
      finish();
      return;
    }
    const current = session;
    const token = (advanceToken += 1);
    pendingAdvance = index;
    clearTimers();
    emit({ status: 'loading', interrupted: false });
    current.playlist.ensure(index).then(
      (item) => {
        if (token !== advanceToken || session !== current) return;
        if (item) loadItem(index);
        else finish();
      },
      () => {
        if (token !== advanceToken || session !== current) return;
        becomeUnavailable();
      },
    );
  }

  function finish(): void {
    clearTimers();
    cancelPrefetch();
    pauseMedia();
    advanceToken += 1;
    pendingAdvance = undefined;
    emit({ status: 'ended', interrupted: false });
  }

  function becomeUnavailable(): void {
    clearTimers();
    cancelPrefetch();
    pauseMedia();
    advanceToken += 1;
    needsReload = true;
    emit({ status: 'unavailable', interrupted: false });
  }

  // --- prefetch ---------------------------------------------------------------

  function schedulePrefetch(index: number): void {
    if (!session || env.savesData()) return;
    const current = session;
    const token = advanceToken;
    // Resolving the next item also loads the next page's ayat ahead of time.
    current.playlist.ensure(index).then(
      (item) => {
        if (!item || session !== current || token !== advanceToken) return;
        prefetchItem(item, current);
      },
      () => undefined,
    );
  }

  function prefetchItem(item: RecitationItem, current: RecitationSession): void {
    const urls = urlsFor(item, current.qariId);
    const canonical = urls[0]!;
    if (blobs.has(canonical) || prefetch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PREFETCH_TIMEOUT_MS);
    prefetch = { controller, timer };
    env
      .fetch(hostOrder(urls)[0]!, { signal: controller.signal })
      .then(async (response) => {
        const type = response.headers.get('content-type') ?? '';
        // A carrier page or an error document must never reach the player.
        if (!response.ok || !/^(audio\/|application\/octet-stream)/i.test(type)) return;
        const body = await response.blob();
        if (session !== current || controller.signal.aborted) return;
        // Safari needs a real audio type on the blob to play it.
        const typed = body.type.startsWith('audio/')
          ? body
          : new Blob([body], { type: 'audio/mpeg' });
        blobs.set(canonical, env.createObjectURL(typed));
      })
      .catch(() => undefined)
      .finally(() => {
        if (prefetch?.controller !== controller) return;
        clearTimeout(timer);
        prefetch = undefined;
      });
  }

  // --- media events -----------------------------------------------------------

  function onPlaying(): void {
    if (!session || !isCurrentSource()) return;
    clearTimers();
    if (snapshot.status !== 'loading' && snapshot.status !== 'paused') return;
    if (mirrorUrl !== undefined && candidates[candidatePos] === mirrorUrl) {
      // The primary host failed once; stop paying its timeout on every ayah.
      mirrorPreferred = true;
    }
    hasPlayed = true;
    lastProgressTime = audio?.currentTime ?? 0;
    emit({ status: 'playing', interrupted: false });
    schedulePrefetch(snapshot.index + 1);
  }

  function onPause(): void {
    if (selfPause) {
      selfPause = false;
      return;
    }
    // The spec fires `pause` just before `ended`; that is not an interruption,
    // and neither is a stale event once `play()` has been called again.
    if (!audio || audio.ended || !audio.paused || !isCurrentSource()) return;
    if (snapshot.status !== 'playing' && snapshot.status !== 'loading') return;
    clearTimers();
    emit({ status: 'paused', interrupted: true });
  }

  function onEnded(): void {
    if (snapshot.status !== 'playing' || !isCurrentSource()) return;
    clearTimers();
    advance(snapshot.index + 1);
  }

  function onError(): void {
    if (!isCurrentSource()) return;
    if (snapshot.status === 'loading') failAttempt(attemptId);
    else if (snapshot.status === 'playing') becomeUnavailable();
    else if (snapshot.status === 'paused') needsReload = true;
  }

  function onWaiting(): void {
    if (snapshot.status !== 'playing' || stallTimer !== undefined) return;
    stallTimer = setTimeout(() => {
      stallTimer = undefined;
      if (snapshot.status === 'playing') becomeUnavailable();
    }, STALL_TIMEOUT_MS);
  }

  function onTimeUpdate(): void {
    const time = audio?.currentTime ?? 0;
    if (time === lastProgressTime) return;
    lastProgressTime = time;
    clearStallTimer();
  }

  // --- teardown ---------------------------------------------------------------

  function release(): void {
    clearTimers();
    cancelPrefetch();
    advanceToken += 1;
    pendingAdvance = undefined;
    if (audio) {
      pauseMedia();
      audio.removeAttribute('src');
      audio.load();
    }
    expectedSrc = undefined;
    candidates = [];
    revokeAllBlobs();
    session = undefined;
    hasPlayed = false;
    needsReload = false;
    mirrorPreferred = false;
  }

  function resetToIdle(): void {
    release();
    if (snapshot.status !== 'idle' || snapshot.owner !== undefined) {
      emit({ ...IDLE_SNAPSHOT, sessionId });
    }
  }

  // --- public operations ------------------------------------------------------

  function start(next: RecitationSession): void {
    release();
    session = next;
    sessionId += 1;
    const index = next.startIndex ?? 0;
    snapshot = {
      ...IDLE_SNAPSHOT,
      sessionId,
      owner: next.owner,
      kind: next.kind,
      qariId: next.qariId,
      index,
      item: next.playlist.items[index],
    };
    if (!env.isOnline()) {
      needsReload = true;
      emit({ status: 'unavailable' });
      return;
    }
    loadItem(index);
  }

  function pause(): void {
    if (snapshot.status !== 'playing' && snapshot.status !== 'loading') return;
    clearTimers();
    cancelPrefetch();
    // A pending advance stays recorded so resume carries on to it.
    advanceToken += 1;
    pauseMedia();
    emit({ status: 'paused', interrupted: false });
  }

  function resume(): void {
    if (!session || snapshot.status !== 'paused') return;
    if (pendingAdvance !== undefined) {
      advance(pendingAdvance);
      return;
    }
    if (needsReload || !audio) {
      loadItem(snapshot.index);
      return;
    }
    const id = (attemptId += 1);
    emit({ status: 'loading', interrupted: false });
    loadTimer = setTimeout(() => failAttempt(id), LOAD_TIMEOUT_MS);
    playElement(audio, id);
  }

  function next(): void {
    if (!session || snapshot.status === 'idle' || snapshot.status === 'unavailable')
      return;
    advance((pendingAdvance ?? snapshot.index) + 1);
  }

  function previous(): void {
    if (!session || snapshot.status === 'idle' || snapshot.status === 'unavailable')
      return;
    const loaded = audio !== undefined && !needsReload && pendingAdvance === undefined;
    const target = previousTarget(snapshot.index, loaded ? audio!.currentTime : 0);
    if (target === snapshot.index && loaded && snapshot.status !== 'ended') {
      audio!.currentTime = 0;
      // ±1 always plays: restarting a paused item resumes it.
      if (snapshot.status === 'paused') resume();
      return;
    }
    loadItem(target);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    pause,
    resume,
    next,
    previous,
    playIndex(index) {
      if (!session || !session.playlist.items[index]) return;
      loadItem(index);
    },
    stop(owner) {
      if (owner !== undefined && snapshot.owner !== owner) return;
      resetToIdle();
    },
    acknowledgeUnavailable() {
      if (snapshot.status !== 'unavailable') return;
      if (hasPlayed && snapshot.item) emit({ status: 'paused' });
      else resetToIdle();
    },
  };
}

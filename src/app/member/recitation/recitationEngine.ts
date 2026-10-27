import {
  ayahAudioUrls,
  BASMALA_REF,
  VERSE_OVERLAP_MS,
  type QariId,
} from '@/content/quran/recitation';
import {
  previousTarget,
  type RecitationItem,
  type RecitationPlaylist,
} from './recitationPlaylist';

/**
 * Framework-free recitation transport: two media channels, a playlist, and the
 * failure rules that keep a member on a WhatsApp-only bundle (online, yet
 * unable to reach the audio hosts) from ever seeing a crash or a misleading
 * error — every dead end becomes the single `unavailable` state.
 *
 * Ayat are joined with a short tail overlap: just before an ayah ends, the next
 * one starts on the other channel while the outgoing ayah's quiet tail fades
 * out beneath it, so the recitation flows instead of cutting to silence. Only
 * the tail overlaps (never the next ayah's words with this one's), and when the
 * next ayah is not known in time the player simply waits for `ended`.
 *
 * iOS rules shape it: `start` reaches `audio.play()` synchronously so the tap
 * that called it unlocks the channels, which are created once and reused for
 * every ayah (later programmatic `play()` calls on an unlocked element are
 * allowed). React reads it through `useSyncExternalStore`.
 */

/** A host gets this long to start playing an ayah before the next one is tried. */
export const LOAD_TIMEOUT_MS = 7000;
/** Playback that buffers this long without progress counts as a lost connection. */
export const STALL_TIMEOUT_MS = 12000;
/** Ceiling on the in-memory prefetch of the next ayah. */
export const PREFETCH_TIMEOUT_MS = 20000;
/** Default for how early the next ayah starts; the outgoing tail fades over it. */
export const VERSE_OVERLAP_SECONDS = VERSE_OVERLAP_MS.default / 1000;
/** The incoming ayah's fade-in: only long enough to avoid a click. */
export const VERSE_FADE_IN_SECONDS = 0.04;
/** How often the playing ayah is checked for its handoff point. */
export const HANDOFF_POLL_MS = 50;

export type RecitationAudioEvent =
  'playing' | 'pause' | 'ended' | 'error' | 'waiting' | 'timeupdate';

/** The slice of `HTMLAudioElement` the engine uses, plus a fade, so tests can fake it. */
export interface RecitationAudio {
  src: string;
  currentTime: number;
  /** Seconds, or NaN until the file's length is known. */
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void> | undefined;
  pause(): void;
  load(): void;
  removeAttribute(name: 'src'): void;
  addEventListener(type: RecitationAudioEvent, listener: () => void): void;
  /** Ramp this channel's loudness to `level` (0–1) over `seconds`; 0 sets it at once. */
  fadeTo(level: number, seconds: number): void;
}

export interface RecitationEnvironment {
  /** Called lazily on the first start, once per channel (twice in all). */
  createAudio(): RecitationAudio;
  /** Inside the member's tap: let the audio mixer run (iOS needs a gesture). */
  unlock?(): void;
  /** The platform stopped the audio mixer on its own (iOS screen lock, a call). */
  onInterrupted?(listener: () => void): void;
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
  /** Tail overlap for this voice, in seconds; 0 waits for each ayah to end. */
  overlapSeconds?: number;
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
  /** Retune the running session's tail overlap (the Settings slider). */
  setOverlap(seconds: number): void;
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
  /** Two channels, so an ayah can start while the previous one's tail fades. */
  let channels: [RecitationAudio, RecitationAudio] | undefined;
  /** The channel reciting the current item. */
  let active = 0;
  /** The previous item's channel while its tail fades out, if any. */
  let tail: number | undefined;
  let session: RecitationSession | undefined;
  let sessionId = 0;

  // Per session.
  let overlapSeconds = VERSE_OVERLAP_SECONDS;
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
  let handoffTimer: ReturnType<typeof setInterval> | undefined;
  let lastProgressTime = 0;
  /** The incoming ayah fades in once it actually sounds. */
  let fadeInPending = false;
  /** Our own `pause()` call per channel; its event is not an interruption. */
  const selfPause = [false, false];

  function emit(patch: Partial<RecitationSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of [...listeners]) listener();
  }

  function wire(channel: number): RecitationAudio {
    const created = env.createAudio();
    // Only the active channel drives the state; a fading tail just finishes.
    const when = (handler: () => void, onTail?: () => void) => (): void => {
      if (channel === active) handler();
      else if (channel === tail) onTail?.();
    };
    created.addEventListener('playing', when(onPlaying));
    created.addEventListener('pause', () => onPause(channel));
    created.addEventListener(
      'ended',
      when(onEnded, () => {
        tail = undefined;
      }),
    );
    created.addEventListener('error', when(onError, dropTail));
    created.addEventListener('waiting', when(onWaiting));
    created.addEventListener('timeupdate', when(onTimeUpdate));
    return created;
  }

  function allChannels(): [RecitationAudio, RecitationAudio] {
    if (!channels) {
      channels = [wire(0), wire(1)];
      env.onInterrupted?.(onInterrupted);
    }
    return channels;
  }

  /** The active channel, created on first use. */
  function media(): RecitationAudio {
    return allChannels()[active]!;
  }

  /** The active channel if it exists yet. */
  const audio = (): RecitationAudio | undefined => channels?.[active];

  const isCurrentSource = (): boolean => {
    const current = audio();
    return (
      current !== undefined && expectedSrc !== undefined && current.src === expectedSrc
    );
  };

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

  function clearHandoffWatch(): void {
    if (handoffTimer !== undefined) clearInterval(handoffTimer);
    handoffTimer = undefined;
  }

  function clearTimers(): void {
    clearLoadTimer();
    clearStallTimer();
    clearHandoffWatch();
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

  function pauseChannel(channel: number): void {
    const element = channels?.[channel];
    if (element && !element.paused) {
      selfPause[channel] = true;
      element.pause();
    }
  }

  function pauseMedia(): void {
    pauseChannel(active);
  }

  /** Cut a still-fading tail short: the member moved on, paused, or it failed. */
  function dropTail(): void {
    if (tail === undefined || !channels) return;
    const fading = channels[tail]!;
    pauseChannel(tail);
    fading.removeAttribute('src');
    fading.load();
    tail = undefined;
  }

  // --- loading ----------------------------------------------------------------

  function loadItem(index: number, { fadeIn = false } = {}): void {
    if (!session) return;
    const item = session.playlist.items[index];
    if (!item) {
      finish();
      return;
    }
    advanceToken += 1;
    pendingAdvance = undefined;
    needsReload = false;
    fadeInPending = fadeIn;
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
    // A handed-over ayah starts silent and fades in once it sounds.
    element.fadeTo(fadeInPending ? 0 : 1, 0);
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
    dropTail();
    pauseMedia();
    advanceToken += 1;
    pendingAdvance = undefined;
    emit({ status: 'ended', interrupted: false });
  }

  function becomeUnavailable(): void {
    clearTimers();
    cancelPrefetch();
    dropTail();
    pauseMedia();
    advanceToken += 1;
    needsReload = true;
    emit({ status: 'unavailable', interrupted: false });
  }

  // --- overlapped handoff ------------------------------------------------------

  function watchHandoff(): void {
    clearHandoffWatch();
    handoffTimer = setInterval(checkHandoff, HANDOFF_POLL_MS);
  }

  /**
   * Near the end of the playing ayah, start the next one on the other channel
   * and let this one's tail fade out. Skipped in an ayah's opening moment (a
   * very short file) and whenever the next item is not known yet: then the
   * plain `ended` path carries on, with a short gap instead of an overlap.
   */
  function checkHandoff(): void {
    if (!session || snapshot.status !== 'playing') return;
    const current = media();
    const remaining = current.duration - current.currentTime;
    if (overlapSeconds <= 0) return;
    if (!Number.isFinite(remaining) || remaining > overlapSeconds) return;
    if (current.currentTime < overlapSeconds) return;
    const nextIndex = snapshot.index + 1;
    if (!session.playlist.items[nextIndex]) return;
    dropTail();
    current.fadeTo(0, Math.max(remaining, 0));
    tail = active;
    active = 1 - active;
    loadItem(nextIndex, { fadeIn: true });
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
    lastProgressTime = media().currentTime;
    if (fadeInPending) {
      fadeInPending = false;
      media().fadeTo(1, VERSE_FADE_IN_SECONDS);
    }
    emit({ status: 'playing', interrupted: false });
    watchHandoff();
    schedulePrefetch(snapshot.index + 1);
  }

  function onPause(channel: number): void {
    if (selfPause[channel]) {
      selfPause[channel] = false;
      return;
    }
    if (channel !== active) return;
    const current = media();
    // The spec fires `pause` just before `ended`; that is not an interruption,
    // and neither is a stale event once `play()` has been called again.
    if (current.ended || !current.paused || !isCurrentSource()) return;
    if (snapshot.status !== 'playing' && snapshot.status !== 'loading') return;
    clearTimers();
    dropTail();
    emit({ status: 'paused', interrupted: true });
  }

  /** The platform silenced the mixer (iOS lock, a call): hold where we are. */
  function onInterrupted(): void {
    if (snapshot.status !== 'playing' && snapshot.status !== 'loading') return;
    clearTimers();
    cancelPrefetch();
    advanceToken += 1;
    dropTail();
    pauseMedia();
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
    const time = media().currentTime;
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
    dropTail();
    if (channels) {
      pauseMedia();
      channels[active]!.removeAttribute('src');
      channels[active]!.load();
      channels[active]!.fadeTo(1, 0);
    }
    active = 0;
    fadeInPending = false;
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
    env.unlock?.();
    session = next;
    overlapSeconds = next.overlapSeconds ?? VERSE_OVERLAP_SECONDS;
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
    dropTail();
    pauseMedia();
    emit({ status: 'paused', interrupted: false });
  }

  function resume(): void {
    if (!session || snapshot.status !== 'paused') return;
    env.unlock?.();
    if (pendingAdvance !== undefined) {
      advance(pendingAdvance);
      return;
    }
    const current = audio();
    if (needsReload || !current) {
      loadItem(snapshot.index);
      return;
    }
    const id = (attemptId += 1);
    current.fadeTo(1, 0);
    emit({ status: 'loading', interrupted: false });
    loadTimer = setTimeout(() => failAttempt(id), LOAD_TIMEOUT_MS);
    playElement(current, id);
  }

  function next(): void {
    if (!session || snapshot.status === 'idle' || snapshot.status === 'unavailable')
      return;
    env.unlock?.();
    dropTail();
    advance((pendingAdvance ?? snapshot.index) + 1);
  }

  function previous(): void {
    if (!session || snapshot.status === 'idle' || snapshot.status === 'unavailable')
      return;
    env.unlock?.();
    dropTail();
    const current = audio();
    const loaded = current !== undefined && !needsReload && pendingAdvance === undefined;
    const target = previousTarget(snapshot.index, loaded ? current.currentTime : 0);
    if (target === snapshot.index && loaded && snapshot.status !== 'ended') {
      current.currentTime = 0;
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
      env.unlock?.();
      dropTail();
      loadItem(index);
    },
    stop(owner) {
      if (owner !== undefined && snapshot.owner !== owner) return;
      resetToIdle();
    },
    setOverlap(seconds) {
      if (session) overlapSeconds = seconds;
    },
    acknowledgeUnavailable() {
      if (snapshot.status !== 'unavailable') return;
      if (hasPlayed && snapshot.item) emit({ status: 'paused' });
      else resetToIdle();
    },
  };
}

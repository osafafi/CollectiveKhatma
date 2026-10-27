import type {
  RecitationAudio,
  RecitationAudioEvent,
  RecitationEnvironment,
} from './recitationEngine';

/** Chromium exposes Data Saver here; other engines simply omit it. */
interface NetworkInformation {
  saveData?: boolean;
}

/** Step of the scripted volume ramp where `element.volume` is adjustable. */
const VOLUME_STEP_MS = 16;

/**
 * The real browser behind the recitation engine. Channels are created only on
 * the first start, so mounting the provider (twice, under StrictMode) and every
 * test that never presses play leave the DOM's media untouched.
 *
 * Fades ramp `element.volume` where the platform lets script change it. iOS
 * does not (volume is read-only there), so on iOS each channel is routed
 * through one shared Web Audio context and fades ramp a gain node instead.
 * That route needs `crossOrigin="anonymous"` — both audio hosts allow it, and
 * a host that did not would fail loudly into the usual fallback rather than
 * play silence. Elsewhere no `crossOrigin` is set: playback never depends on
 * CORS, only the optional prefetch does.
 */
let mixer: AudioContext | undefined;
let mixerUnavailable = false;
let volumeAdjustable: boolean | undefined;
const interruptionListeners = new Set<() => void>();

function canAdjustVolume(): boolean {
  if (volumeAdjustable === undefined) {
    const probe = new Audio();
    probe.volume = 0.5;
    volumeAdjustable = probe.volume === 0.5;
  }
  return volumeAdjustable;
}

function sharedMixer(): AudioContext | undefined {
  if (mixer || mixerUnavailable) return mixer;
  const Context =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) {
    mixerUnavailable = true;
    return undefined;
  }
  try {
    const created = new Context();
    let running = created.state === 'running';
    created.addEventListener('statechange', () => {
      const nowRunning = created.state === 'running';
      // The app never suspends the mixer itself, so leaving `running` is the
      // platform's doing: a lock screen, a call, another app taking audio.
      if (running && !nowRunning)
        for (const listener of interruptionListeners) listener();
      running = nowRunning;
    });
    mixer = created;
    // Created inside the member's first tap; resuming here is what unlocks it.
    if (created.state !== 'running') void created.resume().catch(() => undefined);
  } catch {
    mixerUnavailable = true;
  }
  return mixer;
}

function channel(element: HTMLAudioElement, gain: GainNode | undefined): RecitationAudio {
  let ramp: ReturnType<typeof setInterval> | undefined;

  const fadeVolume = (level: number, seconds: number): void => {
    if (ramp !== undefined) clearInterval(ramp);
    ramp = undefined;
    if (seconds <= 0) {
      element.volume = level;
      return;
    }
    const from = element.volume;
    const startedAt = performance.now();
    ramp = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
      element.volume = from + (level - from) * progress;
      if (progress >= 1 && ramp !== undefined) {
        clearInterval(ramp);
        ramp = undefined;
      }
    }, VOLUME_STEP_MS);
  };

  const fadeGain = (node: GainNode, level: number, seconds: number): void => {
    const now = node.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    if (seconds <= 0) node.gain.setValueAtTime(level, now);
    else node.gain.linearRampToValueAtTime(level, now + seconds);
  };

  return {
    get src() {
      return element.src;
    },
    set src(value: string) {
      element.src = value;
    },
    get currentTime() {
      return element.currentTime;
    },
    set currentTime(value: number) {
      element.currentTime = value;
    },
    get duration() {
      return element.duration;
    },
    get paused() {
      return element.paused;
    },
    get ended() {
      return element.ended;
    },
    play: () => element.play(),
    pause: () => element.pause(),
    load: () => element.load(),
    removeAttribute: (name) => element.removeAttribute(name),
    addEventListener: (type: RecitationAudioEvent, listener: () => void) =>
      element.addEventListener(type, listener),
    fadeTo: (level, seconds) =>
      gain ? fadeGain(gain, level, seconds) : fadeVolume(level, seconds),
  };
}

export const browserRecitationEnvironment: RecitationEnvironment = {
  createAudio() {
    const element = new Audio();
    element.preload = 'auto';
    if (canAdjustVolume()) return channel(element, undefined);
    const context = sharedMixer();
    // No Web Audio at all: the overlap still happens, only without the fade.
    if (!context) return channel(element, undefined);
    element.crossOrigin = 'anonymous';
    const gain = context.createGain();
    context.createMediaElementSource(element).connect(gain).connect(context.destination);
    return channel(element, gain);
  },

  unlock() {
    // Only an existing mixer needs it; resuming inside the tap is what iOS asks.
    if (mixer && mixer.state !== 'running') void mixer.resume().catch(() => undefined);
  },

  onInterrupted(listener) {
    interruptionListeners.add(listener);
  },

  fetch: (url, init) => fetch(url, init),

  createObjectURL: (blob) => URL.createObjectURL(blob),

  revokeObjectURL: (url) => URL.revokeObjectURL(url),

  isOnline: () => typeof navigator === 'undefined' || navigator.onLine,

  savesData: () =>
    typeof navigator !== 'undefined' &&
    Boolean(
      (navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData,
    ),
};

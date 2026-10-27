import type { RecitationAudio, RecitationEnvironment } from './recitationEngine';

/** Chromium exposes Data Saver here; other engines simply omit it. */
interface NetworkInformation {
  saveData?: boolean;
}

/**
 * The real browser behind the recitation engine. The audio element is created
 * only on the first start, so mounting the provider (twice, under StrictMode)
 * and every test that never presses play leave the DOM's media untouched. No
 * `crossOrigin` attribute: playback never depends on the hosts' CORS headers,
 * only the optional prefetch does.
 */
export const browserRecitationEnvironment: RecitationEnvironment = {
  createAudio() {
    const audio = new Audio();
    audio.preload = 'auto';
    return audio as RecitationAudio;
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

/**
 * Reading font-size scale — 5 discrete levels for the reading views.
 *
 * The chosen level is persisted in localStorage and applied via a
 * `data-reading-scale` attribute on <html>, which the theme CSS
 * (src/theme/theme.css) maps to the `--reading-scale` variable. Reading text
 * (`.quran-text`) sizes itself from that variable.
 *
 * Priority feature for the senior audience (REQUIREMENTS §6).
 */

const STORAGE_KEY = 'khatma.readingScale';

export type ReadingScale = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_READING_SCALE: ReadingScale = 3;

/** The persisted reading scale, or the default if none/invalid. */
export function getReadingScale(): ReadingScale {
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return isReadingScale(raw) ? raw : DEFAULT_READING_SCALE;
}

/** Persist and apply a reading scale. */
export function setReadingScale(scale: ReadingScale): void {
  document.documentElement.dataset.readingScale = String(scale);
  localStorage.setItem(STORAGE_KEY, String(scale));
}

/** Apply the persisted scale on app startup. */
export function initReadingScale(): void {
  setReadingScale(getReadingScale());
}

function isReadingScale(n: number): n is ReadingScale {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

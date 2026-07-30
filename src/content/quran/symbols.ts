/** Rendering helpers for Quranic symbols. Pure — no DOM. */

/** Format a number with the app-wide Western digits (e.g. 255 -> "255"). */
export function toWesternDigits(n: number): string {
  return String(n);
}

/**
 * The end-of-ayah marker: U+06DD (۝) followed by the ayah number, which a Quran
 * font (Amiri Quran / KFGQPC) renders as the traditional ornate medallion.
 * Centralized here so the exact glyph treatment is tunable in one place.
 */
export function ayahEndMarker(ayah: number): string {
  return `۝${toWesternDigits(ayah)}`;
}

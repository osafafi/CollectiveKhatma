/** Rendering helpers for Quranic symbols. Pure — no DOM. */

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Convert a number to Arabic-Indic digits (e.g. 255 -> "٢٥٥"). */
export function toArabicDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}

/**
 * The end-of-ayah marker: U+06DD (۝) followed by the ayah number, which a Quran
 * font (Amiri Quran / KFGQPC) renders as the traditional ornate medallion.
 * Centralized here so the exact glyph treatment is tunable in one place.
 */
export function ayahEndMarker(ayah: number): string {
  return `۝${toArabicDigits(ayah)}`;
}

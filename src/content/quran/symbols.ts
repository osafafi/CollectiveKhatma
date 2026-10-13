/** Rendering helpers for Quranic symbols. Pure — no DOM. */

/** Format a number with the app-wide Western digits (e.g. 255 -> "255"). */
export function toWesternDigits(n: number): string {
  return String(n);
}

/** Compress page numbers into exact sorted Western-digit runs: "1–3، 5". */
export function formatPageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length;) {
    const start = sorted[i]!;
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) {
      end = sorted[++i]!;
    }
    ranges.push(
      start === end
        ? toWesternDigits(start)
        : `${toWesternDigits(start)}–${toWesternDigits(end)}`,
    );
    i++;
  }
  return ranges.join('، ');
}

/**
 * The end-of-ayah marker: U+06DD (۝) followed by the ayah number, which a Quran
 * font (Amiri Quran / KFGQPC) renders as the traditional ornate medallion.
 * Centralized here so the exact glyph treatment is tunable in one place.
 */
export function ayahEndMarker(ayah: number): string {
  return `۝${toWesternDigits(ayah)}`;
}

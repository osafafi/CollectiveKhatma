import { toWesternDigits } from '@/content/quran/symbols';

/** Match the legacy progress helper's determinate 0–100 bounds. */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

/** Format a bounded whole percentage with Western digits. */
export function formatPercent(value: number): string {
  return `${toWesternDigits(Math.round(clampPercent(value)))}٪`;
}

import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { RoundChunk } from '@/domain/types';

/** Count plus first-last page numbers for one assigned chunk. */
export function chunkSpan(chunk: RoundChunk): string {
  const count = chunk.pages.length;
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  const first = chunk.pages[0];
  const last = chunk.pages[count - 1];
  const span =
    first === undefined || last === undefined || first === last
      ? toArabicDigits(first ?? 0)
      : `${toArabicDigits(first)}–${toArabicDigits(last)}`;
  return `${toArabicDigits(count)} ${word} (${span})`;
}

/** Clamp a text numeric field to a non-negative integer. */
export function toCount(value: string): number {
  return Math.max(0, parseInt(value, 10) || 0);
}

/** Local midnight of a YYYY-MM-DD string as epoch ms, or undefined if invalid. */
export function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Epoch ms to local YYYY-MM-DD for a date input. */
export function dateToInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

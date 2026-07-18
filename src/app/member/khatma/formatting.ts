import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';

export function formatIsoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function formatCompletedDate(timestamp: number | undefined): string {
  return timestamp ? formatIsoDate(timestamp) : '—';
}

export function pagesCount(count: number): string {
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return `${toArabicDigits(count)} ${word}`;
}

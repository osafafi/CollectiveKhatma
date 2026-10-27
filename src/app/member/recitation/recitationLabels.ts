import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { RecitationItem } from './recitationPlaylist';

/** "البقرة · 255", or "البقرة · البسملة" while a surah's basmala plays. */
export function verseLabel(item: RecitationItem, surahName: string | undefined): string {
  const ayah =
    item.kind === 'basmala' ? strings.recitation.basmala : toWesternDigits(item.ayah);
  return strings.recitation.verseLabel
    .replace('{surah}', surahName ?? '')
    .replace('{ayah}', ayah);
}

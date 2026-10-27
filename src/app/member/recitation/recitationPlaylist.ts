import { PREVIEW_REF } from '@/content/quran/recitation';

/**
 * One thing the player recites: a numbered ayah, or the basmala the reciter
 * says before a surah's first ayah. A basmala item carries `ayah: 1` and that
 * ayah's page, so it highlights and follows exactly like the ayah it opens.
 */
export interface RecitationItem {
  kind: 'basmala' | 'ayah';
  surah: number;
  ayah: number;
  page: number;
}

/**
 * The play order, known so far. `items` is what can be played synchronously
 * (from a user tap, which iOS requires); `ensure` resolves a later index,
 * loading further pages if the playlist grows lazily, or `undefined` past its
 * end.
 */
export interface RecitationPlaylist {
  readonly items: readonly RecitationItem[];
  /** True once `items` holds everything, so the end is known without waiting. */
  readonly complete: boolean;
  ensure(index: number): Promise<RecitationItem | undefined>;
}

/** Seconds into an item before "previous" restarts it instead of stepping back. */
export const RESTART_THRESHOLD_SECONDS = 2;

/**
 * The music-app back rule: early in an item, step to the one before (or stay
 * on the first); once past the threshold, restart the current item.
 */
export function previousTarget(index: number, currentTime: number): number {
  return currentTime < RESTART_THRESHOLD_SECONDS ? Math.max(index - 1, 0) : index;
}

/** Stable key for an item: `S:A` for an ayah, `b:S` for a surah's basmala. */
export function itemKey(item: RecitationItem): string {
  return item.kind === 'basmala' ? `b:${item.surah}` : `${item.surah}:${item.ayah}`;
}

export function staticPlaylist(items: readonly RecitationItem[]): RecitationPlaylist {
  return {
    items,
    complete: true,
    ensure: (index) => Promise.resolve(items[index]),
  };
}

/** The single-ayah Settings preview: Ayat al-Kursi. */
export function previewPlaylist(): RecitationPlaylist {
  return staticPlaylist([{ kind: 'ayah', ...PREVIEW_REF }]);
}

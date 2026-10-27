import { PREVIEW_REF } from '@/content/quran/recitation';
import type { QuranPage, Surah } from '@/content/quran/types';

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

/** Al-Fatiha 1–4: short ayat, so the overlap setting is heard three times. */
export function transitionPreviewPlaylist(): RecitationPlaylist {
  return staticPlaylist(
    [1, 2, 3, 4].map((ayah) => ({ kind: 'ayah', surah: 1, ayah, page: 1 })),
  );
}

/** The single-ayah Settings preview: Ayat al-Kursi. */
export function previewPlaylist(): RecitationPlaylist {
  return staticPlaylist([{ kind: 'ayah', ...PREVIEW_REF }]);
}

/**
 * A page's play order: each ayah, with the basmala item in front of a surah's
 * first ayah whenever the mushaf shows a bismillah line there (every surah but
 * Al-Fatiha, whose basmala is its first ayah, and At-Tawbah, which has none).
 */
export function pageRecitationItems(
  page: QuranPage,
  surahsById: ReadonlyMap<number, Surah>,
): RecitationItem[] {
  const items: RecitationItem[] = [];
  for (const ayah of page.ayat) {
    if (ayah.ayah === 1 && surahsById.get(ayah.surah)?.bismillahPre) {
      items.push({ kind: 'basmala', surah: ayah.surah, ayah: 1, page: page.page });
    }
    items.push({ kind: 'ayah', surah: ayah.surah, ayah: ayah.ayah, page: page.page });
  }
  return items;
}

/**
 * Where playback starts for a tapped key: the ayah itself, or the basmala in
 * front of it when the tap lands on a surah's first ayah.
 */
export function startIndexFor(items: readonly RecitationItem[], key: string): number {
  const index = items.findIndex((item) => itemKey(item) === key);
  if (index < 1) return Math.max(index, 0);
  const before = items[index - 1]!;
  const item = items[index]!;
  return before.kind === 'basmala' && before.surah === item.surah ? index - 1 : index;
}

export interface PagePlaylistOptions {
  /** Pages in play order; the first is `seed`'s page. */
  pages: readonly number[];
  /** The first page, already loaded, so playback can start inside a tap. */
  seed: QuranPage;
  surahsById: ReadonlyMap<number, Surah>;
  loadPage: (page: number) => Promise<QuranPage>;
  /** Stop after this surah's last ayah (the free-browse reader). */
  stopAfterSurah?: number;
}

/**
 * A playlist over a page list that loads one page ahead at a time. The seeded
 * page is available at once; later pages are read only as playback (or its
 * prefetch) reaches them. Assigned and Wird readers play to the end of their
 * page list; the browse reader stops at the end of a surah, mid-page if need be.
 */
export function createPagePlaylist({
  pages,
  seed,
  surahsById,
  loadPage,
  stopAfterSurah,
}: PagePlaylistOptions): RecitationPlaylist {
  const items: RecitationItem[] = [];
  const lastAyah =
    stopAfterSurah === undefined
      ? undefined
      : surahsById.get(stopAfterSurah)?.versesCount;
  let nextPage = 1;
  let complete = false;
  let pending: Promise<void> | undefined;

  const append = (page: QuranPage): void => {
    for (const item of pageRecitationItems(page, surahsById)) {
      if (stopAfterSurah !== undefined && item.surah > stopAfterSurah) {
        complete = true;
        return;
      }
      items.push(item);
      if (
        item.surah === stopAfterSurah &&
        item.kind === 'ayah' &&
        item.ayah === lastAyah
      ) {
        complete = true;
        return;
      }
    }
    if (nextPage >= pages.length) complete = true;
  };

  const loadNext = (): Promise<void> => {
    pending ??= (async () => {
      const page = pages[nextPage];
      if (page === undefined) {
        complete = true;
        return;
      }
      const data = await loadPage(page);
      nextPage += 1;
      append(data);
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };

  append(seed);

  return {
    items,
    get complete() {
      return complete;
    },
    async ensure(index) {
      while (index >= items.length && !complete) await loadNext();
      return items[index];
    },
  };
}

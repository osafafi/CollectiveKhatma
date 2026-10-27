import { useEffect, useState } from 'react';
import { getPage, getSurahs } from '@/content/quran/loader';
import type { QuranPage, Surah } from '@/content/quran/types';

export type LoadedQuranPage =
  | { page: number; status: 'loading' }
  | { page: number; status: 'error' }
  | {
      page: number;
      status: 'ready';
      data: QuranPage;
      surahsById: ReadonlyMap<number, Surah>;
      firstSurah: Surah | undefined;
    };

/**
 * Load one mushaf page with the surah table. Loading is derived from whether
 * the settled result matches the requested page, so the effect only calls
 * setState from its async callbacks. The `active` flag plus the page match are
 * the stale-navigation guard: a newer navigation always wins.
 *
 * The reader owns this (rather than the page body) so recitation can start
 * from the visible page synchronously inside the member's tap.
 */
export function useQuranPage(page: number): LoadedQuranPage {
  const [loaded, setLoaded] = useState<LoadedQuranPage | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getPage(page), getSurahs()])
      .then(([data, surahs]) => {
        if (!active) return;
        const surahsById = new Map(
          surahs.map((surah): [number, Surah] => [surah.id, surah]),
        );
        const firstSurahId = data.surahIds[0];
        setLoaded({
          page,
          status: 'ready',
          data,
          surahsById,
          firstSurah:
            firstSurahId === undefined ? undefined : surahsById.get(firstSurahId),
        });
      })
      .catch(() => {
        if (active) setLoaded({ page, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [page]);

  return loaded && loaded.page === page ? loaded : { page, status: 'loading' };
}

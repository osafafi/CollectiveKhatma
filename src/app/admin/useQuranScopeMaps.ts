import { useEffect, useState } from 'react';
import { getQuranIndex } from '@/content/quran/loader';
import { buildPageUnitMaps, type PageUnitMaps } from '@/domain/assignment';

/** Surah/juz page data distribution needs: scope resolution + whole-unit serving. */
export interface QuranScopeMaps {
  /** surah id -> `[firstPage, lastPage]`, for resolving a `chapters` scope pool. */
  surahToPages: Record<number, [number, number]>;
  /** page -> Surah / page -> Juz, for specific whole-unit selections. */
  pageUnitMaps: PageUnitMaps;
}

/**
 * Load the surah/juz maps distribution relies on by fetching the Quran index
 * once and deriving the page-unit maps.
 *
 * Returns `null` until the (cached) fetch resolves, and stays `null` if it fails.
 * That matches the legacy failure behavior: `full`/`range` distributions still
 * work (they need no maps), while a `chapters` scope surfaces `distributeError`
 * because `resolvePageScope` cannot resolve without `surahToPages`.
 */
export function useQuranScopeMaps(): QuranScopeMaps | null {
  const [maps, setMaps] = useState<QuranScopeMaps | null>(null);

  useEffect(() => {
    let active = true;
    getQuranIndex()
      .then((index) => {
        if (!active) return;
        setMaps({
          surahToPages: index.surahToPages,
          pageUnitMaps: buildPageUnitMaps(index.surahToPages, index.juzToPages),
        });
      })
      .catch(() => {
        // Left null; distribution degrades exactly as the legacy boot-load failure.
      });
    return () => {
      active = false;
    };
  }, []);

  return maps;
}

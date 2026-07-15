import { useEffect, useState } from 'react';
import { getSurahs } from '@/content/quran/loader';
import type { Surah } from '@/content/quran/types';

/**
 * Load the 114 surahs (Arabic names + page spans) once for the admin's
 * name-based pickers.
 *
 * Returns `null` until the (cached) fetch resolves and stays `null` if it fails,
 * matching the legacy behavior: the surah checklist and the surah-name capacity
 * selects show `common.loading` / no options until the data arrives, and the
 * rest of the create/detail form still works.
 */
export function useSurahs(): Surah[] | null {
  const [surahs, setSurahs] = useState<Surah[] | null>(null);

  useEffect(() => {
    let active = true;
    getSurahs()
      .then((loaded) => {
        if (active) setSurahs(loaded);
      })
      .catch(() => {
        // Left null; the name pickers degrade exactly as the legacy boot-load failure.
      });
    return () => {
      active = false;
    };
  }, []);

  return surahs;
}

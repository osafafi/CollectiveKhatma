/**
 * Series helpers (REQUIREMENTS §5): khatmas belong to a named series
 * ("أهل القرآن 1", "… 2", …). Pure selectors over the full khatma list, shared
 * by both apps.
 */

import type { Khatma } from './types';

export interface SeriesGroup {
  seriesId: string;
  seriesName: string;
  /** The series' active khatmas, oldest first (1 or 2 — they overlap at rollover). */
  active: Khatma[];
  /** The newest active khatma — the one members/rollover metadata key off. */
  latest: Khatma;
}

/** Group the ACTIVE khatmas by series, newest series first. */
export function activeSeriesGroups(khatmas: readonly Khatma[]): SeriesGroup[] {
  const bySeries = new Map<string, Khatma[]>();
  for (const k of khatmas) {
    if (k.status !== 'active') continue;
    const group = bySeries.get(k.seriesId);
    if (group) group.push(k);
    else bySeries.set(k.seriesId, [k]);
  }
  const groups: SeriesGroup[] = [];
  for (const active of bySeries.values()) {
    active.sort((a, b) => a.seriesNumber - b.seriesNumber);
    const latest = active[active.length - 1];
    if (!latest) continue;
    groups.push({ seriesId: latest.seriesId, seriesName: latest.seriesName, active, latest });
  }
  return groups.sort((a, b) => b.latest.createdAt - a.latest.createdAt);
}

/** The series' completed khatmas, most recently completed first (the history list). */
export function completedInSeries(khatmas: readonly Khatma[], seriesId: string): Khatma[] {
  return khatmas
    .filter((k) => k.seriesId === seriesId && k.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
}

/** The next number for a series (max existing + 1; 1 for a brand-new series). */
export function nextSeriesNumber(khatmas: readonly Khatma[], seriesId: string): number {
  let max = 0;
  for (const k of khatmas) {
    if (k.seriesId === seriesId && k.seriesNumber > max) max = k.seriesNumber;
  }
  return max + 1;
}

/**
 * Find an existing series by (normalized) name — creating a khatma with a name
 * that matches an existing series continues that series instead of starting a
 * new one (REQUIREMENTS §5).
 */
export function findSeriesByName(
  khatmas: readonly Khatma[],
  name: string,
): { seriesId: string; seriesName: string } | undefined {
  const wanted = name.trim();
  const match = khatmas.find((k) => k.seriesName.trim() === wanted);
  return match ? { seriesId: match.seriesId, seriesName: match.seriesName } : undefined;
}

/** Display title: "seriesName seriesNumber" (number rendered by the caller's digits helper). */
export function seriesTitle(
  k: Pick<Khatma, 'seriesName' | 'seriesNumber'>,
  digits: (n: number) => string,
): string {
  return `${k.seriesName} ${digits(k.seriesNumber)}`;
}

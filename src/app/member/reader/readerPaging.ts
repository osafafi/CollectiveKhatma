import { getPage } from '@/content/quran/loader';
import { TOTAL_QURAN_PAGES } from '@/app/persistence';

/**
 * Pure paging helpers shared by the two React mushaf readers. Kept in a plain
 * module (not the component file) so fast refresh stays component-only.
 */

export const TOTAL_PAGES = TOTAL_QURAN_PAGES;

/** Clamp any page number into the readable mushaf range. */
export function clampPage(page: number): number {
  return Math.max(1, Math.min(TOTAL_PAGES, Math.round(page)));
}

/** True for a whole page number inside the readable mushaf range. */
export function isReadablePage(page: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES;
}

/** Clamp an index into a page list, mirroring the legacy reader. */
export function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

/** Warm the neighbouring pages so prev/next feels instant (loader caches). */
export function prefetchNeighbors(pages: readonly number[], index: number): void {
  const current = pages[index] ?? 1;
  void getPage(pages[index + 1] ?? current);
  void getPage(pages[index - 1] ?? current);
}

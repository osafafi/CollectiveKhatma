import { describe, expect, it } from 'vitest';
import {
  ayahEndMarker,
  formatPageRanges,
  toWesternDigits,
} from '@/content/quran/symbols';

describe('Quran symbol formatting', () => {
  it('uses Western digits for app numbers and ayah markers', () => {
    expect(toWesternDigits(255)).toBe('255');
    expect(ayahEndMarker(12)).toBe('۝12');
  });

  it('compresses page numbers into sorted exact runs', () => {
    expect(formatPageRanges([5, 1, 2, 3, 3, 9, 10])).toBe('1–3، 5، 9–10');
    expect(formatPageRanges([7])).toBe('7');
    expect(formatPageRanges([])).toBe('');
  });
});

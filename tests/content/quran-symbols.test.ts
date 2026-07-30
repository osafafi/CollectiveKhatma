import { describe, expect, it } from 'vitest';
import { ayahEndMarker, toWesternDigits } from '@/content/quran/symbols';

describe('Quran symbol formatting', () => {
  it('uses Western digits for app numbers and ayah markers', () => {
    expect(toWesternDigits(255)).toBe('255');
    expect(ayahEndMarker(12)).toBe('۝12');
  });
});

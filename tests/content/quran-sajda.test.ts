import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitSajdaPhrase } from '@/content/quran/sajda';
import type { QuranPage } from '@/content/quran/types';

describe('sajda phrases in the committed Quran', () => {
  it('overlines exactly the 15 requested phrases and preserves every text character', () => {
    const found: Record<string, string> = {};
    for (let page = 1; page <= 604; page++) {
      const data = JSON.parse(
        readFileSync(
          resolve(`public/quran/pages/${String(page).padStart(3, '0')}.json`),
          'utf8',
        ),
      ) as QuranPage;
      for (const ayah of data.ayat) {
        const split = splitSajdaPhrase(ayah);
        if (!split) continue;
        const key = `${ayah.surah}:${ayah.ayah}`;
        expect(found[key]).toBeUndefined();
        found[key] = split.phrase;
        expect(split.before + split.phrase + split.after).toBe(ayah.text);
        expect(split.phrase).not.toContain('۩');
      }
    }
    expect(found).toEqual({
      '96:19': 'وَٱسْجُدْ',
      '84:21': 'يَسْجُدُونَ',
      '53:62': 'فَٱسْجُدُوا۟ لِلَّهِ',
      '41:37': 'وَٱسْجُدُوا۟ لِلَّهِ',
      '38:24': 'وَخَرَّ رَاكِعًا',
      '27:25': 'أَلَّا يَسْجُدُوا۟',
      '32:15': 'خَرُّوا۟ سُجَّدًا',
      '25:60': 'ٱسْجُدُوا۟',
      '22:18': 'يَسْجُدُ لَهُۥ',
      '22:77': 'وَٱسْجُدُوا۟',
      '19:58': 'خَرُّوا۟ سُجَّدًا',
      '16:49': 'وَلِلَّهِ يَسْجُدُ',
      '7:206': 'يَسْجُدُونَ',
      '13:15': 'وَلِلَّهِ يَسْجُدُ',
      '17:107': 'يَخِرُّونَ لِلْأَذْقَانِ سُجَّدًا',
    });
  });

  it('leaves unrelated verses and missing matches untouched', () => {
    expect(splitSajdaPhrase({ surah: 2, ayah: 58, text: 'ٱسْجُدُوا۟' })).toBeNull();
    expect(splitSajdaPhrase({ surah: 96, ayah: 19, text: 'fixture text' })).toBeNull();
  });
});

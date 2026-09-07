import type { Ayah } from './types';

// Exact phrases in the bundled Uthmani text. These locations are independent
// of the sajda icon/flag: e.g. 16:49 is overlined while 16:50 holds the icon.
// The bundled text uses ordinary fathatan in سُجَّدًا / رَاكِعًا.
const SAJDA_PHRASES: Readonly<Record<string, string>> = {
  '7:206': 'يَسْجُدُونَ',
  '13:15': 'وَلِلَّهِ يَسْجُدُ',
  '16:49': 'وَلِلَّهِ يَسْجُدُ',
  '17:107': 'يَخِرُّونَ لِلْأَذْقَانِ سُجَّدًا',
  '19:58': 'خَرُّوا۟ سُجَّدًا',
  '22:18': 'يَسْجُدُ لَهُۥ',
  '22:77': 'وَٱسْجُدُوا۟',
  '25:60': 'ٱسْجُدُوا۟',
  '27:25': 'أَلَّا يَسْجُدُوا۟',
  '32:15': 'خَرُّوا۟ سُجَّدًا',
  '38:24': 'وَخَرَّ رَاكِعًا',
  '41:37': 'وَٱسْجُدُوا۟ لِلَّهِ',
  '53:62': 'فَٱسْجُدُوا۟ لِلَّهِ',
  '84:21': 'يَسْجُدُونَ',
  '96:19': 'وَٱسْجُدْ',
};

/** Split without changing any Quran text, diacritics, spacing, or symbols. */
export function splitSajdaPhrase(ayah: Ayah) {
  const phrase = SAJDA_PHRASES[`${ayah.surah}:${ayah.ayah}`];
  if (!phrase) return null;
  const start = ayah.text.indexOf(phrase);
  if (start === -1) return null;
  return {
    before: ayah.text.slice(0, start),
    phrase,
    after: ayah.text.slice(start + phrase.length),
  };
}

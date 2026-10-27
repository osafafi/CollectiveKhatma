import { describe, expect, it } from 'vitest';
import {
  ayahAudioUrls,
  clampVerseOverlapMs,
  DEFAULT_QARI_ID,
  isQariId,
  QARIS,
} from '@/content/quran/recitation';
import { strings } from '@/content/strings.ar';

describe('recitation catalog', () => {
  it('lists fifteen distinct voices with Alafasy as the default', () => {
    expect(QARIS).toHaveLength(15);
    expect(new Set(QARIS.map((qari) => qari.id)).size).toBe(15);
    expect(new Set(QARIS.map((qari) => qari.folder)).size).toBe(15);
    expect(DEFAULT_QARI_ID).toBe('alafasy');
    expect(isQariId('alafasy')).toBe(true);
    expect(isQariId('Alafasy_128kbps')).toBe(false);
    expect(isQariId(null)).toBe(false);
  });

  it('names every voice in Arabic', () => {
    for (const qari of QARIS) {
      expect(strings.recitation.qariNames[qari.id]).toMatch(/\p{Script=Arabic}/u);
    }
  });

  it('builds zero-padded EveryAyah URLs with the mirror as fallback', () => {
    expect(ayahAudioUrls('alafasy', 2, 255)).toEqual([
      'https://everyayah.com/data/Alafasy_128kbps/002255.mp3',
      'https://mirrors.quranicaudio.com/everyayah/Alafasy_128kbps/002255.mp3',
    ]);
    expect(ayahAudioUrls('husary', 114, 6)[0]).toBe(
      'https://everyayah.com/data/Husary_128kbps/114006.mp3',
    );
  });

  it('keeps a tuned overlap on its 25ms steps between 0 and 600ms', () => {
    expect(clampVerseOverlapMs(212)).toBe(200);
    expect(clampVerseOverlapMs(-40)).toBe(0);
    expect(clampVerseOverlapMs(5000)).toBe(600);
  });

  it('offers no mirror for the folders QuranicAudio does not carry', () => {
    const withoutMirror = QARIS.filter((qari) => !qari.mirror).map((qari) => qari.id);
    expect(withoutMirror).toEqual(['maher', 'qatami', 'ajmi']);
    expect(ayahAudioUrls('maher', 1, 1)).toEqual([
      'https://everyayah.com/data/MaherAlMuaiqly128kbps/001001.mp3',
    ]);
  });
});

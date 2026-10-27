import { describe, expect, it } from 'vitest';
import { basePathOnly, quranDatasetRoute } from '../../scripts/sw-routes';

const PROJECT_BASE = '/CollectiveKhatma/';
const ORIGIN = 'https://example.test';

describe('service worker route patterns', () => {
  it('matches every mushaf file under the deployed base path', () => {
    const route = quranDatasetRoute(PROJECT_BASE);

    expect(route.test(`${ORIGIN}${PROJECT_BASE}quran/pages/001.json`)).toBe(true);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}quran/pages/604.json`)).toBe(true);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}quran/surahs.json`)).toBe(true);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}quran/index.json`)).toBe(true);
  });

  it('leaves the shell, the icons, and the hidden admin entry to their own routes', () => {
    const route = quranDatasetRoute(PROJECT_BASE);

    expect(route.test(`${ORIGIN}${PROJECT_BASE}assets/member-a1b2c3.js`)).toBe(false);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}manifest.webmanifest`)).toBe(false);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}admin-nano.html`)).toBe(false);
    expect(route.test(`${ORIGIN}${PROJECT_BASE}`)).toBe(false);
  });

  it('stays scoped to the base path, so a project deploy ignores root-served copies', () => {
    expect(quranDatasetRoute(PROJECT_BASE).test(`${ORIGIN}/quran/pages/001.json`)).toBe(
      false,
    );
    expect(quranDatasetRoute('/').test(`${ORIGIN}/quran/pages/001.json`)).toBe(true);
  });

  it('never caches streamed recitation audio', () => {
    const audio = [
      'https://everyayah.com/data/Alafasy_128kbps/002255.mp3',
      'https://mirrors.quranicaudio.com/everyayah/Alafasy_128kbps/002255.mp3',
    ];
    for (const base of ['/', PROJECT_BASE]) {
      for (const url of audio) expect(quranDatasetRoute(base).test(url)).toBe(false);
    }
  });

  it('allows the navigation fallback on the base path alone', () => {
    const fallback = basePathOnly(PROJECT_BASE);

    expect(fallback.test(PROJECT_BASE)).toBe(true);
    expect(fallback.test(`${PROJECT_BASE}admin-nano.html`)).toBe(false);
    expect(fallback.test('/CollectiveKhatmaX/')).toBe(false);
  });
});

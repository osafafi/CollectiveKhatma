import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createPagePlaylist,
  itemKey,
  pageRecitationItems,
  previousTarget,
  startIndexFor,
} from '@/app/member/recitation/recitationPlaylist';
import type { QuranPage, Surah } from '@/content/quran/types';

const surahs = JSON.parse(
  readFileSync(new URL('../../public/quran/surahs.json', import.meta.url), 'utf-8'),
) as Surah[];
const surahsById: ReadonlyMap<number, Surah> = new Map(
  surahs.map((surah) => [surah.id, surah]),
);

function page(number: number): QuranPage {
  const file = new URL(
    `../../public/quran/pages/${String(number).padStart(3, '0')}.json`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(file, 'utf-8')) as QuranPage;
}

const keys = (number: number) =>
  pageRecitationItems(page(number), surahsById).map(itemKey);

describe('recitation play order', () => {
  it('adds a basmala before every surah start except Al-Fatiha and At-Tawbah', () => {
    expect(keys(1)[0]).toBe('1:1');
    expect(keys(1)).not.toContain('b:1');
    expect(keys(2).slice(0, 2)).toEqual(['b:2', '2:1']);
    expect(keys(187)).toContain('9:1');
    expect(keys(187)).not.toContain('b:9');
    expect(keys(604).filter((key) => key.startsWith('b:'))).toEqual([
      'b:112',
      'b:113',
      'b:114',
    ]);
  });

  it('gives the basmala its ayah-1 page so it follows and highlights the same way', () => {
    const [basmala] = pageRecitationItems(page(2), surahsById);
    expect(basmala).toEqual({ kind: 'basmala', surah: 2, ayah: 1, page: 2 });
  });

  it('starts a tapped first ayah from its basmala', () => {
    const items = pageRecitationItems(page(604), surahsById);
    expect(itemKey(items[startIndexFor(items, '113:1')]!)).toBe('b:113');
    expect(itemKey(items[startIndexFor(items, '113:2')]!)).toBe('113:2');
    expect(startIndexFor(items, 'missing')).toBe(0);
  });

  it('applies the two-second back rule', () => {
    expect(previousTarget(3, 1.9)).toBe(2);
    expect(previousTarget(3, 2)).toBe(3);
    expect(previousTarget(0, 0.5)).toBe(0);
  });
});

describe('page playlists', () => {
  it('stops the browse reader at the end of the surah it started in, mid-page', async () => {
    const loadPage = vi.fn((number: number) => Promise.resolve(page(number)));
    const playlist = createPagePlaylist({
      pages: [604],
      seed: page(604),
      surahsById,
      loadPage,
      stopAfterSurah: 112,
    });

    expect(playlist.items.map(itemKey)).toEqual([
      'b:112',
      '112:1',
      '112:2',
      '112:3',
      '112:4',
    ]);
    expect(playlist.complete).toBe(true);
    expect(await playlist.ensure(5)).toBeUndefined();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it('loads only as far as the surah end when it spans pages', async () => {
    const loadPage = vi.fn((number: number) => Promise.resolve(page(number)));
    const playlist = createPagePlaylist({
      pages: [48, 49, 50, 51],
      seed: page(48),
      surahsById,
      loadPage,
      stopAfterSurah: 2,
    });

    expect(playlist.items.map(itemKey)).toEqual(['2:282']);
    expect(playlist.complete).toBe(false);
    expect(await playlist.ensure(4)).toMatchObject({ surah: 2, ayah: 286, page: 49 });
    expect(await playlist.ensure(5)).toBeUndefined();
    expect(playlist.complete).toBe(true);
    expect(loadPage.mock.calls.map(([number]) => number)).toEqual([49]);
  });

  it('walks a non-contiguous page list in order to its end', async () => {
    const loadPage = vi.fn((number: number) => Promise.resolve(page(number)));
    const playlist = createPagePlaylist({
      pages: [48, 50],
      seed: page(48),
      surahsById,
      loadPage,
    });

    expect(await playlist.ensure(1)).toEqual({
      kind: 'basmala',
      surah: 3,
      ayah: 1,
      page: 50,
    });
    expect(playlist.items.at(-1)).toMatchObject({ surah: 3, ayah: 9 });
    expect(playlist.complete).toBe(true);
    expect(loadPage.mock.calls.map(([number]) => number)).toEqual([50]);
  });

  it('loads each page once however many callers wait on it', async () => {
    const loadPage = vi.fn((number: number) => Promise.resolve(page(number)));
    const playlist = createPagePlaylist({
      pages: [48, 49],
      seed: page(48),
      surahsById,
      loadPage,
    });
    await Promise.all([playlist.ensure(1), playlist.ensure(2), playlist.ensure(3)]);
    expect(loadPage).toHaveBeenCalledTimes(1);
  });
});

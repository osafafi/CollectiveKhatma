/**
 * Build the bundled Quran dataset — the Madinah (King Fahd / KFGQPC) mushaf,
 * Hafs Uthmani text — by fetching once from the quran.com API (QDC) and writing
 * committed JSON under `public/quran/`. Run once (or to refresh):
 *
 *   npm run build:quran
 *
 * Output (served as static assets, fetched at runtime by loader.ts):
 *   public/quran/pages/001.json .. 604.json   (one QuranPage each)
 *   public/quran/surahs.json                  (Surah[] metadata)
 *   public/quran/index.json                   (QuranIndex)
 *
 * Text source: api.quran.com v4 (KFGQPC/Tanzil Uthmani). Community, non-
 * commercial use — keep attribution. See README "Quran data".
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Ayah, QuranIndex, QuranPage, Surah } from '../src/content/quran/types';

const API = 'https://api.quran.com/api/v4';
const OUT = join(import.meta.dirname, '..', 'public', 'quran');

interface ApiChapter {
  id: number;
  name_arabic: string;
  pages: [number, number];
  verses_count: number;
  bismillah_pre: boolean;
  revelation_place: 'makkah' | 'madinah';
}

interface ApiVerse {
  verse_key: string; // "2:255"
  verse_number: number; // ayah within surah
  text_uthmani: string;
  page_number: number;
  juz_number: number;
  sajdah_number: number | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, tries = 4): Promise<T> {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(500 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function fetchChapters(): Promise<ApiChapter[]> {
  const data = await getJson<{ chapters: ApiChapter[] }>(`${API}/chapters?language=ar`);
  return data.chapters;
}

async function fetchAllVerses(): Promise<ApiVerse[]> {
  const verses: ApiVerse[] = [];
  for (let ch = 1; ch <= 114; ch++) {
    let page = 1;
    for (;;) {
      const url = `${API}/verses/by_chapter/${ch}?language=ar&fields=text_uthmani&per_page=50&page=${page}`;
      const data = await getJson<{
        verses: ApiVerse[];
        pagination: { next_page: number | null };
      }>(url);
      verses.push(...data.verses);
      if (data.pagination.next_page == null) break;
      page = data.pagination.next_page;
      await sleep(60);
    }
    process.stdout.write(`\rFetched surah ${ch}/114 — ${verses.length} ayat`);
  }
  process.stdout.write('\n');
  return verses;
}

async function main(): Promise<void> {
  const chapters = await fetchChapters();
  const verses = await fetchAllVerses();

  const surahs: Surah[] = chapters.map((c) => ({
    id: c.id,
    name: c.name_arabic,
    pageStart: c.pages[0],
    pageEnd: c.pages[1],
    versesCount: c.verses_count,
    bismillahPre: c.bismillah_pre,
    revelation: c.revelation_place === 'makkah' ? 'meccan' : 'medinan',
  }));

  // Group verses (already in mushaf order) into pages.
  const pagesMap = new Map<number, QuranPage>();
  for (const v of verses) {
    const surah = Number(v.verse_key.split(':')[0]);
    let page = pagesMap.get(v.page_number);
    if (!page) {
      page = { page: v.page_number, juz: v.juz_number, surahIds: [], ayat: [] };
      pagesMap.set(v.page_number, page);
    }
    const ayah: Ayah = { surah, ayah: v.verse_number, text: v.text_uthmani.trim() };
    if (v.sajdah_number != null) ayah.sajda = true;
    page.ayat.push(ayah);
    if (!page.surahIds.includes(surah)) page.surahIds.push(surah);
  }
  const pages = [...pagesMap.values()].sort((a, b) => a.page - b.page);

  const surahToPages: Record<number, [number, number]> = {};
  for (const s of surahs) surahToPages[s.id] = [s.pageStart, s.pageEnd];

  const juzToPages: Record<number, [number, number]> = {};
  for (const p of pages) {
    const cur = juzToPages[p.juz];
    if (!cur) juzToPages[p.juz] = [p.page, p.page];
    else juzToPages[p.juz] = [Math.min(cur[0], p.page), Math.max(cur[1], p.page)];
  }
  const index: QuranIndex = { totalPages: pages.length, surahToPages, juzToPages };

  await mkdir(join(OUT, 'pages'), { recursive: true });
  await Promise.all(
    pages.map((p) =>
      writeFile(
        join(OUT, 'pages', `${String(p.page).padStart(3, '0')}.json`),
        JSON.stringify(p),
      ),
    ),
  );
  await writeFile(join(OUT, 'surahs.json'), JSON.stringify(surahs));
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index));

  console.log(
    `Wrote ${pages.length} pages, ${surahs.length} surahs, ${verses.length} ayat.`,
  );
  if (pages.length !== 604)
    console.warn(`WARNING: expected 604 pages, got ${pages.length}`);
  if (verses.length !== 6236)
    console.warn(`WARNING: expected 6236 ayat, got ${verses.length}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

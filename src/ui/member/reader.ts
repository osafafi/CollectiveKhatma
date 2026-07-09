/**
 * In-app mushaf reader (REQUIREMENTS §6: "pages readable directly in-app").
 *
 * One component, two modes:
 *  - `browse`   — free reading over all 604 pages, with surah/juz/page jump and
 *                 last-read resume (the المصحف tab).
 *  - `assigned` — reading a khatma's pages for today, with the one-tap "finished"
 *                 action at the bottom.
 *
 * It is a self-contained controller: it owns its subtree and its current-page
 * state, and updates its content **in place** on prev/next. The render loop
 * (src/ui/member/render.ts) keeps a single instance alive across unrelated
 * Firestore ticks so background updates never rebuild it or reset scroll.
 */
import { getPage, getQuranIndex, getSurahs } from '@/content/quran/loader';
import type { QuranPage, Surah } from '@/content/quran/types';
import { ayahEndMarker, toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import { el, mount } from '@/ui/shared/dom';

export const TOTAL_PAGES = 604;
const ALL_PAGES: number[] = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const LAST_READ_KEY = 'khatma.lastReadPage';

export interface ReaderHandle {
  /** The reader's root element — mount this once and keep it. */
  el: HTMLElement;
  /** Jump to a mushaf page (no-op if already there / not in this reader's set). */
  goToPage(page: number): void;
}

interface BrowseConfig {
  mode: 'browse';
  startPage: number;
  /** Called on every navigation so the caller can sync the URL hash. */
  onPageChange: (page: number) => void;
}
interface AssignedConfig {
  mode: 'assigned';
  /** Ordered mushaf pages assigned for today. */
  pages: number[];
  /** Whether today's assignment is already marked done. */
  done: boolean;
  /** One-tap "finished today" — resolves when the write succeeds. */
  onFinish: () => Promise<void>;
}
export type ReaderConfig = BrowseConfig | AssignedConfig;

/** The persisted last-read page for the browse tab (1 if none/invalid). */
export function getLastReadPage(): number {
  const n = Number(localStorage.getItem(LAST_READ_KEY));
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES ? n : 1;
}

export function createReader(config: ReaderConfig): ReaderHandle {
  const pages = config.mode === 'browse' ? ALL_PAGES : config.pages;
  let index = config.mode === 'browse' ? clampIndex(config.startPage - 1, pages.length) : 0;
  let done = config.mode === 'assigned' ? config.done : false;

  const content = el('div', { class: 'space-y-4' });
  const indicator = el('span', { class: 'text-sm tabular-nums text-muted' });
  const prevBtn = navButton(`${strings.reader.prev} ›`);
  const nextBtn = navButton(`‹ ${strings.reader.next}`);
  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));

  const navRow = el('div', { class: 'flex items-center justify-between gap-3' }, [
    prevBtn,
    indicator,
    nextBtn,
  ]);

  const chromeChildren: Node[] =
    config.mode === 'browse'
      ? [
          el('h1', { class: 'text-center text-lg font-bold text-primary' }, [
            strings.reader.browseTitle,
          ]),
          navRow,
        ]
      : [navRow];
  let surahSelect: HTMLSelectElement | undefined;
  let juzSelect: HTMLSelectElement | undefined;
  let pageInput: HTMLInputElement | undefined;

  if (config.mode === 'browse') {
    surahSelect = selectEl(strings.reader.surah);
    juzSelect = selectEl(strings.reader.juz);
    pageInput = el('input', {
      type: 'number',
      min: '1',
      max: String(TOTAL_PAGES),
      inputmode: 'numeric',
      'aria-label': strings.reader.goToPage,
      class: 'w-20 rounded-button border border-border bg-surface px-3 py-2 tabular-nums',
    }) as HTMLInputElement;
    surahSelect.addEventListener('change', () => goToPage(Number(surahSelect!.value)));
    juzSelect.addEventListener('change', () => goToPage(Number(juzSelect!.value)));
    pageInput.addEventListener('change', () => goToPage(Number(pageInput!.value)));
    chromeChildren.push(
      el('div', { class: 'flex flex-wrap items-center gap-2' }, [surahSelect, juzSelect, pageInput]),
    );
    void populateJumpControls();
  }

  const chrome = el(
    'div',
    { class: 'sticky top-0 z-10 -mx-4 space-y-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur' },
    chromeChildren,
  );

  const footer = el('div', {});
  const root = el('div', { class: 'space-y-4' }, [chrome, content, footer]);

  function currentPage(): number {
    return pages[index] ?? 1;
  }

  function go(nextIndex: number): void {
    const clamped = clampIndex(nextIndex, pages.length);
    if (clamped === index) return;
    index = clamped;
    if (config.mode === 'browse') {
      localStorage.setItem(LAST_READ_KEY, String(currentPage()));
      config.onPageChange(currentPage());
    }
    void renderPage();
    window.scrollTo({ top: 0 });
  }

  function goToPage(page: number): void {
    const target = pages.indexOf(page);
    if (target >= 0) go(target);
  }

  async function renderPage(): Promise<void> {
    const page = currentPage();
    mount(content, message(strings.common.loading));
    try {
      const [data, surahs] = await Promise.all([getPage(page), getSurahs()]);
      if (page !== currentPage()) return; // a newer navigation won; drop stale result
      mount(content, ...composePage(data, byId(surahs)));
      prefetchNeighbors();
    } catch {
      mount(content, message(strings.quran.loadError, true));
    }
    updateChrome();
  }

  function updateChrome(): void {
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === pages.length - 1;
    prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
    nextBtn.classList.toggle('opacity-40', nextBtn.disabled);

    if (config.mode === 'browse') {
      indicator.textContent = `${strings.reader.page} ${toArabicDigits(currentPage())} ${strings.reader.of} ${toArabicDigits(TOTAL_PAGES)}`;
      if (pageInput) pageInput.value = String(currentPage());
    } else {
      indicator.textContent = `${strings.reader.page} ${toArabicDigits(currentPage())} · ${toArabicDigits(index + 1)} ${strings.reader.of} ${toArabicDigits(pages.length)}`;
    }
    renderFooter();
  }

  function renderFooter(): void {
    if (config.mode !== 'assigned') {
      mount(footer);
      return;
    }
    if (done) {
      mount(
        footer,
        el(
          'p',
          {
            class:
              'rounded-button bg-success/10 px-4 py-4 text-center text-lg font-semibold text-success',
          },
          [`✓ ${strings.member.doneToday}`],
        ),
      );
      return;
    }
    const err = el('p', { class: 'mt-2 text-center text-danger' }, []);
    const btn = el('button', { type: 'button', class: primaryButtonClass() }, [
      strings.member.finishedToday,
    ]) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      err.textContent = '';
      void config
        .onFinish()
        .then(() => {
          done = true;
          renderFooter();
        })
        .catch(() => {
          btn.disabled = false;
          err.textContent = strings.member.saveError;
        });
    });
    mount(
      footer,
      el('div', { class: 'border-t border-border pt-4' }, [
        el('p', { class: 'mb-3 text-center text-lg font-semibold' }, [
          strings.reader.finishedReading,
        ]),
        btn,
        err,
      ]),
    );
  }

  async function populateJumpControls(): Promise<void> {
    try {
      const [surahs, quranIndex] = await Promise.all([getSurahs(), getQuranIndex()]);
      if (surahSelect) {
        for (const s of surahs) {
          surahSelect.append(
            option(String(s.pageStart), `${toArabicDigits(s.id)}. ${s.name}`),
          );
        }
      }
      if (juzSelect) {
        for (let j = 1; j <= 30; j++) {
          const first = quranIndex.juzToPages[j]?.[0];
          if (first) juzSelect.append(option(String(first), `${strings.reader.juz} ${toArabicDigits(j)}`));
        }
      }
      updateChrome();
    } catch {
      /* jump controls are a convenience; reading still works without them */
    }
  }

  function prefetchNeighbors(): void {
    void getPage(pages[index + 1] ?? currentPage());
    void getPage(pages[index - 1] ?? currentPage());
  }

  void renderPage();
  return { el: root, goToPage };
}

// -----------------------------------------------------------------------------
// Page composition — turn a QuranPage into DOM: surah headers, Bismillah, and
// justified ayah runs with medallion ayah numbers.
// -----------------------------------------------------------------------------

function composePage(page: QuranPage, surahs: Map<number, Surah>): Node[] {
  const blocks: Node[] = [];
  let run: string[] = [];
  let runSurah = -1;

  const flush = (): void => {
    if (run.length === 0) return;
    blocks.push(el('p', { class: 'quran-text' }, [run.join(' ')]));
    run = [];
  };

  for (const ayah of page.ayat) {
    if (ayah.surah !== runSurah) {
      flush();
      runSurah = ayah.surah;
      // A new surah *begins* on this page when its first ayah appears here.
      if (ayah.ayah === 1) blocks.push(surahHeader(surahs.get(ayah.surah)));
    }
    let text = `${ayah.text} ${ayahEndMarker(ayah.ayah)}`;
    if (ayah.sajda) text += ` ${strings.reader.sajda}`;
    run.push(text);
  }
  flush();
  return blocks;
}

function surahHeader(surah: Surah | undefined): HTMLElement {
  const children: Node[] = [
    el('div', { class: 'text-xl font-bold text-primary' }, [
      surah ? `سورة ${surah.name}` : '',
    ]),
  ];
  if (surah?.bismillahPre) {
    children.push(el('p', { class: 'quran-text mt-2 text-center' }, [strings.reader.bismillah]));
  }
  return el(
    'div',
    { class: 'my-4 rounded-card border border-border bg-surface px-4 py-3 text-center shadow-sm' },
    children,
  );
}

// -----------------------------------------------------------------------------
// Small building blocks.
// -----------------------------------------------------------------------------

function navButton(label: string): HTMLButtonElement {
  return el('button', {
    type: 'button',
    class: 'rounded-button border border-primary px-5 py-3 text-lg font-semibold text-primary',
  }, [label]) as HTMLButtonElement;
}

function primaryButtonClass(): string {
  return 'w-full rounded-button bg-primary px-4 py-4 text-lg font-semibold text-white';
}

function selectEl(ariaLabel: string): HTMLSelectElement {
  return el('select', {
    'aria-label': ariaLabel,
    class: 'rounded-button border border-border bg-surface px-3 py-2',
  }) as HTMLSelectElement;
}

function option(value: string, label: string): HTMLOptionElement {
  return el('option', { value }, [label]) as HTMLOptionElement;
}

function message(text: string, danger = false): HTMLElement {
  return el('p', { class: `py-10 text-center ${danger ? 'text-danger' : 'text-muted'}` }, [text]);
}

function byId(surahs: Surah[]): Map<number, Surah> {
  return new Map(surahs.map((s): [number, Surah] => [s.id, s]));
}

function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length - 1, i));
}

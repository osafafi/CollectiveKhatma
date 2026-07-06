import { subscribeRoster } from '@/data/roster';
import { getPage } from '@/content/quran/loader';
import { ayahEndMarker } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { Person } from '@/domain/types';
import { el, mount } from '@/ui/shared/dom';

/**
 * Member app — walking-skeleton render. Proves the full path end to end:
 * theme + centralized strings + a LIVE roster read from Firestore, plus the
 * Quran sample in the reading font. Feature screens land in later stages.
 */
export function renderMember(root: HTMLElement): void {
  const rosterList = el('ul', { class: 'space-y-2' }, [
    el('li', { class: 'text-muted' }, [strings.member.connecting]),
  ]);

  mount(
    root,
    el('main', { class: 'mx-auto max-w-xl space-y-6 p-4' }, [
      header(),
      card(strings.member.rosterHeading, [rosterList]),
      quranSampleCard(),
      finishedButton(),
    ]),
  );

  // Live roster: the proof that theme + strings + Firestore realtime all work.
  subscribeRoster(
    (people) => renderRoster(rosterList, people),
    () =>
      mount(
        rosterList,
        el('li', { class: 'text-danger' }, [strings.member.connectionError]),
      ),
  );
}

function renderRoster(list: HTMLUListElement, people: Person[]): void {
  if (people.length === 0) {
    mount(list, el('li', { class: 'text-muted' }, [strings.member.emptyRoster]));
    return;
  }
  mount(
    list,
    ...people.map((p) =>
      el('li', { class: 'rounded-button bg-bg px-4 py-3 text-lg' }, [p.name]),
    ),
  );
}

function header(): HTMLElement {
  return el('header', { class: 'space-y-1 text-center' }, [
    el('h1', { class: 'text-3xl font-bold text-primary' }, [strings.member.title]),
    el('p', { class: 'text-muted' }, [strings.member.tagline]),
    el('p', { class: 'text-lg' }, [strings.member.greeting]),
  ]);
}

function card(title: string, children: Node[]): HTMLElement {
  return el(
    'section',
    { class: 'rounded-card border border-border bg-surface p-4 shadow-sm' },
    [el('h2', { class: 'mb-3 text-xl font-semibold' }, [title]), ...children],
  );
}

function quranSampleCard(): HTMLElement {
  const body = el('div', { class: 'quran-text' }, [
    el('span', { class: 'text-muted' }, [strings.common.loading]),
  ]);

  // Load page 1 (Al-Fatiha) from the bundled Madinah dataset and render the
  // ayat as continuous mushaf text with ornate ayah-end markers.
  void getPage(1)
    .then((page) =>
      mount(
        body,
        ...page.ayat.flatMap((a) => [
          document.createTextNode(`${a.text} `),
          el('span', { class: 'text-primary' }, [`${ayahEndMarker(a.ayah)} `]),
        ]),
      ),
    )
    .catch(() =>
      mount(body, el('span', { class: 'text-danger' }, [strings.quran.loadError])),
    );

  return card(strings.quran.sampleHeading, [body]);
}

/** The single large CTA (REQUIREMENTS §6); inert until the reading flow lands. */
function finishedButton(): HTMLElement {
  return el(
    'button',
    {
      type: 'button',
      disabled: 'true',
      class:
        'w-full rounded-button bg-primary px-4 py-4 text-lg font-semibold text-white opacity-60',
    },
    [strings.member.finishedToday],
  );
}

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, QuranPage, Surah } from '@/content/quran/types';
import type { Assignment, Khatma, Person } from '@/domain/types';
import {
  createFakeRecitationEnvironment,
  type FakeRecitationEnvironment,
} from '../support/fakeRecitationEnvironment';
import { renderWithAppProviders } from '../support/reactTestHarness';

const loader = vi.hoisted(() => ({
  getPage: vi.fn<(page: number) => Promise<QuranPage>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const SURAHS: Surah[] = [
  {
    id: 2,
    name: 'البقرة',
    pageStart: 2,
    pageEnd: 49,
    versesCount: 286,
    bismillahPre: true,
    revelation: 'medinan',
  },
  {
    id: 3,
    name: 'آل عمران',
    pageStart: 50,
    pageEnd: 76,
    versesCount: 200,
    bismillahPre: true,
    revelation: 'medinan',
  },
];

/** Two ayat a page; 49 closes Al-Baqarah and 50 opens Al-Imran. */
function makePage(page: number): QuranPage {
  const ayat =
    page === 49
      ? [285, 286].map((ayah) => ({ surah: 2, ayah }))
      : page === 50
        ? [1, 2].map((ayah) => ({ surah: 3, ayah }))
        : [page * 2, page * 2 + 1].map((ayah) => ({ surah: 2, ayah }));
  return {
    page,
    juz: 1,
    surahIds: [ayat[0]!.surah],
    ayat: ayat.map((ayah) => ({ ...ayah, text: `نص-${ayah.surah}-${ayah.ayah}` })),
  };
}

const url = (surah: number, ayah: number) =>
  `https://everyayah.com/data/Alafasy_128kbps/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;

const amina: Person = {
  id: 'person-1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

function makeKhatma(id: string, overrides: Partial<Khatma> = {}): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: `سلسلة ${id}`,
    seriesNumber: 1,
    totalPages: 604,
    scope: { kind: 'full' },
    memberIds: [amina.id],
    capacities: { [amina.id]: { pages: 2, surahs: 0, juz: 0 } },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [],
    roundCount: 1,
    createdAt: Date.UTC(2026, 6, 1),
    ...overrides,
  };
}

function assignmentFor(pages: number[]): Assignment {
  return {
    memberId: amina.id,
    rounds: [
      {
        round: 1,
        date: '2026-07-14',
        pages,
        loosePages: [...pages],
        redistributedPages: [],
      },
    ],
    doneByRound: {},
    missedStreak: 0,
  };
}

function makeWird(scope: Khatma['scope'], remainingPages: number[]): Khatma {
  return makeKhatma('w1', {
    kind: 'wird',
    seriesName: 'ورد الصباح',
    scope,
    totalPages: remainingPages.length,
    remainingPages,
    capacities: { [amina.id]: { pages: 0, surahs: 0, juz: 0 } },
    duaReciterId: '',
    roundCount: 0,
    completionCount: 0,
    pastMemberIds: [],
    wirdDuaText: scope.kind === 'dua' ? 'اللهم افتح لنا أبواب رحمتك' : undefined,
  });
}

let fake: FakeRecitationEnvironment;

function renderMember(route: string, data: Parameters<typeof renderWithAppProviders>[1]) {
  localStorage.setItem('khatma.memberId', amina.id);
  return renderWithAppProviders(
    <MemberIdentityBoundary>
      <MemberExperience recitationEnvironment={fake.env} />
    </MemberIdentityBoundary>,
    { ...data, route },
  );
}

function renderAssigned(pages: number[]) {
  return renderMember('/khatma/k1/read', {
    data: {
      roster: [amina],
      khatmas: [makeKhatma('k1')],
      assignments: { k1: [assignmentFor(pages)] },
    },
  });
}

const playButton = () => screen.findByRole('button', { name: strings.recitation.play });

beforeEach(() => {
  localStorage.clear();
  fake = createFakeRecitationEnvironment();
  loader.getSurahs.mockResolvedValue(SURAHS);
  loader.getQuranIndex.mockResolvedValue({
    totalPages: 604,
    surahToPages: { 2: [2, 49], 3: [50, 76] },
    juzToPages: { 1: [1, 21] },
  });
  loader.getPage.mockImplementation((page) => Promise.resolve(makePage(page)));
});

describe('member recitation in the readers', () => {
  it('follows the audio onto the next assigned page without adding history', async () => {
    const { user } = renderAssigned([30, 31, 32]);
    await screen.findByText(/نص-2-60/);
    const historyLength = window.history.length;

    await user.click(await playButton());
    expect(fake.audio.src).toBe(url(2, 60));
    act(() => fake.audio.startPlaying());
    expect(screen.getByRole('status')).toHaveTextContent('البقرة · 60');
    expect(screen.getByText(strings.recitation.qariNames.alafasy)).toBeVisible();

    await act(async () => fake.audio.finish());
    expect(fake.audio.src).toBe(url(2, 61));
    act(() => fake.audio.startPlaying());
    await act(async () => fake.audio.finish());

    expect(fake.audio.src).toBe(url(2, 62));
    await screen.findByText(/نص-2-62/);
    expect(window.location.hash).toBe('#/khatma/k1/read/31');
    expect(window.history.length).toBe(historyLength);
  });

  it('restarts at the top of a page the member turns to by hand', async () => {
    const { user } = renderAssigned([30, 31, 32]);
    await user.click(await playButton());
    act(() => fake.audio.startPlaying());

    await user.click(screen.getByRole('button', { name: `${strings.reader.next} ›` }));
    await screen.findByText(/نص-2-62/);
    await waitFor(() => expect(fake.audio.src).toBe(url(2, 62)));
    expect(screen.getByRole('button', { name: strings.recitation.pause })).toBeVisible();
  });

  it('ends after the last assigned page', async () => {
    const { user } = renderAssigned([30]);
    await user.click(await playButton());
    act(() => fake.audio.startPlaying());
    await act(async () => fake.audio.finish());
    act(() => fake.audio.startPlaying());
    await act(async () => fake.audio.finish());

    expect(fake.audio.srcHistory).toEqual([url(2, 60), url(2, 61)]);
    expect(screen.getByRole('button', { name: strings.recitation.play })).toBeVisible();
  });

  it('steps between verses from the bar and closes it', async () => {
    const { user } = renderAssigned([30, 31]);
    await user.click(await playButton());
    act(() => fake.audio.startPlaying());

    await user.click(screen.getByRole('button', { name: strings.recitation.next }));
    expect(fake.audio.src).toBe(url(2, 61));
    await user.click(screen.getByRole('button', { name: strings.recitation.previous }));
    expect(fake.audio.src).toBe(url(2, 60));

    await user.click(screen.getByRole('button', { name: strings.recitation.close }));
    expect(fake.audio.src).toBe('');
    expect(await playButton()).toBeVisible();
  });

  it('stops when the member leaves the reader', async () => {
    const { user } = renderAssigned([30, 31]);
    await user.click(await playButton());
    act(() => fake.audio.startPlaying());

    await user.click(screen.getByRole('link', { name: strings.nav.settings }));
    await screen.findByRole('heading', { name: strings.nav.settings });
    expect(fake.audio.src).toBe('');
    expect(fake.audio.paused).toBe(true);
  });

  it('stops the full-Quran reader at the end of the surah it started in', async () => {
    const { user } = renderMember('/quran/48', { data: { roster: [amina] } });
    await screen.findByText(/نص-2-96/);
    const historyLength = window.history.length;

    await user.click(await playButton());
    for (let step = 0; step < 4; step += 1) {
      act(() => fake.audio.startPlaying());
      await act(async () => fake.audio.finish());
    }

    expect(fake.audio.srcHistory).toEqual([
      url(2, 96),
      url(2, 97),
      url(2, 285),
      url(2, 286),
    ]);
    expect(window.location.hash).toBe('#/quran/49');
    expect(window.history.length).toBe(historyLength);
    expect(localStorage.getItem('khatma.lastReadPage')).toBe('49');
    expect(screen.getByRole('button', { name: strings.recitation.play })).toBeVisible();
  });

  it('offers recitation in a Quran Wird but not in a duʿa Wird', async () => {
    const quranWird = makeWird({ kind: 'juz', juzIds: [2] }, [30, 31]);
    const first = renderMember('/khatma/w1/read', {
      data: {
        roster: [amina],
        khatmas: [quranWird],
        wirdCompletions: { w1: [] },
      },
    });
    await first.user.click(await playButton());
    expect(fake.audio.src).toBe(url(2, 60));
    first.unmount();

    renderMember('/khatma/w1/read', {
      data: {
        roster: [amina],
        khatmas: [makeWird({ kind: 'dua' }, [])],
        wirdCompletions: { w1: [] },
      },
    });
    await screen.findByText('اللهم افتح لنا أبواب رحمتك');
    expect(screen.queryByRole('button', { name: strings.recitation.play })).toBeNull();
  });
});

describe('the recited verse on the page', () => {
  const ayahSpan = (key: string) =>
    document.querySelector<HTMLElement>(`[data-ayah="${key}"]`)!;
  const reciting = () =>
    [...document.querySelectorAll<HTMLElement>('.is-reciting')].map(
      (element) => element.dataset.ayah ?? `b:${element.dataset.basmala}`,
    );
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as Element['scrollIntoView'];
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.restoreAllMocks();
  });

  it('wraps every ayah and moves the highlight with the recitation', async () => {
    const { user } = renderAssigned([30, 31]);
    await screen.findByText(/نص-2-60/);
    expect(ayahSpan('2:60')).toHaveClass('ayah');
    expect(ayahSpan('2:60').textContent).toBe('نص-2-60 ۝60');
    expect(reciting()).toEqual([]);

    await user.click(await playButton());
    act(() => fake.audio.startPlaying());
    expect(reciting()).toEqual(['2:60']);

    await act(async () => fake.audio.finish());
    expect(reciting()).toEqual(['2:61']);
  });

  it('moves the glow as the next ayah takes over in the overlap', async () => {
    const { user } = renderAssigned([30, 31]);
    await user.click(await playButton());
    const [first, second] = fake.channels;
    act(() => first.startPlaying());
    expect(reciting()).toEqual(['2:60']);

    // Just inside the tail: the next ayah starts on the other channel.
    first.duration = 5;
    first.currentTime = 4.9;
    await waitFor(() => expect(second.src).toBe(url(2, 61)));
    expect(first.paused).toBe(false);
    act(() => second.startPlaying());
    expect(reciting()).toEqual(['2:61']);
    expect(screen.getByRole('status')).toHaveTextContent('البقرة · 61');
  });

  it('lights the bismillah line while the basmala plays', async () => {
    const { user } = renderMember('/quran/50', { data: { roster: [amina] } });
    await screen.findByText(/نص-3-1/);

    await user.click(await playButton());
    expect(fake.audio.src).toBe(url(1, 1));
    act(() => fake.audio.startPlaying());
    expect(reciting()).toEqual(['b:3']);
    expect(screen.getByRole('status')).toHaveTextContent(
      `آل عمران · ${strings.recitation.basmala}`,
    );

    await act(async () => fake.audio.finish());
    expect(fake.audio.src).toBe(url(3, 1));
    expect(reciting()).toEqual(['3:1']);
  });

  it('starts from a tapped verse only while the player is open', async () => {
    const { user } = renderAssigned([30, 31]);
    await screen.findByText(/نص-2-61/);

    await user.click(ayahSpan('2:61'));
    expect(fake.createAudio).not.toHaveBeenCalled();

    await user.click(await playButton());
    act(() => fake.audio.startPlaying());
    await user.click(ayahSpan('2:61'));
    expect(fake.audio.src).toBe(url(2, 61));

    // Selecting text to copy is not a tap.
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
    } as Selection);
    fireEvent.click(ayahSpan('2:60'));
    expect(fake.audio.src).toBe(url(2, 61));
  });

  it('shows no glow behind the not-available dialog', async () => {
    fake.setOnline(false);
    const { user } = renderAssigned([30, 31]);
    await user.click(await playButton());
    expect(
      await screen.findByRole('dialog', { name: strings.recitation.unavailableTitle }),
    ).toBeVisible();
    expect(reciting()).toEqual([]);
  });

  it('keeps the verse in view but backs off after a manual scroll', async () => {
    const { user } = renderAssigned([30, 31]);
    await user.click(await playButton());
    act(() => fake.audio.startPlaying());
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(ayahSpan('2:60'));

    fireEvent.wheel(window);
    await act(async () => fake.audio.finish());
    expect(reciting()).toEqual(['2:61']);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

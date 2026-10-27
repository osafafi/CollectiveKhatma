import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

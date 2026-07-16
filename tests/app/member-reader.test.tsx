import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, QuranPage, Surah } from '@/content/quran/types';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The reader fetches static Quran JSON at runtime; mock the loader so jsdom tests
// stay deterministic and offline.
const loader = vi.hoisted(() => ({
  getPage: vi.fn<(page: number) => Promise<QuranPage>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const SURAHS: Surah[] = [
  {
    id: 1,
    name: 'الفاتحة',
    pageStart: 1,
    pageEnd: 1,
    versesCount: 7,
    bismillahPre: false,
    revelation: 'meccan',
  },
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

const INDEX: QuranIndex = {
  totalPages: 604,
  surahToPages: { 1: [1, 1], 2: [2, 49], 3: [50, 76] },
  juzToPages: { 1: [1, 21], 2: [22, 41] },
};

const SURAH_STARTS: Record<number, number> = { 1: 1, 2: 2, 50: 3 };

function makePage(page: number): QuranPage {
  const surah = SURAH_STARTS[page] ?? 2;
  const ayah = SURAH_STARTS[page] ? 1 : 5;
  return {
    page,
    juz: 1,
    surahIds: [surah],
    ayat: [{ surah, ayah, text: `page-body-${page}` }],
  };
}

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
    remainingPages: [30, 31, 32],
    roundCount: 1,
    createdAt: Date.UTC(2026, 6, 1),
    ...overrides,
  };
}

function makeAssignment(
  memberId: string,
  rounds: RoundChunk[] = [],
  doneByRound: Record<number, number> = {},
  missedStreak = 0,
): Assignment {
  return { memberId, rounds, doneByRound, missedStreak };
}

function round(roundNumber: number, pages: number[]): RoundChunk {
  return {
    round: roundNumber,
    date: '2026-07-14',
    pages,
    loosePages: [...pages],
    redistributedPages: [],
  };
}

function TestMemberExperience() {
  return (
    <MemberIdentityBoundary>
      <MemberExperience />
    </MemberIdentityBoundary>
  );
}

function renderMember(options: RenderWithAppProvidersOptions = {}) {
  localStorage.setItem('khatma.memberId', amina.id);
  return renderWithAppProviders(<TestMemberExperience />, options);
}

beforeEach(() => {
  localStorage.clear();
  loader.getSurahs.mockResolvedValue(SURAHS);
  loader.getQuranIndex.mockResolvedValue(INDEX);
  loader.getPage.mockImplementation((page: number) => Promise.resolve(makePage(page)));
});

describe('member browse reader (RM-440)', () => {
  it('resumes from the remembered page and renders the mushaf body', async () => {
    localStorage.setItem('khatma.lastReadPage', '5');
    renderMember({ route: '/quran', data: { roster: [amina] } });

    expect(
      screen.getByRole('heading', { name: strings.reader.browseTitle }),
    ).toBeVisible();
    expect(screen.getByText('صفحة ٥ من ٦٠٤')).toBeVisible();
    expect(await screen.findByText(/page-body-5/)).toBeVisible();
  });

  it('navigates pages, syncs the hash, and persists the last-read page', async () => {
    const harness = renderMember({ route: '/quran', data: { roster: [amina] } });

    expect(screen.getByText('صفحة ١ من ٦٠٤')).toBeVisible();
    expect(screen.getByRole('button', { name: /السابقة/ })).toBeDisabled();

    await harness.user.click(screen.getByRole('button', { name: /التالية/ }));

    expect(screen.getByText('صفحة ٢ من ٦٠٤')).toBeVisible();
    expect(window.location.hash).toBe('#/quran/2');
    expect(localStorage.getItem('khatma.lastReadPage')).toBe('2');
    expect(await screen.findByText(/page-body-2/)).toBeVisible();
  });

  it('disables the next control at the last page on a deep link', () => {
    renderMember({ route: '/quran/604', data: { roster: [amina] } });

    expect(screen.getByText('صفحة ٦٠٤ من ٦٠٤')).toBeVisible();
    expect(screen.getByRole('button', { name: /التالية/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /السابقة/ })).toBeEnabled();
  });

  it('jumps via the surah select and the page input', async () => {
    const harness = renderMember({ route: '/quran', data: { roster: [amina] } });

    await harness.user.click(
      screen.getByRole('combobox', { name: strings.reader.surah }),
    );
    await harness.user.click(await screen.findByRole('option', { name: /البقرة/ }));

    expect(window.location.hash).toBe('#/quran/2');
    expect(await screen.findByText(/سورة البقرة/)).toBeVisible();

    const input = screen.getByRole('spinbutton', { name: strings.reader.goToPage });
    await harness.user.clear(input);
    await harness.user.type(input, '3');
    await harness.user.tab();

    expect(window.location.hash).toBe('#/quran/3');
    expect(screen.getByText('صفحة ٣ من ٦٠٤')).toBeVisible();
  });

  it('shows the load error when a page body fails', async () => {
    loader.getPage.mockRejectedValue(new Error('offline'));
    renderMember({ route: '/quran/7', data: { roster: [amina] } });

    expect(await screen.findByText(strings.quran.loadError)).toBeVisible();
  });
});

describe('member assigned reader (RM-440)', () => {
  it('reads the assigned chunk, navigates, and finishes the round', async () => {
    const khatma = makeKhatma('k1');
    const markRoundDone = vi
      .fn<WriteOperations['markRoundDone']>()
      .mockResolvedValue(undefined);
    const harness = renderMember({
      route: `/khatma/${khatma.id}/read`,
      data: {
        roster: [amina],
        khatmas: [khatma],
        assignments: {
          [khatma.id]: [makeAssignment(amina.id, [round(1, [10, 11, 12])])],
        },
      },
      operations: { ...writeOperations, markRoundDone },
    });

    expect(await screen.findByText('صفحة ١٠ · ١ من ٣')).toBeVisible();
    expect(await screen.findByText(/page-body-10/)).toBeVisible();

    await harness.user.click(screen.getByRole('button', { name: /التالية/ }));
    expect(screen.getByText('صفحة ١١ · ٢ من ٣')).toBeVisible();

    await harness.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    expect(markRoundDone).toHaveBeenCalledWith(khatma.id, amina.id, 1);
    expect(
      screen.getByText((content) => content.includes(strings.member.doneToday)),
    ).toBeVisible();
  });

  it('keeps the current page across unrelated realtime ticks and resets on a new round', async () => {
    const khatma = makeKhatma('k1');
    const harness = renderMember({
      route: `/khatma/${khatma.id}/read`,
      data: {
        roster: [amina],
        khatmas: [khatma],
        assignments: {
          [khatma.id]: [makeAssignment(amina.id, [round(1, [10, 11, 12])])],
        },
      },
    });

    await harness.user.click(await screen.findByRole('button', { name: /التالية/ }));
    expect(screen.getByText('صفحة ١١ · ٢ من ٣')).toBeVisible();

    // An unrelated tick (same round, streak bumped) must not reset page or scroll.
    harness.subscriptions
      .assignment(khatma.id)
      .emit([makeAssignment(amina.id, [round(1, [10, 11, 12])], {}, 4)]);
    expect(screen.getByText('صفحة ١١ · ٢ من ٣')).toBeVisible();

    // A new round remounts the reader fresh at its first page.
    harness.subscriptions.assignment(khatma.id).emit([
      makeAssignment(amina.id, [round(1, [10, 11, 12]), round(2, [20, 21])], {
        1: 100,
      }),
    ]);
    expect(await screen.findByText('صفحة ٢٠ · ١ من ٢')).toBeVisible();
  });

  it('shows loading, no-pages, and paused states', () => {
    const loading = renderMember({
      route: '/khatma/k1/read',
      data: { roster: [amina] },
    });
    expect(screen.getByText(strings.common.loading)).toBeVisible();
    loading.unmount();

    const foreign = makeKhatma('foreign', { memberIds: ['someone-else'] });
    const notMine = renderMember({
      route: '/khatma/foreign/read',
      data: { roster: [amina], khatmas: [foreign] },
    });
    expect(screen.getByText(strings.reader.noPagesToday)).toBeVisible();
    notMine.unmount();

    const khatma = makeKhatma('k1');
    renderMember({
      route: '/khatma/k1/read',
      data: {
        roster: [{ ...amina, enabled: false }],
        khatmas: [khatma],
        assignments: { [khatma.id]: [makeAssignment(amina.id, [round(1, [10, 11])])] },
      },
    });
    expect(screen.getByText(strings.reader.noPagesToday)).toBeVisible();
    expect(
      screen.getByRole('link', { name: `‹ ${strings.member.back}` }),
    ).toHaveAttribute('href', '#/khatma/k1');
  });

  it('surfaces a save error when finishing fails', async () => {
    const khatma = makeKhatma('k1');
    const markRoundDone = vi
      .fn<WriteOperations['markRoundDone']>()
      .mockRejectedValue(new Error('offline'));
    const harness = renderMember({
      route: `/khatma/${khatma.id}/read`,
      data: {
        roster: [amina],
        khatmas: [khatma],
        assignments: {
          [khatma.id]: [makeAssignment(amina.id, [round(1, [10, 11, 12])])],
        },
      },
      operations: { ...writeOperations, markRoundDone },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.member.finishedToday }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.member.saveError);
  });
});

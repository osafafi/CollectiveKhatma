import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { QuranIndex, QuranPage, Surah } from '@/content/quran/types';
import { seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The reader routes fetch static Quran JSON at runtime; mock the loader so these
// jsdom integration journeys stay deterministic and offline (mirrors
// member-reader.test.tsx).
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
];

const INDEX: QuranIndex = {
  totalPages: 604,
  surahToPages: { 1: [1, 1], 2: [2, 49] },
  juzToPages: { 1: [1, 21], 2: [22, 41] },
};

function makePage(page: number): QuranPage {
  return {
    page,
    juz: 1,
    surahIds: [2],
    ayat: [{ surah: 2, ayah: 5, text: `page-body-${page}` }],
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

const maryam: Person = { ...amina, id: 'person-2', name: 'Maryam' };

function makeKhatma(id: string, overrides: Partial<Khatma> = {}): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: `سلسلة ${id}`,
    seriesNumber: 1,
    totalPages: 604,
    scope: { kind: 'full' },
    memberIds: [amina.id],
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
  return { round: roundNumber, date: '2026-07-14', pages };
}

function TestMemberExperience() {
  return (
    <MemberIdentityBoundary>
      <MemberExperience />
    </MemberIdentityBoundary>
  );
}

/** Render the composed member tree; pass `memberId` to skip the identity gate. */
function renderMember(
  options: RenderWithAppProvidersOptions & { memberId?: string } = {},
) {
  const { memberId, ...renderOptions } = options;
  if (memberId) localStorage.setItem('khatma.memberId', memberId);
  return renderWithAppProviders(<TestMemberExperience />, renderOptions);
}

function openKhatmaName(khatma: Khatma): string {
  return `${strings.member.openKhatma}: ${seriesTitle(khatma, toArabicDigits)}`;
}

beforeEach(() => {
  localStorage.clear();
  loader.getSurahs.mockResolvedValue(SURAHS);
  loader.getQuranIndex.mockResolvedValue(INDEX);
  loader.getPage.mockImplementation((page: number) => Promise.resolve(makePage(page)));
});

describe('member application integration (RM-450)', () => {
  it('walks the full journey from the identity gate to finishing an assigned round', async () => {
    const khatma = makeKhatma('journey', {
      seriesName: 'أهل القرآن',
    });
    const markRoundDone = vi
      .fn<WriteOperations['markRoundDone']>()
      .mockResolvedValue(undefined);
    const harness = renderMember({
      data: {
        roster: [amina, maryam],
        khatmas: [khatma],
        assignments: {
          [khatma.id]: [makeAssignment(amina.id, [round(1, [10, 11, 12])])],
        },
      },
      operations: { ...writeOperations, markRoundDone },
    });

    // Gate: no remembered identity, so the real roster gate is shown first.
    expect(screen.getByRole('heading', { name: strings.member.title })).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await harness.user.click(screen.getByRole('button', { name: amina.name }));

    // Selecting the member reveals the shell and lands on the khatmas list.
    expect(localStorage.getItem('khatma.memberId')).toBe(amina.id);
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
    const openLink = await screen.findByRole('link', {
      name: openKhatmaName(khatma),
    });
    expect(openLink).toHaveAttribute('href', '#/khatma/journey');

    // List -> khatma landing.
    await harness.user.click(openLink);
    const readLink = await screen.findByRole('link', {
      name: strings.reader.readMyPages,
    });
    expect(readLink).toHaveAttribute('href', '#/khatma/journey/read');

    // Landing -> assigned reader.
    await harness.user.click(readLink);
    expect(await screen.findByText('صفحة ١٠ · ١ من ٣')).toBeVisible();
    expect(await screen.findByText(/page-body-10/)).toBeVisible();

    // Reader -> finish the round.
    await harness.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    expect(markRoundDone).toHaveBeenCalledWith(khatma.id, amina.id, 1);
    expect(
      screen.getByText((content) => content.includes(strings.member.doneToday)),
    ).toBeVisible();
  });

  it('reflects a realtime assignment tick received on another route and keeps one listener', async () => {
    const khatma = makeKhatma('live', { seriesName: 'أهل القرآن' });
    const harness = renderMember({
      memberId: amina.id,
      route: '/personal',
      data: {
        roster: [amina],
        khatmas: [khatma],
        assignments: { [khatma.id]: [makeAssignment(amina.id)] },
      },
    });

    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();
    expect(harness.subscriptions.assignment(khatma.id).counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });

    // A round is distributed in realtime while the member is on another route.
    harness.subscriptions
      .assignment(khatma.id)
      .emit([makeAssignment(amina.id, [round(1, [1, 2])])]);

    // Navigating to the list shows the tick that arrived on the personal route,
    // and navigation created no duplicate assignment listener.
    await harness.user.click(screen.getByRole('link', { name: strings.nav.khatmas }));
    const openLink = await screen.findByRole('link', {
      name: openKhatmaName(khatma),
    });
    expect(within(openLink).getByText(/٢ صفحات/)).toBeVisible();
    expect(harness.subscriptions.assignment(khatma.id).counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });
  });

  it('switches identity from the shell and re-subscribes for the new member', async () => {
    const aminaKhatma = makeKhatma('amina-k', { memberIds: [amina.id] });
    const maryamKhatma = makeKhatma('maryam-k', { memberIds: [maryam.id] });
    const harness = renderMember({
      memberId: amina.id,
      route: '/personal',
      data: {
        roster: [amina, maryam],
        khatmas: [aminaKhatma, maryamKhatma],
        assignments: {
          [aminaKhatma.id]: [makeAssignment(amina.id, [round(1, [10, 11])])],
          [maryamKhatma.id]: [makeAssignment(maryam.id, [round(1, [12, 13])])],
        },
      },
    });

    expect(screen.getByText(amina.name)).toBeVisible();
    expect(harness.subscriptions.assignment(aminaKhatma.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(maryamKhatma.id).counts().active).toBe(0);

    // Switch person from the personal route: the gate returns and the previous
    // member's assignment listener is torn down.
    await harness.user.click(
      screen.getByRole('button', { name: strings.member.switchPerson }),
    );
    expect(localStorage.getItem('khatma.memberId')).toBeNull();
    expect(screen.getByRole('heading', { name: strings.member.title })).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(harness.subscriptions.assignment(aminaKhatma.id).counts().active).toBe(0);

    // Picking the other member re-mounts the experience and subscribes only
    // their khatma.
    await harness.user.click(screen.getByRole('button', { name: maryam.name }));
    expect(screen.getByText(maryam.name)).toBeVisible();
    expect(harness.subscriptions.assignment(maryamKhatma.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(aminaKhatma.id).counts().active).toBe(0);
  });

  it('overlays the completion interrupt above the reader route and restores it after acknowledgement', async () => {
    const reader = makeKhatma('reader-k', { seriesName: 'أهل القرآن' });
    const completed = makeKhatma('completed-k', {
      seriesName: 'الختمة المكتملة',
      totalPages: 2,
      remainingPages: [],
      duaReciterId: amina.id,
    });
    const harness = renderMember({
      memberId: amina.id,
      route: `/khatma/${reader.id}/read`,
      data: {
        roster: [amina],
        content: { du3aText: 'دعاء الختمة' },
        khatmas: [reader, completed],
        assignments: {
          [reader.id]: [makeAssignment(amina.id, [round(1, [10, 11, 12])])],
          [completed.id]: [makeAssignment(amina.id, [round(1, [1, 2])], { 1: 100 })],
        },
      },
    });

    // The unacknowledged completed khatma interrupts the reader route entirely.
    expect(
      await screen.findByRole('heading', { name: strings.member.khatmaComplete }),
    ).toBeVisible();
    expect(screen.getByText('دعاء الختمة')).toHaveClass('quran-text');
    expect(screen.queryByText(/page-body-10/)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await harness.user.click(screen.getByRole('button', { name: strings.common.done }));

    // Acknowledgement restores the underlying reader with its page and chrome.
    expect(localStorage.getItem(`khatma.du3aAck.${completed.id}`)).toBe('1');
    expect(await screen.findByText('صفحة ١٠ · ١ من ٣')).toBeVisible();
    expect(await screen.findByText(/page-body-10/)).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
  });
});

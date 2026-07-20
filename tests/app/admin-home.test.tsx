import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import { toArabicDigits } from '@/content/quran/symbols';
import { AlreadyDistributedError, type DistributionOutcome } from '@/data/distribution';
import { seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import { todayIso } from '@/app/admin/todayIso';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The dashboard loads surah/juz maps for distribution, and the open detail khatma
// (P9) mounts the detail page, which loads surah names; mock the loader so jsdom
// tests stay deterministic and offline (a `range`-scope distribution needs none).
const loader = vi.hoisted(() => ({
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const INDEX: QuranIndex = {
  totalPages: 6,
  surahToPages: { 1: [1, 3], 2: [4, 6] },
  juzToPages: { 1: [1, 6] },
};

const amina: Person = {
  id: 'p1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};
const maryam: Person = { ...amina, id: 'p2', name: 'Maryam' };

function makeKhatma(id: string, overrides: Partial<Khatma> = {}): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: `سلسلة ${id}`,
    seriesNumber: 1,
    totalPages: 6,
    scope: { kind: 'range', fromPage: 1, toPage: 6 },
    memberIds: [amina.id],
    capacities: {
      [amina.id]: { pages: 2, surahs: 0, juz: 0 },
      [maryam.id]: { pages: 2, surahs: 0, juz: 0 },
    },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [1, 2, 3, 4, 5, 6],
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

function renderAdmin(options: RenderWithAppProvidersOptions = {}) {
  return renderWithAppProviders(<AdminExperience />, options);
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('admin Home dashboard', () => {
  beforeEach(() => {
    loader.getQuranIndex.mockReset();
    loader.getQuranIndex.mockResolvedValue(INDEX);
    loader.getSurahs.mockReset();
    loader.getSurahs.mockResolvedValue([]);
  });

  it('renders per-khatma metrics, pending readers, warnings, and the detail link', async () => {
    const khatma = makeKhatma('k1', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
      totalPages: 6,
      remainingPages: [5, 6],
      roundCount: 2,
      lastDistributionDate: '2026-07-10',
      memberIds: [amina.id, maryam.id],
    });
    const { user } = renderAdmin({
      data: {
        roster: [amina, maryam],
        khatmas: [khatma],
        assignments: {
          k1: [
            makeAssignment(amina.id, [round(1, [1, 2])], { 1: 100 }),
            makeAssignment(maryam.id, [round(2, [3, 4])], {}, 1),
          ],
        },
      },
    });

    expect(
      screen.getByRole('heading', { name: strings.admin.homeHeading }),
    ).toBeVisible();

    // Metrics: donut percent, segment legend counts, facts line, and title link.
    const title = seriesTitle(khatma, toArabicDigits);
    expect(screen.getByRole('img', { name: '٣٣٪' })).toBeInTheDocument();
    expect(screen.getByText(`${strings.admin.legendDone}: ٢`)).toBeVisible();
    expect(screen.getByText(`${strings.admin.legendPending}: ٢`)).toBeVisible();
    expect(screen.getByText(`${strings.admin.legendRemaining}: ٢`)).toBeVisible();
    expect(
      screen.getByText(
        `٢ ${strings.admin.pagesRemaining} · ${strings.admin.roundWord} ٢ · ${strings.admin.lastDistribution}: 2026-07-10`,
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: title })).toHaveAttribute(
      'href',
      '#/khatmas/k1',
    );
    expect(
      screen.getByRole('button', { name: strings.admin.pageMapHeading }),
    ).toBeVisible();

    // Pending readers: only Maryam holds a chunk, shown with exact page ranges.
    const pending = screen.getByText(strings.admin.pendingHeading).closest('div')!;
    expect(within(pending).getByText('Maryam')).toBeVisible();
    expect(within(pending).getByText('٣–٤')).toBeVisible();
    expect(within(pending).queryByText('Amina')).toBeNull();

    // Warning chips stay collapsed until the count-labelled warning section opens.
    const warnings = screen.getByRole('button', {
      name: `${strings.admin.warningsHeading} (١)`,
    });
    expect(
      screen.queryByText(`⚠ Maryam · ${strings.admin.warningYellowWord}`),
    ).toBeNull();
    await user.click(warnings);
    expect(
      screen.getByText(`⚠ Maryam · ${strings.admin.warningYellowWord}`),
    ).toBeVisible();
  });

  it('shows the empty dashboard when no series is active', () => {
    renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('done', { status: 'completed' })],
      },
    });

    expect(screen.getByText(strings.admin.noActive)).toBeVisible();
    expect(screen.queryByRole('button', { name: strings.admin.distribute })).toBeNull();
  });

  it('confirms, busy-disables, and reports success with rollover/completed notes', async () => {
    const pending = deferred<DistributionOutcome>();
    const runDistribution = vi.fn<WriteOperations['runDistribution']>(
      () => pending.promise,
    );
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, runDistribution },
    });

    const distribute = await screen.findByRole('button', {
      name: strings.admin.distribute,
    });
    await harness.user.click(distribute);

    // Confirmation gate: the confirm copy appears; approving runs distribution.
    expect(screen.getByText(strings.admin.confirmDistribute)).toBeVisible();
    await harness.user.click(
      screen.getByRole('button', { name: strings.common.confirm }),
    );

    // Busy-disable prevents a double-press while the write is in flight (P8).
    await waitFor(() => expect(distribute).toBeDisabled());
    expect(runDistribution).toHaveBeenCalledTimes(1);
    expect(runDistribution.mock.calls[0]![0]).toMatchObject({
      khatmaIds: ['k1'],
      today: todayIso(),
      redistributePages: false,
    });

    await act(async () => {
      pending.resolve({
        rolloverKhatmaId: 'roll',
        completedKhatmaIds: ['k1'],
        chunkCount: 1,
      });
    });

    const status = await screen.findByText((text) =>
      text.includes(strings.admin.distributeSuccess),
    );
    expect(status).toHaveTextContent(strings.admin.rolloverNote);
    expect(status).toHaveTextContent(strings.admin.completedNote);
    expect(status).toHaveAttribute('role', 'status');
  });

  it('does not distribute when the confirmation is dismissed', async () => {
    const runDistribution = vi.fn<WriteOperations['runDistribution']>();
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, runDistribution },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.distribute }),
    );
    await harness.user.click(screen.getByRole('button', { name: strings.common.cancel }));

    expect(runDistribution).not.toHaveBeenCalled();
    expect(screen.queryByText(strings.admin.distributeSuccess)).toBeNull();
  });

  it('surfaces a same-day collision as an error, not a green success (P7)', async () => {
    const runDistribution = vi
      .fn<WriteOperations['runDistribution']>()
      .mockRejectedValue(new AlreadyDistributedError());
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, runDistribution },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.distribute }),
    );
    await harness.user.click(
      screen.getByRole('button', { name: strings.common.confirm }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(strings.admin.alreadyDistributed);
  });

  it('offers redistribute (guard-bypassing) once distributed today', async () => {
    renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1', { lastDistributionDate: todayIso() })],
        assignments: { k1: [makeAssignment(amina.id, [round(1, [1, 2])])] },
      },
    });

    expect(await screen.findByText(strings.admin.distributedToday)).toBeVisible();
    expect(
      screen.getByRole('button', { name: strings.admin.redistribute }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: strings.admin.distribute })).toBeNull();
  });

  it('subscribes to every active khatma plus the open detail khatma (P9)', () => {
    const active = makeKhatma('active');
    const completed = makeKhatma('completed', { status: 'completed' });

    const onHome = renderAdmin({
      data: { roster: [amina], khatmas: [active, completed] },
    });
    expect(onHome.subscriptions.assignment('active').counts().active).toBe(1);
    expect(onHome.subscriptions.assignment('completed').counts().active).toBe(0);
    onHome.unmount();

    // The open detail khatma is subscribed even though it is completed.
    const onDetail = renderAdmin({
      route: '/khatmas/completed',
      data: { roster: [amina], khatmas: [active, completed] },
    });
    expect(onDetail.subscriptions.assignment('active').counts().active).toBe(1);
    expect(onDetail.subscriptions.assignment('completed').counts().active).toBe(1);
  });
});

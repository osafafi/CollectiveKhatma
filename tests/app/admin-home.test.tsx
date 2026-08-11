import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import { toWesternDigits } from '@/content/quran/symbols';
import {
  StaleDistributionDraftError,
  type DistributionOutcome,
} from '@/data/distribution';
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
const maryam: Person = { ...amina, id: 'p2', name: 'Maryam', emoji: '🌙' };
const fatima: Person = { ...amina, id: 'p3', name: 'Fatima', pagesPerDay: 3 };

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
            makeAssignment(maryam.id, [round(1, [3, 4])], {}, 1),
          ],
        },
      },
    });

    expect(
      screen.getByRole('heading', { name: strings.admin.homeHeading }),
    ).toBeVisible();

    // Metrics: donut percent, segment legend counts, facts line, and title link.
    const title = seriesTitle(khatma, toWesternDigits);
    expect(screen.getByRole('img', { name: '33٪' })).toBeInTheDocument();
    expect(screen.getByText(`${strings.admin.legendDone}: 2`)).toBeVisible();
    expect(screen.getByText(`${strings.admin.legendPending}: 2`)).toBeVisible();
    expect(screen.getByText(`${strings.admin.legendRemaining}: 2`)).toBeVisible();
    expect(
      screen.getByText(
        `2 ${strings.admin.pagesRemaining} · ${strings.admin.roundWord} 2 · ${strings.admin.lastDistribution}: 2026-07-10`,
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: title })).toHaveAttribute(
      'href',
      '#/khatmas/k1',
    );
    expect(
      screen.getByRole('button', { name: strings.admin.pageMapHeading }),
    ).toBeVisible();

    // Round history is split into collapsed pending/completed sections.
    const pending = screen.getByRole('button', {
      name: `${strings.admin.pendingHeading} (${toWesternDigits(1)})`,
    });
    const completed = screen.getByRole('button', {
      name: `${strings.admin.completedPagesHeading} (${toWesternDigits(1)})`,
    });
    expect(pending.querySelectorAll('svg')).toHaveLength(2);
    expect(completed.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.queryByText('Maryam')).toBeNull();
    expect(screen.queryByText('Amina')).toBeNull();

    await user.click(pending);
    const pendingRow = screen.getByText('Maryam').closest('li')!;
    expect(pendingRow).toHaveTextContent(
      `${strings.admin.roundWord} ${toWesternDigits(1)} · 3–4`,
    );
    expect(within(pendingRow).getByRole('img', { name: 'Maryam: 🌙' })).toBeVisible();
    expect(within(pendingRow).queryByText(/Amina/)).toBeNull();

    await user.click(completed);
    const completedRow = screen.getByText('Amina').closest('li')!;
    expect(within(completedRow).getByRole('img', { name: 'Amina: A' })).toBeVisible();
    expect(completedRow).toHaveTextContent(
      `${strings.admin.roundWord} ${toWesternDigits(1)}`,
    );
    expect(completedRow).toHaveTextContent('1–2');

    // Warning chips stay collapsed until the count-labelled warning section opens.
    const warnings = screen.getByRole('button', {
      name: `${strings.admin.warningsHeading} (1)`,
    });
    expect(warnings.querySelectorAll('svg')).toHaveLength(2);
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
    expect(
      screen.queryByRole('button', { name: strings.admin.prepareNextRound }),
    ).toBeNull();
  });

  it('previews, confirms atomically, and reports the committed run', async () => {
    const pending = deferred<DistributionOutcome>();
    const commitDistributionRun = vi.fn<WriteOperations['commitDistributionRun']>(
      () => pending.promise,
    );
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, commitDistributionRun },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    );
    expect(
      screen.getByRole('heading', { name: strings.admin.prepareNextRound }),
    ).toBeVisible();
    expect(screen.getByText('Amina', { selector: 'p' })).toBeVisible();

    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.optionalRoundAdjustments }),
    );
    expect(screen.getByLabelText(strings.admin.roundCapacity)).toHaveValue(2);

    const confirm = screen.getByRole('button', {
      name: strings.admin.confirmAndStartRound,
    });
    await harness.user.click(confirm);

    await waitFor(() => expect(confirm).toBeDisabled());
    expect(commitDistributionRun).toHaveBeenCalledTimes(1);
    expect(commitDistributionRun.mock.calls[0]![0]).toMatchObject({
      khatmaIds: ['k1'],
      today: todayIso(),
      mode: 'new-round',
    });
    expect(commitDistributionRun.mock.calls[0]![0].expectedSourceRevision).toEqual(
      expect.any(String),
    );

    await act(async () => {
      pending.resolve({
        runId: 'run-2',
        revision: 1,
        rolloverKhatmaId: 'roll',
        completedKhatmaIds: ['k1'],
        chunkCount: 1,
      });
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(strings.admin.roundCommitSuccess);
    expect(status).toHaveTextContent(
      strings.admin.savedAssignmentCount.replace('{count}', '1'),
    );
    expect(status).toHaveTextContent(strings.admin.rolloverNote);
    expect(status).toHaveTextContent(strings.admin.completedNote);
    expect(
      screen.queryByRole('heading', { name: strings.admin.prepareNextRound }),
    ).toBeNull();
  });

  it('does not commit when the preview is dismissed', async () => {
    const commitDistributionRun = vi.fn<WriteOperations['commitDistributionRun']>();
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, commitDistributionRun },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    );
    await harness.user.click(screen.getByRole('button', { name: strings.common.cancel }));

    expect(commitDistributionRun).not.toHaveBeenCalled();
    expect(screen.queryByText(strings.admin.roundCommitSuccess)).toBeNull();
  });

  it('surfaces a stale preview and keeps it open for review', async () => {
    const commitDistributionRun = vi
      .fn<WriteOperations['commitDistributionRun']>()
      .mockRejectedValue(new StaleDistributionDraftError());
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, commitDistributionRun },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    );
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.confirmAndStartRound }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(strings.admin.staleDistributionPreview);
    expect(
      screen.getByRole('heading', { name: strings.admin.prepareNextRound }),
    ).toBeVisible();
  });

  it('keeps the date informational and offers both admin-controlled actions', async () => {
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1', { lastDistributionDate: todayIso() })],
        assignments: { k1: [makeAssignment(amina.id, [round(1, [1, 2])])] },
      },
    });

    expect(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    ).toBeEnabled();
    const adjust = screen.getByRole('button', {
      name: strings.admin.adjustCurrentRound,
    });
    expect(adjust).toBeEnabled();
    await harness.user.click(adjust);
    expect(
      screen.getByRole('heading', { name: strings.admin.adjustCurrentRound }),
    ).toBeVisible();
  });

  it('waits for assignment snapshots before enabling round controls', async () => {
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
      },
    });

    const prepare = await screen.findByRole('button', {
      name: strings.admin.prepareNextRound,
    });
    expect(prepare).toBeDisabled();
    expect(screen.getByText(strings.admin.roundDataLoading)).toBeVisible();

    act(() => harness.subscriptions.assignment('k1').emit([]));

    await waitFor(() => expect(prepare).toBeEnabled());
    expect(screen.queryByText(strings.admin.roundDataLoading)).toBeNull();
  });

  it('only offers swaps between members with exactly equal capacities', async () => {
    const commitDistributionRun = vi
      .fn<WriteOperations['commitDistributionRun']>()
      .mockResolvedValue({
        runId: 'run-swapped',
        revision: 1,
        completedKhatmaIds: [],
        chunkCount: 3,
      });
    const harness = renderAdmin({
      data: {
        roster: [amina, maryam, fatima],
        khatmas: [
          makeKhatma('k1', {
            totalPages: 12,
            remainingPages: Array.from({ length: 12 }, (_, index) => index + 1),
            memberIds: [amina.id, maryam.id, fatima.id],
            capacities: {
              [amina.id]: { pages: 2, surahs: 0, juz: 0 },
              [maryam.id]: { pages: 2, surahs: 0, juz: 0 },
              [fatima.id]: { pages: 3, surahs: 0, juz: 0 },
            },
          }),
        ],
        assignments: {
          k1: [
            makeAssignment(amina.id),
            makeAssignment(maryam.id),
            makeAssignment(fatima.id),
          ],
        },
      },
      operations: { ...writeOperations, commitDistributionRun },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    );
    const swapSelects = screen.getAllByRole('combobox', {
      name: strings.admin.swapPagesWith,
    });
    expect(swapSelects).toHaveLength(2);
    await harness.user.click(swapSelects[0]!);
    const swapOptions = within(screen.getByRole('listbox'));
    expect(swapOptions.queryByRole('option', { name: fatima.name })).toBeNull();
    await harness.user.click(swapOptions.getByRole('option', { name: maryam.name }));
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.confirmAndStartRound }),
    );

    expect(commitDistributionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        adjustments: expect.objectContaining({ recipientOrder: ['p2', 'p1', 'p3'] }),
      }),
    );
  });

  it('requires explicit rollover acknowledgment before confirmation', async () => {
    const commitDistributionRun = vi
      .fn<WriteOperations['commitDistributionRun']>()
      .mockResolvedValue({
        runId: 'run-rollover',
        revision: 1,
        rolloverKhatmaId: 'k2',
        completedKhatmaIds: ['k1'],
        chunkCount: 1,
      });
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1', { remainingPages: [] })],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, commitDistributionRun },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.prepareNextRound }),
    );
    expect(screen.getByText(/لن تُنشأ قبل التأكيد/)).toBeVisible();
    const confirm = screen.getByRole('button', {
      name: strings.admin.confirmAndStartRound,
    });
    expect(confirm).toBeDisabled();
    await harness.user.click(
      screen.getByRole('checkbox', { name: strings.admin.confirmRolloverBoundary }),
    );
    expect(confirm).toBeEnabled();
    expect(commitDistributionRun).not.toHaveBeenCalled();
  });

  it('explains and disables a zero-change current-round adjustment', async () => {
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.adjustCurrentRound }),
    );
    expect(screen.getByText(strings.admin.noDistributionChanges)).toBeVisible();
    expect(
      screen.getByRole('button', { name: strings.admin.confirmAndStartRound }),
    ).toBeDisabled();
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

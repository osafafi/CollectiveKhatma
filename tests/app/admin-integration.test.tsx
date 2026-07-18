import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import type { DistributionOutcome } from '@/data/distribution';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The admin routes load surah/juz maps (distribution scope resolution) and surah
// names (create checklist + capacity selects); mock the loader so these jsdom
// integration journeys stay deterministic and offline (mirrors the per-route
// admin suites). `range`-scope khatmas need no maps for their own metrics.
const loader = vi.hoisted(() => ({
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const INDEX: QuranIndex = {
  totalPages: 604,
  surahToPages: { 1: [1, 1], 2: [2, 49] },
  juzToPages: { 1: [1, 21] },
};
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

const amina: Person = {
  id: 'p1',
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
    totalPages: 6,
    scope: { kind: 'range', fromPage: 1, toPage: 6 },
    memberIds: [amina.id],
    capacities: { [amina.id]: { pages: 2, surahs: 0, juz: 0 } },
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

function renderAdmin(options: RenderWithAppProvidersOptions = {}) {
  return renderWithAppProviders(<AdminExperience />, options);
}

/**
 *  — admin integration layer. The per-route suites prove
 * each admin route's own states, validation, and drafts. These scenarios instead
 * walk **continuous, cross-feature journeys** through the composed admin tree
 * (`AdminAssignmentsSubscriptions` + `AdminShell` + routes) to prove the
 * exit criterion — functional parity plus realtime updates that never disrupt
 * in-progress work — holds when everything is wired together. They also pin the
 * one admin risk-oracle row the steady-state suites do not exercise dynamically:
 * **P10** (a khatma leaving the admin's active ∪ open set releases its listener).
 */
describe('admin application integration', () => {
  beforeEach(() => {
    loader.getQuranIndex.mockReset();
    loader.getQuranIndex.mockResolvedValue(INDEX);
    loader.getSurahs.mockReset();
    loader.getSurahs.mockResolvedValue(SURAHS);
  });

  it('creates a khatma, reflects it via a live snapshot, then opens and edits its detail (CRUD + validation)', async () => {
    const createKhatma = vi
      .fn<WriteOperations['createKhatma']>()
      .mockResolvedValue('new-k');
    const renameSeries = vi
      .fn<WriteOperations['renameSeries']>()
      .mockResolvedValue(undefined);
    const updateKhatma = vi
      .fn<WriteOperations['updateKhatma']>()
      .mockResolvedValue(undefined);
    const harness = renderAdmin({
      route: '/khatmas',
      data: { roster: [amina], khatmas: [] },
      operations: { ...writeOperations, createKhatma, renameSeries, updateKhatma },
    });

    // Open the create form and name the series.
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.createNewButton }),
    );
    await harness.user.type(
      screen.getByLabelText(strings.admin.seriesNamePlaceholder),
      'أهل القرآن',
    );

    // Validation blocks a create with no member selected; the form stays open.
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.createButton }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      strings.admin.selectMembers,
    );
    expect(createKhatma).not.toHaveBeenCalled();

    // Correcting the selection lets the create through.
    await harness.user.click(screen.getByRole('checkbox', { name: amina.name }));
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.createButton }),
    );
    await waitFor(() => expect(createKhatma).toHaveBeenCalledTimes(1));
    expect(createKhatma.mock.calls[0]![0]).toMatchObject({
      seriesName: 'أهل القرآن',
      memberIds: ['p1'],
    });

    // The form resets/closes on success; the write lands via the realtime bridge.
    expect(
      await screen.findByRole('button', { name: strings.admin.createNewButton }),
    ).toBeVisible();
    harness.subscriptions.khatmas.emit([
      makeKhatma('new-k', { seriesId: 'ahl', seriesName: 'أهل القرآن', seriesNumber: 1 }),
    ]);

    // The new khatma now lists; following its link crosses into the detail route.
    const detailLink = await screen.findByRole('link', { name: /أهل القرآن/ });
    expect(detailLink).toHaveAttribute('href', '#/khatmas/new-k');
    await harness.user.click(detailLink);

    expect(await screen.findByRole('heading', { name: 'أهل القرآن ١' })).toBeVisible();

    // Editing the series name on the detail route saves through renameSeries.
    const editName = screen.getByLabelText(strings.admin.seriesNamePlaceholder);
    await harness.user.clear(editName);
    await harness.user.type(editName, 'أهل الذكر');
    await harness.user.click(
      screen.getByRole('button', { name: strings.admin.saveKhatma }),
    );

    await waitFor(() => expect(renameSeries).toHaveBeenCalledWith('ahl', 'أهل الذكر'));
    expect(await screen.findByText(strings.admin.saved)).toBeVisible();
  });

  it('distributes on Home, then a live completion snapshot drops the khatma and releases its listener (distribution + P10)', async () => {
    const runDistribution = vi
      .fn<WriteOperations['runDistribution']>()
      .mockResolvedValue({
        completedKhatmaIds: ['k1'],
        chunkCount: 1,
      } as DistributionOutcome);
    const harness = renderAdmin({
      data: {
        roster: [amina],
        khatmas: [makeKhatma('k1')],
        assignments: { k1: [makeAssignment(amina.id)] },
      },
      operations: { ...writeOperations, runDistribution },
    });

    // The active khatma's assignments are subscribed while it is on the dashboard.
    expect(harness.subscriptions.assignment('k1').counts()).toMatchObject({
      starts: 1,
      active: 1,
    });

    await harness.user.click(
      await screen.findByRole('button', { name: strings.admin.distribute }),
    );
    await harness.user.click(
      screen.getByRole('button', { name: strings.common.confirm }),
    );

    // The distribution reports a completion.
    const status = await screen.findByText((text) =>
      text.includes(strings.admin.distributeSuccess),
    );
    expect(status).toHaveTextContent(strings.admin.completedNote);
    expect(runDistribution).toHaveBeenCalledTimes(1);

    // The realtime snapshot that completes k1 drops it from the active dashboard
    // and releases its now-unwanted assignment listener (P10) — no dangling sub.
    harness.subscriptions.khatmas.emit([
      makeKhatma('k1', { status: 'completed', remainingPages: [] }),
    ]);

    expect(await screen.findByText(strings.admin.noActive)).toBeVisible();
    await waitFor(() =>
      expect(harness.subscriptions.assignment('k1').counts()).toMatchObject({
        stops: 1,
        active: 0,
      }),
    );
  });

  it('reconciles the listener set on navigation: leaving a completed detail releases only that listener (P9 → P10)', async () => {
    const active = makeKhatma('active', { seriesName: 'سلسلة نشطة' });
    const completed = makeKhatma('done', {
      seriesName: 'سلسلة مكتملة',
      status: 'completed',
      completedAt: Date.UTC(2026, 6, 12),
      duaReciterId: amina.id,
    });
    const harness = renderAdmin({
      route: '/khatmas/done',
      data: {
        roster: [amina],
        khatmas: [active, completed],
        assignments: {
          active: [makeAssignment(amina.id)],
          done: [makeAssignment(amina.id)],
        },
      },
    });

    // On the completed detail route the admin set is active ∪ open (P9): both the
    // active khatma and the open (completed) detail khatma are subscribed.
    expect(screen.getByRole('heading', { name: 'سلسلة مكتملة ١' })).toBeVisible();
    expect(harness.subscriptions.assignment('active').counts()).toMatchObject({
      starts: 1,
      active: 1,
    });
    expect(harness.subscriptions.assignment('done').counts()).toMatchObject({
      starts: 1,
      active: 1,
    });

    // Navigating to Home drops the completed khatma from the wanted set.
    await harness.user.click(screen.getByRole('link', { name: strings.admin.navHome }));
    expect(
      await screen.findByRole('heading', { name: strings.admin.homeHeading }),
    ).toBeVisible();

    // Only the departing (completed) listener is released; the active khatma's
    // listener is untouched — navigation reconciled the set, not restarted it.
    await waitFor(() =>
      expect(harness.subscriptions.assignment('done').counts()).toMatchObject({
        stops: 1,
        active: 0,
      }),
    );
    expect(harness.subscriptions.assignment('active').counts()).toMatchObject({
      starts: 1,
      stops: 0,
      active: 1,
    });
  });

  it('recovers from a failed distribution: an error alert, a re-enabled button, then a successful retry (error flow)', async () => {
    const runDistribution = vi
      .fn<WriteOperations['runDistribution']>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        completedKhatmaIds: [],
        chunkCount: 1,
      } as DistributionOutcome);
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
    await harness.user.click(
      screen.getByRole('button', { name: strings.common.confirm }),
    );

    // A generic failure is surfaced as an error alert (the generic copy, not the
    // same-day AlreadyDistributed message) — never announced as a green success.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(strings.admin.distributeError);
    expect(alert).not.toHaveTextContent(strings.admin.alreadyDistributed);

    // The busy state cleared with the failure, so the admin can retry.
    await waitFor(() => expect(distribute).toBeEnabled());

    await harness.user.click(distribute);
    await harness.user.click(
      screen.getByRole('button', { name: strings.common.confirm }),
    );

    const success = await screen.findByRole('status');
    expect(success).toHaveTextContent(strings.admin.distributeSuccess);
    expect(runDistribution).toHaveBeenCalledTimes(2);
  });
});

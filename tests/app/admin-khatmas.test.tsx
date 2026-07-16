import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import type { Khatma, Person } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The create form loads surah/juz maps (scope resolution) and surah names (the
// checklist + capacity selects); mock the loader so jsdom tests stay offline.
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

function mockOperations(): WriteOperations & { createKhatma: ReturnType<typeof vi.fn> } {
  return {
    ...writeOperations,
    createKhatma: vi
      .fn<WriteOperations['createKhatma']>()
      .mockResolvedValue('new-khatma'),
  };
}

function renderKhatmas(
  data: RenderWithAppProvidersOptions['data'],
  options: Omit<RenderWithAppProvidersOptions, 'route' | 'data'> = {},
) {
  const operations =
    (options.operations as ReturnType<typeof mockOperations>) ?? mockOperations();
  const harness = renderWithAppProviders(<AdminExperience />, {
    route: '/khatmas',
    data,
    ...options,
    operations,
  });
  return { ...harness, operations: operations as ReturnType<typeof mockOperations> };
}

describe('admin Khatmas list/create (RM-520)', () => {
  beforeEach(() => {
    loader.getQuranIndex.mockReset();
    loader.getQuranIndex.mockResolvedValue(INDEX);
    loader.getSurahs.mockReset();
    loader.getSurahs.mockResolvedValue(SURAHS);
  });

  it('lists khatmas active-first then completed, with badge, percent, and detail link', () => {
    const active = makeKhatma('act', {
      seriesName: 'سلسلة نشطة',
      createdAt: Date.UTC(2026, 6, 1),
    });
    const completed = makeKhatma('done', {
      seriesName: 'سلسلة مكتملة',
      status: 'completed',
      createdAt: Date.UTC(2026, 5, 1),
    });
    renderKhatmas({ roster: [amina], khatmas: [completed, active] });

    const list = screen.getByRole('region', { name: strings.admin.khatmasHeading });
    const links = within(list).getAllByRole('link');
    // Active sorts before completed regardless of the input order.
    expect(links[0]).toHaveTextContent('سلسلة نشطة');
    expect(links[1]).toHaveTextContent('سلسلة مكتملة');
    expect(links[0]).toHaveAttribute('href', '#/khatmas/act');

    expect(within(links[0]!).getByText(strings.admin.statusActive)).toBeVisible();
    expect(within(links[1]!).getByText(strings.admin.statusCompleted)).toBeVisible();
    // Completed always reads 100%; the fresh active khatma reads 0%.
    expect(within(links[1]!).getByText('١٠٠٪')).toBeVisible();
    expect(within(links[0]!).getByText('٠٪')).toBeVisible();
  });

  it('shows the empty copy when there are no khatmas', () => {
    renderKhatmas({ roster: [amina], khatmas: [] });
    const list = screen.getByRole('region', { name: strings.admin.khatmasHeading });
    expect(within(list).getByText(strings.admin.noActive)).toBeVisible();
  });

  it('gates the create form behind a button and keeps the draft across cancel', async () => {
    const { user } = renderKhatmas({ roster: [amina], khatmas: [] });

    expect(screen.queryByLabelText(strings.admin.seriesNamePlaceholder)).toBeNull();
    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));

    const nameField = screen.getByLabelText(strings.admin.seriesNamePlaceholder);
    await user.type(nameField, 'أهل القرآن');

    // Cancel hides the form but the lifted draft survives a reopen.
    await user.click(screen.getByRole('button', { name: strings.admin.cancel }));
    expect(screen.queryByLabelText(strings.admin.seriesNamePlaceholder)).toBeNull();
    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));
    expect(screen.getByLabelText(strings.admin.seriesNamePlaceholder)).toHaveValue(
      'أهل القرآن',
    );
  });

  it('validates a blank name and an empty member selection before writing', async () => {
    const { user, operations } = renderKhatmas({ roster: [amina], khatmas: [] });
    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));

    // Blank name.
    await user.click(screen.getByRole('button', { name: strings.admin.createButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      strings.admin.seriesNameRequired,
    );
    expect(operations.createKhatma).not.toHaveBeenCalled();

    // Named but no members selected.
    await user.type(
      screen.getByLabelText(strings.admin.seriesNamePlaceholder),
      'أهل القرآن',
    );
    await user.click(screen.getByRole('button', { name: strings.admin.createButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      strings.admin.selectMembers,
    );
    expect(operations.createKhatma).not.toHaveBeenCalled();
  });

  it('creates a brand-new series (full scope, solo capacity default) and resets', async () => {
    const { user, operations } = renderKhatmas({ roster: [amina], khatmas: [] });
    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));

    await user.type(
      screen.getByLabelText(strings.admin.seriesNamePlaceholder),
      'أهل القرآن',
    );
    await user.click(screen.getByRole('checkbox', { name: amina.name }));
    await user.click(screen.getByRole('button', { name: strings.admin.createButton }));

    await waitFor(() => expect(operations.createKhatma).toHaveBeenCalledTimes(1));
    const input = operations.createKhatma.mock.calls[0]![0];
    expect(input).toMatchObject({
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
      memberIds: ['p1'],
      scope: { kind: 'full' },
      duaReciterId: 'p1',
      // A solo reader defaults to one whole juz.
      capacities: { p1: { pages: 0, surahs: 0, juz: 1 } },
    });
    expect(input.totalPages).toBe(604);
    expect(input.remainingPages).toHaveLength(604);

    // The form resets and closes on success.
    expect(
      screen.getByRole('button', { name: strings.admin.createNewButton }),
    ).toBeVisible();
  });

  it('continues an existing series when the name matches, with the next number', async () => {
    const existing = makeKhatma('first', {
      seriesId: 'ahl',
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
    });
    const { user, operations } = renderKhatmas({
      roster: [amina, maryam],
      khatmas: [existing],
    });
    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));
    await user.type(
      screen.getByLabelText(strings.admin.seriesNamePlaceholder),
      'أهل القرآن',
    );

    // The continuation note announces the next number.
    expect(screen.getByText(`${strings.admin.continuesSeries} ٢`)).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: amina.name }));
    await user.click(screen.getByRole('button', { name: strings.admin.createButton }));

    await waitFor(() => expect(operations.createKhatma).toHaveBeenCalledTimes(1));
    expect(operations.createKhatma.mock.calls[0]![0]).toMatchObject({
      seriesId: 'ahl',
      seriesName: 'أهل القرآن',
      seriesNumber: 2,
    });
  });
});

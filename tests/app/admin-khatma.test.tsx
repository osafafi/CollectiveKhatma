import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

// The detail page loads surah names for the capacity selects; mock the loader.
const loader = vi.hoisted(() => ({
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const INDEX: QuranIndex = {
  totalPages: 604,
  surahToPages: { 1: [1, 1] },
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
    seriesId: 'ahl',
    seriesName: 'أهل القرآن',
    seriesNumber: 1,
    totalPages: 6,
    scope: { kind: 'range', fromPage: 1, toPage: 6 },
    memberIds: [amina.id],
    capacities: { [amina.id]: { pages: 2, surahs: 0, juz: 0 } },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [3, 4, 5, 6],
    roundCount: 1,
    createdAt: Date.UTC(2026, 6, 1),
    ...overrides,
  };
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

function makeAssignment(
  memberId: string,
  rounds: RoundChunk[] = [],
  doneByRound: Record<number, number> = {},
  missedStreak = 0,
): Assignment {
  return { memberId, rounds, doneByRound, missedStreak };
}

/** Stub every khatma-detail mutation so tests never reach Firestore. */
function mockOperations() {
  return {
    ...writeOperations,
    renameSeries: vi.fn<WriteOperations['renameSeries']>().mockResolvedValue(undefined),
    setSeriesImage: vi
      .fn<WriteOperations['setSeriesImage']>()
      .mockResolvedValue(undefined),
    updateKhatma: vi.fn<WriteOperations['updateKhatma']>().mockResolvedValue(undefined),
    completeKhatma: vi
      .fn<WriteOperations['completeKhatma']>()
      .mockResolvedValue(undefined),
    deleteKhatma: vi.fn<WriteOperations['deleteKhatma']>().mockResolvedValue(undefined),
    addMemberToKhatma: vi
      .fn<WriteOperations['addMemberToKhatma']>()
      .mockResolvedValue(undefined),
    releaseMemberChunk: vi
      .fn<WriteOperations['releaseMemberChunk']>()
      .mockResolvedValue(undefined),
    removeMemberFromKhatma: vi
      .fn<WriteOperations['removeMemberFromKhatma']>()
      .mockResolvedValue(undefined),
    markRoundDone: vi.fn<WriteOperations['markRoundDone']>().mockResolvedValue(undefined),
    clearRoundDone: vi
      .fn<WriteOperations['clearRoundDone']>()
      .mockResolvedValue(undefined),
    clearWarning: vi.fn<WriteOperations['clearWarning']>().mockResolvedValue(undefined),
  };
}

function renderDetail(
  id: string,
  data: RenderWithAppProvidersOptions['data'],
  options: Omit<RenderWithAppProvidersOptions, 'route' | 'data' | 'operations'> = {},
) {
  const operations = mockOperations();
  const harness = renderWithAppProviders(<AdminExperience />, {
    route: `/khatmas/${id}`,
    data,
    ...options,
    operations,
  });
  return { ...harness, operations };
}

describe('admin Khatma detail (RM-530)', () => {
  beforeEach(() => {
    loader.getQuranIndex.mockReset();
    loader.getQuranIndex.mockResolvedValue(INDEX);
    loader.getSurahs.mockReset();
    loader.getSurahs.mockResolvedValue(SURAHS);
  });

  it('shows loading before khatmas arrive and not-found once loaded', () => {
    const loading = renderDetail('missing', { roster: [amina], khatmas: [] });
    expect(screen.getByText(strings.common.loading)).toBeVisible();
    loading.unmount();

    renderDetail('missing', { roster: [amina], khatmas: [makeKhatma('other')] });
    expect(screen.getByText(strings.admin.noActive)).toBeVisible();
  });

  it('renders the header, status, and facts for an active khatma', () => {
    renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k', { roundCount: 3, lastDistributionDate: '2026-07-10' })],
      assignments: { k: [makeAssignment(amina.id)] },
    });
    expect(screen.getByRole('heading', { name: 'أهل القرآن ١' })).toBeVisible();
    expect(screen.getByText(strings.admin.statusActive)).toBeVisible();
    expect(
      screen.getByText(new RegExp(`${strings.admin.lastDistribution}: 2026-07-10`)),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: strings.admin.pageMapHeading }),
    ).toBeVisible();
  });

  it('saves edits through renameSeries + updateKhatma and shows the saved status', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    const nameField = screen.getByLabelText(strings.admin.seriesNamePlaceholder);
    await user.clear(nameField);
    await user.type(nameField, 'أهل الذكر');
    await user.click(screen.getByRole('button', { name: strings.admin.saveKhatma }));

    await waitFor(() =>
      expect(operations.renameSeries).toHaveBeenCalledWith('ahl', 'أهل الذكر'),
    );
    expect(await screen.findByText(strings.admin.saved)).toBeVisible();
  });

  it('assigns edited public artwork to the whole khatma series', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id)] },
    });
    await user.click(
      screen.getByRole('button', { name: strings.admin.chooseSeriesImage }),
    );
    const dialog = screen.getByRole('dialog', {
      name: strings.admin.seriesImageGalleryHeading,
    });
    await user.click(within(dialog).getByRole('button', { name: 'green-arch.svg' }));
    await user.click(
      within(dialog).getByRole('button', { name: strings.common.confirm }),
    );
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('dialog', { name: strings.admin.seriesImageGalleryHeading }),
    );
    await user.click(screen.getByRole('button', { name: strings.admin.saveKhatma }));

    await waitFor(() =>
      expect(operations.setSeriesImage).toHaveBeenCalledWith('ahl', 'green-arch.svg'),
    );
    expect(await screen.findByText(strings.admin.saved)).toBeVisible();
  });

  it('toggles a member chunk done via markRoundDone', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id, [round(1, [1, 2])])] },
    });

    await user.click(
      screen.getByRole('button', { name: new RegExp(strings.admin.chunkPending) }),
    );
    expect(operations.markRoundDone).toHaveBeenCalledWith('k', 'p1', 1);
  });

  it('clears a member warning across the series active khatmas', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id, [round(1, [1, 2])], {}, 1)] },
    });

    await user.click(screen.getByRole('button', { name: strings.admin.clearWarning }));
    expect(operations.clearWarning).toHaveBeenCalledWith(['k'], 'p1');
  });

  it('returns a pending chunk to the pool only after confirmation', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id, [round(1, [1, 2])])] },
    });

    await user.click(screen.getByRole('button', { name: strings.admin.returnToPool }));
    await user.click(screen.getByRole('button', { name: strings.common.confirm }));
    expect(operations.releaseMemberChunk).toHaveBeenCalledWith('k', 'p1');
  });

  it('saves a member capacity edit through updateKhatma (applies on the button)', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id, [round(1, [1, 2])])] },
    });

    await user.click(
      screen.getByRole('button', { name: `${strings.admin.saveCapacity}: ${amina.name}` }),
    );
    // The explicitly stored capacity is written back unchanged.
    expect(operations.updateKhatma).toHaveBeenCalledWith('k', {
      capacities: { p1: { pages: 2, surahs: 0, juz: 0 } },
    });
  });

  it('adds a candidate member through addMemberToKhatma', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina, maryam],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    await user.click(screen.getByRole('button', { name: strings.admin.addMember }));
    expect(operations.addMemberToKhatma).toHaveBeenCalledWith('k', 'p2', {
      pages: 2,
      surahs: 0,
      juz: 0,
    });
  });

  it('completes and deletes the khatma only after confirmation', async () => {
    const { user, operations } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k')],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    await user.click(screen.getByRole('button', { name: strings.admin.markComplete }));
    await user.click(screen.getByRole('button', { name: strings.common.confirm }));
    expect(operations.completeKhatma).toHaveBeenCalledWith('k');

    // Wait for the first dialog's exit transition to lift the root `aria-hidden`.
    await user.click(await screen.findByRole('button', { name: strings.admin.remove }));
    await user.click(screen.getByRole('button', { name: strings.common.confirm }));
    expect(operations.deleteKhatma).toHaveBeenCalledWith('k');
  });

  it('starts the next khatma by opening a prefilled create form on the list route', async () => {
    const { user } = renderDetail('k', {
      roster: [amina],
      khatmas: [makeKhatma('k', { seriesName: 'أهل القرآن', memberIds: [amina.id] })],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    await user.click(screen.getByRole('button', { name: strings.admin.startNext }));

    // Jumped to #/khatmas with the create form open and prefilled from the khatma.
    const nameField = await screen.findByLabelText(strings.admin.seriesNamePlaceholder);
    expect(nameField).toHaveValue('أهل القرآن');
    expect(screen.getByRole('checkbox', { name: amina.name })).toBeChecked();
    expect(
      screen.getByRole('button', { name: strings.admin.createButton }),
    ).toBeVisible();
  });

  it('shows only start-next and history for a completed khatma', () => {
    renderDetail('k', {
      roster: [amina],
      khatmas: [
        makeKhatma('k', {
          status: 'completed',
          completedAt: Date.UTC(2026, 6, 12),
          duaReciterId: amina.id,
        }),
      ],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    expect(screen.getByRole('button', { name: strings.admin.startNext })).toBeVisible();
    expect(screen.queryByRole('button', { name: strings.admin.markComplete })).toBeNull();
    expect(screen.queryByText(strings.admin.membersProgress)).toBeNull();
    // The completed khatma appears in its own series history with the reciter.
    expect(
      screen.getByText(new RegExp(`${strings.admin.completedOn} 2026-07-12`)),
    ).toBeVisible();
  });
});

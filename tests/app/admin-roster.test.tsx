import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

const amina: Person = {
  id: 'p1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};
const maryam: Person = {
  ...amina,
  id: 'p2',
  name: 'Maryam',
  pagesPerDay: 1,
  enabled: false,
};

/** Stub every roster mutation so tests never reach Firestore. */
function mockRosterOperations(): WriteOperations & {
  addPerson: ReturnType<typeof vi.fn>;
  renamePerson: ReturnType<typeof vi.fn>;
  updatePerson: ReturnType<typeof vi.fn>;
  removePerson: ReturnType<typeof vi.fn>;
} {
  return {
    ...writeOperations,
    addPerson: vi.fn<WriteOperations['addPerson']>().mockResolvedValue('new-id'),
    renamePerson: vi.fn<WriteOperations['renamePerson']>().mockResolvedValue(undefined),
    updatePerson: vi.fn<WriteOperations['updatePerson']>().mockResolvedValue(undefined),
    removePerson: vi.fn<WriteOperations['removePerson']>().mockResolvedValue(undefined),
  };
}

function renderRoster(
  roster: Person[],
  options: Omit<RenderWithAppProvidersOptions, 'route' | 'data'> = {},
) {
  const operations = options.operations ?? mockRosterOperations();
  const harness = renderWithAppProviders(<AdminExperience />, {
    route: '/roster',
    data: { roster, khatmas: [] },
    ...options,
    operations,
  });
  return {
    ...harness,
    operations: operations as ReturnType<typeof mockRosterOperations>,
  };
}

describe('admin Roster', () => {
  it('lists every member, whether enabled or paused', () => {
    renderRoster([amina, maryam]);

    expect(
      screen.getByRole('heading', { name: strings.admin.rosterHeading }),
    ).toBeVisible();

    // Maryam is paused, but a paused member still gets a row; the enable/disable
    // toggle is what carries her state.
    const aminaRow = screen.getByText('Amina').closest('li')!;
    const maryamRow = screen.getByText('Maryam').closest('li')!;
    const aminaActions = aminaRow.querySelector<HTMLElement>(
      '[data-roster-row-section="actions"]',
    )!;
    const aminaMember = aminaRow.querySelector<HTMLElement>(
      '[data-roster-row-section="member"]',
    )!;
    expect(
      within(aminaActions).getByRole('button', {
        name: `${strings.admin.rename}: ${amina.name}`,
      }),
    ).toBeVisible();
    expect(
      within(aminaActions).getByRole('button', {
        name: `${strings.admin.remove}: ${amina.name}`,
      }),
    ).toBeVisible();
    expect(
      within(aminaActions).getByLabelText(`${strings.admin.reliabilityScore}: 0 / 10`),
    ).toBeVisible();
    expect(within(aminaMember).getByText('Amina')).toBeVisible();
    expect(
      within(aminaMember).getByRole('group', {
        name: strings.admin.pagesPerDayLabel,
      }),
    ).toBeVisible();
    expect(
      within(aminaMember).getByRole('button', { name: strings.admin.disable }),
    ).toBeVisible();
    expect(
      within(maryamRow).getByRole('button', { name: strings.admin.enable }),
    ).toBeVisible();
  });

  it('shows a 0–10 reliability grade from completed streak and pages per reading day', async () => {
    const sara: Person = { ...amina, id: 'p3', name: 'Sara', pagesPerDay: 5 };
    const khatma: Khatma = {
      id: 'completed',
      seriesId: 'series',
      seriesName: 'Series',
      seriesNumber: 1,
      totalPages: 604,
      scope: { kind: 'full' },
      memberIds: [amina.id, maryam.id, sara.id],
      capacities: {
        [amina.id]: { pages: 10, surahs: 0, juz: 0 },
        [maryam.id]: { pages: 2, surahs: 0, juz: 0 },
        [sara.id]: { pages: 5, surahs: 0, juz: 0 },
      },
      status: 'completed',
      remainingPages: [],
      roundCount: 30,
      duaReciterId: amina.id,
      completedAt: Date.UTC(2026, 7, 31),
      createdAt: Date.UTC(2026, 7, 1),
    };
    const completedRound = (
      round: number,
      memberId: string,
      pages: number[],
      completedAt: number,
    ): RoundChunk => ({
      id: `${memberId}-${round}`,
      status: 'completed',
      completedAt,
      round,
      date: '2026-08-01',
      pages,
      loosePages: [...pages],
      redistributedPages: [],
    });
    const aminaAssignment: Assignment = {
      memberId: amina.id,
      rounds: Array.from({ length: 30 }, (_, index) =>
        completedRound(
          index + 1,
          amina.id,
          Array.from({ length: 10 }, (_, page) => page + 1),
          new Date(2026, 7, index + 1, 12).getTime(),
        ),
      ),
      doneByRound: {},
      missedStreak: 0,
    };
    const maryamAssignment: Assignment = {
      memberId: maryam.id,
      rounds: [completedRound(1, maryam.id, [1, 2], new Date(2026, 7, 1, 12).getTime())],
      doneByRound: {},
      missedStreak: 0,
    };
    const saraAssignment: Assignment = {
      memberId: sara.id,
      rounds: Array.from({ length: 15 }, (_, index) =>
        completedRound(
          index + 1,
          sara.id,
          [1, 2, 3, 4, 5],
          new Date(2026, 7, index + 1, 12).getTime(),
        ),
      ),
      doneByRound: {},
      missedStreak: 0,
    };
    const harness = renderWithAppProviders(<AdminExperience />, {
      route: '/roster',
      data: {
        roster: [amina, maryam, sara],
        khatmas: [khatma],
        assignments: {
          [khatma.id]: [aminaAssignment, maryamAssignment, saraAssignment],
        },
      },
      operations: mockRosterOperations(),
    });

    const topGrade = await screen.findByLabelText(
      `${strings.admin.reliabilityScore}: 10 / 10`,
    );
    expect(topGrade).toHaveAttribute('data-grade-tone', 'top');
    expect(topGrade.querySelector('svg')).toBeInTheDocument();
    expect(
      screen.getByLabelText(`${strings.admin.reliabilityScore}: 5 / 10`),
    ).toHaveAttribute('data-grade-tone', 'medium');
    expect(
      screen.getByLabelText(`${strings.admin.reliabilityScore}: 0.8 / 10`),
    ).toHaveAttribute('data-grade-tone', 'bad');
    expect(harness.subscriptions.assignment(khatma.id).counts().active).toBe(1);
  });

  it('filters by name substring as-you-type and keeps the search caret focused (P4)', async () => {
    const { user } = renderRoster([amina, maryam]);

    const search = screen.getByRole('searchbox', {
      name: strings.admin.searchPlaceholder,
    });
    await user.click(search);
    await user.type(search, 'Mar');

    expect(screen.getByText('Maryam')).toBeVisible();
    expect(screen.queryByText('Amina')).toBeNull();
    // The controlled field is never remounted, so focus/caret survive the
    // per-keystroke re-render without the legacy manual re-focus.
    expect(search).toHaveFocus();
  });

  it('shows the empty-roster copy when nobody is enrolled', () => {
    renderRoster([]);
    expect(screen.getByText(strings.admin.emptyRoster)).toBeVisible();
  });

  it('shows the no-match copy when the query matches nobody', async () => {
    const { user } = renderRoster([amina]);
    await user.type(
      screen.getByRole('searchbox', { name: strings.admin.searchPlaceholder }),
      'zzz',
    );
    expect(screen.getByText(strings.admin.noMatches)).toBeVisible();
    expect(screen.queryByText('Amina')).toBeNull();
  });

  it('steps pages/round through updatePerson and floors the decrement at 1', async () => {
    const { user, operations } = renderRoster([amina, maryam]);

    // Amina (2 pages) increments to 3.
    const aminaRow = screen.getByText('Amina').closest('li')!;
    await user.click(
      within(aminaRow).getByRole('button', {
        name: `${strings.common.increase}: ${strings.admin.pagesPerDayLabel}`,
      }),
    );
    expect(operations.updatePerson).toHaveBeenCalledWith('p1', { pagesPerDay: 3 });

    // Maryam (1 page) cannot go below the floor of 1.
    const maryamRow = screen.getByText('Maryam').closest('li')!;
    expect(
      within(maryamRow).getByRole('button', {
        name: `${strings.common.decrease}: ${strings.admin.pagesPerDayLabel}`,
      }),
    ).toBeDisabled();
  });

  it('toggles enablement through updatePerson', async () => {
    const { user, operations } = renderRoster([amina]);

    await user.click(screen.getByRole('button', { name: strings.admin.disable }));
    expect(operations.updatePerson).toHaveBeenCalledWith('p1', { enabled: false });
  });

  it('renames from an icon-triggered modal and blocks an existing normalized name', async () => {
    const { user, operations } = renderRoster([amina, maryam]);

    await user.click(
      screen.getByRole('button', { name: `${strings.admin.rename}: ${amina.name}` }),
    );
    const dialog = screen.getByRole('dialog', { name: strings.admin.renameHeading });
    const nameField = within(dialog).getByLabelText(strings.admin.namePlaceholder);
    expect(nameField).toHaveValue('Amina');

    await user.clear(nameField);
    await user.type(nameField, '  MARYAM  ');
    await user.click(
      within(dialog).getByRole('button', { name: strings.common.confirm }),
    );
    expect(within(dialog).getByText(strings.admin.nameTaken)).toBeVisible();
    expect(operations.renamePerson).not.toHaveBeenCalled();

    await user.clear(nameField);
    await user.type(nameField, '  Sara   Noor  ');
    await user.click(
      within(dialog).getByRole('button', { name: strings.common.confirm }),
    );

    await waitFor(() =>
      expect(operations.renamePerson).toHaveBeenCalledWith('p1', 'Sara Noor'),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('removes a member only after the confirmation is approved', async () => {
    const { user, operations } = renderRoster([amina]);

    await user.click(
      screen.getByRole('button', { name: `${strings.admin.remove}: ${amina.name}` }),
    );
    // Dismissing the confirmation leaves the roster untouched.
    await user.click(screen.getByRole('button', { name: strings.common.cancel }));
    expect(operations.removePerson).not.toHaveBeenCalled();

    // Once the dialog has closed the row's remove control is reachable again.
    await user.click(
      await screen.findByRole('button', {
        name: `${strings.admin.remove}: ${amina.name}`,
      }),
    );
    await user.click(screen.getByRole('button', { name: strings.common.confirm }));
    expect(operations.removePerson).toHaveBeenCalledWith('p1');
  });

  it('validates the add form and only writes a unique, trimmed member', async () => {
    const { user, operations } = renderRoster([amina]);

    const addButton = screen.getByRole('button', { name: strings.admin.addPerson });

    // Blank name is rejected before any write.
    await user.click(addButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      strings.admin.nameRequired,
    );
    expect(operations.addPerson).not.toHaveBeenCalled();

    // A duplicate name is rejected too.
    const nameField = screen.getByLabelText(strings.admin.namePlaceholder);
    await user.type(nameField, 'Amina');
    await user.click(addButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.admin.nameTaken);
    expect(operations.addPerson).not.toHaveBeenCalled();

    // A fresh, whitespace-padded name writes trimmed with its note and pages.
    await user.clear(nameField);
    await user.type(nameField, '  Sara  ');
    await user.type(screen.getByLabelText(strings.admin.notePlaceholder), 'friend');
    await user.type(screen.getByLabelText(strings.settings.avatarLabel), '🌙');
    await user.click(addButton);

    expect(operations.addPerson).toHaveBeenCalledWith({
      name: 'Sara',
      note: 'friend',
      emoji: '🌙',
      pagesPerDay: 2,
    });
    // Name/note reset on success (no lingering validation alert).
    expect(nameField).toHaveValue('');
    expect(screen.getByLabelText(strings.settings.avatarLabel)).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

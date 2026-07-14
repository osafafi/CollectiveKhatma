import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { Person } from '@/domain/types';
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
  updatePerson: ReturnType<typeof vi.fn>;
  removePerson: ReturnType<typeof vi.fn>;
} {
  return {
    ...writeOperations,
    addPerson: vi.fn<WriteOperations['addPerson']>().mockResolvedValue('new-id'),
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
  return { ...harness, operations: operations as ReturnType<typeof mockRosterOperations> };
}

describe('admin Roster (RM-510)', () => {
  it('lists members, badging only the disabled ones', () => {
    renderRoster([amina, maryam]);

    expect(screen.getByRole('heading', { name: strings.admin.rosterHeading })).toBeVisible();

    // Maryam is paused: her row carries the disabled badge; Amina's does not.
    const aminaRow = screen.getByText('Amina').closest('li')!;
    const maryamRow = screen.getByText('Maryam').closest('li')!;
    expect(within(maryamRow).getByText(strings.admin.disabledBadge)).toBeVisible();
    expect(within(aminaRow).queryByText(strings.admin.disabledBadge)).toBeNull();
  });

  it('filters by name substring as-you-type and keeps the search caret focused (P4)', async () => {
    const { user } = renderRoster([amina, maryam]);

    const search = screen.getByRole('searchbox', { name: strings.admin.searchPlaceholder });
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

  it('removes a member only after the confirmation is approved', async () => {
    const { user, operations } = renderRoster([amina]);

    await user.click(screen.getByRole('button', { name: strings.admin.remove }));
    // Dismissing the confirmation leaves the roster untouched.
    await user.click(screen.getByRole('button', { name: strings.common.cancel }));
    expect(operations.removePerson).not.toHaveBeenCalled();

    // Once the dialog has closed the row's remove control is reachable again.
    await user.click(await screen.findByRole('button', { name: strings.admin.remove }));
    await user.click(screen.getByRole('button', { name: strings.common.confirm }));
    expect(operations.removePerson).toHaveBeenCalledWith('p1');
  });

  it('validates the add form and only writes a unique, trimmed member', async () => {
    const { user, operations } = renderRoster([amina]);

    const addButton = screen.getByRole('button', { name: strings.admin.addPerson });

    // Blank name is rejected before any write.
    await user.click(addButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.admin.nameRequired);
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
    await user.click(addButton);

    expect(operations.addPerson).toHaveBeenCalledWith({
      name: 'Sara',
      note: 'friend',
      pagesPerDay: 2,
    });
    // Name/note reset on success (no lingering validation alert).
    expect(nameField).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

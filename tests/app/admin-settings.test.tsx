import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

type SettingsOperations = WriteOperations & { setDu3aText: ReturnType<typeof vi.fn> };

/** Stub the du3a write so tests never reach Firestore. */
function mockSettingsOperations(): SettingsOperations {
  return {
    ...writeOperations,
    setDu3aText: vi.fn<WriteOperations['setDu3aText']>().mockResolvedValue(undefined),
  };
}

function renderSettings(
  data: RenderWithAppProvidersOptions['data'] = { roster: [amina], khatmas: [] },
  options: Omit<RenderWithAppProvidersOptions, 'route' | 'data'> = {},
) {
  const operations =
    (options.operations as SettingsOperations) ?? mockSettingsOperations();
  const harness = renderWithAppProviders(<AdminExperience />, {
    route: '/settings',
    data,
    ...options,
    operations,
  });
  return { ...harness, operations: operations as SettingsOperations };
}

function du3aEditor(): HTMLTextAreaElement {
  return screen.getByRole('textbox', {
    name: strings.admin.du3aEditorHeading,
  }) as HTMLTextAreaElement;
}

describe('admin Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.readingScale;
  });

  it('seeds the du3a editor from live content and saves through setDu3aText', async () => {
    const { user, operations } = renderSettings({
      roster: [amina],
      khatmas: [],
      content: { du3aText: 'دعاء البداية' },
    });

    const editor = du3aEditor();
    expect(editor).toHaveValue('دعاء البداية');
    // The Arabic du3a renders in the shared reading font.
    expect(editor).toHaveClass('quran-text');

    await user.clear(editor);
    await user.type(editor, 'دعاء محدث');
    await user.click(screen.getByRole('button', { name: strings.admin.save }));

    await waitFor(() => expect(operations.setDu3aText).toHaveBeenCalledWith('دعاء محدث'));
    expect(await screen.findByText(strings.admin.saved)).toBeVisible();
    expect(screen.getByText(strings.admin.saved)).toHaveAttribute('role', 'status');
  });

  it('surfaces an error-tone alert when the save fails', async () => {
    const operations = mockSettingsOperations();
    operations.setDu3aText.mockRejectedValue(new Error('offline'));
    const { user } = renderSettings(
      { roster: [amina], khatmas: [], content: { du3aText: 'دعاء' } },
      { operations },
    );

    await user.type(du3aEditor(), '!');
    await user.click(screen.getByRole('button', { name: strings.admin.save }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(strings.admin.saveError);
  });

  it('keeps live content seeding until edited, then freezes the draft (P3)', async () => {
    const { user, subscriptions } = renderSettings({
      roster: [amina],
      khatmas: [],
      content: { du3aText: 'دعاء أول' },
    });

    // Before the admin touches the field, incoming snapshots keep seeding it.
    subscriptions.content.emit({ du3aText: 'دعاء من الخادم' });
    expect(du3aEditor()).toHaveValue('دعاء من الخادم');

    // Once edited, an unrelated content snapshot must NOT overwrite the edit.
    await user.clear(du3aEditor());
    await user.type(du3aEditor(), 'دعاء المشرفة');
    subscriptions.content.emit({ du3aText: 'دعاء من مشرف آخر' });
    expect(du3aEditor()).toHaveValue('دعاء المشرفة');
  });

  it('restores, live-applies, and persists the five-level reading scale', async () => {
    localStorage.setItem('khatma.readingScale', '4');
    const { user } = renderSettings({ roster: [amina], khatmas: [] });
    const disclosure = document.querySelector('details');

    expect(disclosure).not.toBeNull();
    await user.click(within(disclosure!).getByText(strings.settings.title));

    const slider = screen.getByRole('slider', { name: strings.settings.fontSize });
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '4');
    expect(screen.getByText(strings.settings.sample)).toHaveClass('quran-text');

    slider.focus();
    await user.keyboard('{ArrowLeft}');

    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '5');
    expect(localStorage.getItem('khatma.readingScale')).toBe('5');
  });

  it('offers the same appearance toggle as the member app and persists it', async () => {
    const { user } = renderSettings({ roster: [amina], khatmas: [] });

    const group = screen.getByRole('group', { name: strings.settings.appearanceTitle });
    const darkButton = within(group).getByRole('button', {
      name: strings.settings.themeDark,
    });
    expect(darkButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(darkButton);

    expect(darkButton).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('khatma.themeMode')).toBe('dark');
  });

  it('keeps the reading-scale disclosure open across route navigation', async () => {
    const { user } = renderSettings({ roster: [amina], khatmas: [] });

    await user.click(
      within(document.querySelector('details')!).getByText(strings.settings.title),
    );
    expect(document.querySelector('details')).toHaveAttribute('open');

    await user.click(screen.getByRole('link', { name: strings.admin.navHome }));
    expect(
      screen.getByRole('heading', { name: strings.admin.homeHeading }),
    ).toBeVisible();

    await user.click(screen.getByRole('link', { name: strings.admin.navSettings }));
    expect(document.querySelector('details')).toHaveAttribute('open');
  });
});

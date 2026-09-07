import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyDuasEditor } from '@/app/admin/DailyDuasEditor';
import { DailyDuasConflictError, writeOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import { renderWithAppProviders } from '../support/reactTestHarness';

function setup(dailyDu3as?: string[]) {
  const setDailyDu3as = vi.fn<typeof writeOperations.setDailyDu3as>().mockResolvedValue();
  const harness = renderWithAppProviders(<DailyDuasEditor />, {
    data: {
      content: {
        du3aText: 'khatma',
        ...(dailyDu3as === undefined ? {} : { dailyDu3as }),
      },
    },
    operations: { ...writeOperations, setDailyDu3as },
  });
  return {
    ...harness,
    setDailyDu3as,
    open: () => harness.user.click(screen.getByText(strings.dailyDua.settingsTitle)),
  };
}

describe('daily duas Settings', () => {
  it('starts collapsed and displays the saved Firebase list', async () => {
    const saved = ['first prayer', 'second prayer'];
    const h = setup(saved);
    expect(document.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.queryByText(saved[0]!)).not.toBeInTheDocument();
    await h.open();
    expect(await screen.findByText(saved[0]!)).toBeVisible();
    expect(screen.getAllByRole('button', { name: strings.dailyDua.edit })).toHaveLength(
      saved.length,
    );
    await h.user.click(screen.getByRole('button', { name: strings.dailyDua.save }));
    expect(h.setDailyDu3as).toHaveBeenCalledWith(saved, saved);
  });
  it('has no bundled fallback when Firebase has no daily list', async () => {
    const h = setup();
    await h.open();
    expect(await screen.findByText(strings.dailyDua.empty)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: strings.dailyDua.edit }),
    ).not.toBeInTheDocument();
    await h.user.click(screen.getByRole('button', { name: strings.dailyDua.add }));
    await h.user.type(
      screen.getByRole('textbox', { name: strings.dailyDua.text }),
      'new prayer',
    );
    await h.user.click(screen.getByRole('button', { name: strings.dailyDua.save }));
    expect(h.setDailyDu3as).toHaveBeenCalledWith(['new prayer'], null);
  });
  it('adds, edits, confirms deletion, and preserves drafts through snapshots and failures', async () => {
    const h = setup(['first', 'second']);
    await h.open();
    await h.user.click(
      screen.getAllByRole('button', { name: strings.dailyDua.edit })[0]!,
    );
    const field = screen.getByRole('textbox', { name: strings.dailyDua.text });
    await h.user.clear(field);
    await h.user.type(field, 'edited');
    h.subscriptions.content.emit({ du3aText: 'new khatma', dailyDu3as: ['remote'] });
    expect(field).toHaveValue('edited');
    await h.user.click(
      screen.getAllByRole('button', { name: strings.dailyDua.remove })[1]!,
    );
    await h.user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: strings.common.confirm,
      }),
    );
    await h.user.click(await screen.findByRole('button', { name: strings.dailyDua.add }));
    expect(screen.getByRole('button', { name: strings.dailyDua.save })).toBeDisabled();
    await h.user.type(
      screen.getByRole('textbox', { name: strings.dailyDua.text }),
      'added',
    );
    h.setDailyDu3as.mockRejectedValue(new DailyDuasConflictError());
    await h.user.click(
      await screen.findByRole('button', { name: strings.dailyDua.save }),
    );
    await waitFor(() =>
      expect(h.setDailyDu3as).toHaveBeenCalledWith(
        ['edited', 'added'],
        ['first', 'second'],
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.dailyDua.conflict);
    expect(screen.getByRole('textbox', { name: strings.dailyDua.text })).toHaveValue(
      'added',
    );
    await h.user.click(screen.getByRole('button', { name: strings.dailyDua.reload }));
    await h.user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: strings.common.confirm,
      }),
    );
    expect(screen.getByText('remote')).toBeVisible();
  });
  it('persists an empty list to disable the daily popup', async () => {
    const h = setup(['last']);
    await h.open();
    await h.user.click(screen.getByRole('button', { name: strings.dailyDua.remove }));
    await h.user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: strings.common.confirm,
      }),
    );
    expect(screen.getByText(strings.dailyDua.empty)).toBeVisible();
    await h.user.click(
      await screen.findByRole('button', { name: strings.dailyDua.save }),
    );
    expect(h.setDailyDu3as).toHaveBeenCalledWith([], ['last']);
  });
});

import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { ReleasedChunkError, resetFinishQueue, writeOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import { renderWithAppProviders } from '../support/reactTestHarness';
import type { Assignment, Khatma, Person } from '@/domain/types';

const member: Person = {
  id: 'p1',
  name: 'Amina',
  enabled: true,
  pagesPerDay: 2,
  completedPages: [],
  createdAt: 1,
};
const khatma: Khatma = {
  id: 'k1',
  seriesId: 's1',
  seriesName: 'Test',
  seriesNumber: 1,
  totalPages: 604,
  scope: { kind: 'full' },
  memberIds: ['p1'],
  capacities: { p1: { pages: 2, surahs: 0, juz: 0 } },
  status: 'active',
  remainingPages: [3],
  roundCount: 1,
  duaReciterId: 'p1',
  createdAt: 1,
};
const assignment: Assignment = {
  memberId: 'p1',
  rounds: [
    {
      round: 1,
      date: '2026-09-07',
      pages: [1, 2],
      loosePages: [1, 2],
      redistributedPages: [],
    },
  ],
  doneByRound: {},
  missedStreak: 0,
};

function setup(
  markRoundDone = vi.fn<typeof writeOperations.markRoundDone>().mockResolvedValue(),
  dailyDu3as = ['first daily', 'second daily'],
) {
  localStorage.setItem('khatma.memberId', member.id);
  return renderWithAppProviders(
    <MemberIdentityBoundary>
      <MemberExperience />
    </MemberIdentityBoundary>,
    {
      route: '/khatma/k1',
      data: {
        roster: [member],
        khatmas: [khatma],
        assignments: { k1: [assignment] },
        content: { du3aText: 'separate khatma prayer', dailyDu3as },
      },
      operations: { ...writeOperations, markRoundDone },
    },
  );
}

describe('daily prayer after finishing', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFinishQueue();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    resetFinishQueue();
  });

  it('waits for accepted completion, freezes the date-selected text, and fades closed with one Done button', async () => {
    let resolve!: () => void;
    const mark = vi.fn<typeof writeOperations.markRoundDone>(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const h = setup(mark);
    await h.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => resolve());
    const dialog = await screen.findByRole('dialog', { name: strings.dailyDua.title });
    expect(dialog).toHaveTextContent('first daily');
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    h.subscriptions.content.emit({ du3aText: 'khatma', dailyDu3as: ['changed'] });
    expect(dialog).toHaveTextContent('first daily');
    await h.user.click(within(dialog).getByRole('button', { name: strings.common.done }));
    // The node remains for the exit transition, then leaves the DOM.
    expect(document.getElementById('daily-dua-text')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    h.subscriptions.assignment('k1').emit([{ ...assignment, doneByRound: { 1: 123 } }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('survives the final completion interrupt unmounting its finish button', async () => {
    let resolve!: () => void;
    const h = setup(
      vi.fn(
        () =>
          new Promise<void>((r) => {
            resolve = r;
          }),
      ),
    );
    await h.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    h.subscriptions.khatmas.emit([{ ...khatma, remainingPages: [] }]);
    h.subscriptions.assignment('k1').emit([{ ...assignment, doneByRound: { 1: 123 } }]);
    expect(screen.getByText('separate khatma prayer')).toBeInTheDocument();
    await act(async () => resolve());
    expect(
      await screen.findByRole('dialog', { name: strings.dailyDua.title }),
    ).toHaveTextContent('first daily');
  });
  it('shows for an offline queued tap and does not reopen on replay', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const mark = vi.fn<typeof writeOperations.markRoundDone>().mockResolvedValue();
    const h = setup(mark);
    await h.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    expect(await screen.findByRole('dialog')).toHaveTextContent('first daily');
    expect(mark).not.toHaveBeenCalled();
    await h.user.click(screen.getByRole('button', { name: strings.common.done }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mark).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('does not show on rejected or released completions', async () => {
    const mark = vi
      .fn<typeof writeOperations.markRoundDone>()
      .mockRejectedValue(new ReleasedChunkError());
    const h = setup(mark);
    await h.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('honors an admin-empty list', async () => {
    const h = setup(
      vi.fn<typeof writeOperations.markRoundDone>().mockResolvedValue(),
      [],
    );
    await h.user.click(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    );
    await screen.findByText((text) => text.includes(strings.member.doneToday));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

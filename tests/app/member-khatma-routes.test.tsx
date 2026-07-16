import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience as MemberRoutesExperience } from '@/app/member/MemberApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { ReleasedChunkError } from '@/data/assignments';
import { seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

const amina: Person = {
  id: 'person-1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

const maryam: Person = { ...amina, id: 'person-2', name: 'Maryam' };

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

function TestMemberExperience() {
  return (
    <MemberIdentityBoundary>
      <MemberRoutesExperience />
    </MemberIdentityBoundary>
  );
}

function renderMember(options: RenderWithAppProvidersOptions = {}) {
  localStorage.setItem('khatma.memberId', amina.id);
  return renderWithAppProviders(<TestMemberExperience />, options);
}

describe('member khatma routes (RM-410)', () => {
  beforeEach(() => localStorage.clear());

  it('renders one relevant card per active series and targets the pending khatma', async () => {
    const first = makeKhatma('first', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
      totalPages: 4,
      remainingPages: [],
      createdAt: 1,
    });
    const latest = makeKhatma('latest', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 2,
      createdAt: 2,
    });
    const done = makeKhatma('done', {
      seriesId: 'solo',
      seriesName: 'الختمة الفردية',
      totalPages: 1,
      remainingPages: [],
      createdAt: 3,
    });
    const irrelevant = makeKhatma('irrelevant', {
      memberIds: [maryam.id],
      createdAt: 4,
    });
    const completed = makeKhatma('completed', {
      seriesId: 'shared',
      status: 'completed',
      createdAt: 0,
    });
    localStorage.setItem(`khatma.du3aAck.${done.id}`, '1');
    const harness = renderMember({
      data: {
        roster: [amina, maryam],
        khatmas: [first, latest, done, irrelevant, completed],
        assignments: {
          [first.id]: [
            makeAssignment(amina.id, [round(1, [1, 2])]),
            makeAssignment(maryam.id, [round(1, [3, 4])], { 1: 10 }),
          ],
          [latest.id]: [makeAssignment(amina.id)],
          [done.id]: [makeAssignment(amina.id, [round(1, [1])], { 1: 10 })],
        },
      },
    });

    expect(
      screen.getByRole('heading', { name: strings.member.khatmasHeading }),
    ).toBeVisible();
    const firstTitle = seriesTitle(first, toArabicDigits);
    const firstLink = await screen.findByRole('link', {
      name: `${strings.member.openKhatma}: ${firstTitle}`,
    });
    expect(firstLink).toHaveAttribute('href', '#/khatma/first');
    expect(within(firstLink).getByText('٥٠٪')).toBeVisible();
    expect(within(firstLink).getByText(/٢ صفحات/)).toBeVisible();

    const doneTitle = seriesTitle(done, toArabicDigits);
    expect(
      screen.getByRole('link', {
        name: `${strings.member.openKhatma}: ${doneTitle}`,
      }),
    ).toHaveTextContent(strings.member.doneToday);
    expect(screen.queryByText(seriesTitle(irrelevant, toArabicDigits))).toBeNull();
    expect(screen.getAllByRole('link', { name: /فتح الختمة/ })).toHaveLength(2);

    expect(harness.subscriptions.assignment(first.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(latest.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(done.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(irrelevant.id).counts().active).toBe(0);

    await harness.user.click(firstLink);
    expect(
      screen.getByRole('heading', { name: seriesTitle(first, toArabicDigits) }),
    ).toBeVisible();
  });

  it('updates card targeting in realtime and reconciles assignment listeners', async () => {
    const first = makeKhatma('first', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
      createdAt: 1,
    });
    const latest = makeKhatma('latest', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 2,
      createdAt: 2,
    });
    const harness = renderMember({
      data: {
        roster: [amina],
        khatmas: [first, latest],
        assignments: {
          [first.id]: [makeAssignment(amina.id)],
          [latest.id]: [makeAssignment(amina.id)],
        },
      },
    });

    expect(
      await screen.findByRole('link', {
        name: `${strings.member.openKhatma}: ${seriesTitle(latest, toArabicDigits)}`,
      }),
    ).toHaveAttribute('href', '#/khatma/latest');

    harness.subscriptions
      .assignment(first.id)
      .emit([makeAssignment(amina.id, [round(1, [1, 2])])]);
    expect(
      screen.getByRole('link', {
        name: `${strings.member.openKhatma}: ${seriesTitle(first, toArabicDigits)}`,
      }),
    ).toHaveAttribute('href', '#/khatma/first');

    harness.subscriptions.khatmas.emit([latest]);
    expect(harness.subscriptions.assignment(first.id).counts()).toEqual({
      starts: 1,
      stops: 1,
      active: 0,
    });
    expect(harness.subscriptions.assignment(latest.id).counts().active).toBe(1);

    harness.unmount();
    expect(harness.subscriptions.assignment(latest.id).counts()).toEqual({
      starts: 1,
      stops: 1,
      active: 0,
    });
  });

  it('preserves the transient list-empty state and surfaces listener failures', () => {
    const harness = renderMember({ data: { roster: [amina] } });

    expect(screen.getByText(strings.member.noKhatmas)).toBeVisible();
    expect(screen.queryByText(strings.common.loading)).not.toBeInTheDocument();

    harness.subscriptions.khatmas.fail(new Error('offline'));
    expect(screen.getByRole('alert')).toHaveTextContent(strings.member.connectionError);
  });

  it('renders warnings, assignment actions, group progress, history, and live awaiting state', async () => {
    const active = makeKhatma('active', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 2,
      memberIds: [amina.id, maryam.id],
      remainingPages: [],
      roundCount: 2,
    });
    const completed = makeKhatma('completed', {
      seriesId: 'shared',
      seriesName: 'أهل القرآن',
      seriesNumber: 1,
      memberIds: [amina.id, maryam.id],
      status: 'completed',
      completedAt: Date.UTC(2026, 5, 30),
      createdAt: Date.UTC(2026, 5, 1),
    });
    const mine = makeAssignment(
      amina.id,
      [round(1, [1, 2]), round(2, [3, 4])],
      { 1: 10 },
      2,
    );
    const other = makeAssignment(maryam.id, [round(2, [5, 6])], { 2: 20 }, 9);
    localStorage.setItem(`khatma.du3aAck.${active.id}`, '1');
    const harness = renderMember({
      route: `/khatma/${active.id}`,
      data: {
        roster: [amina, maryam],
        khatmas: [active, completed],
        assignments: { [active.id]: [mine, other] },
      },
    });

    expect(
      await screen.findByRole('heading', {
        name: seriesTitle(active, toArabicDigits),
      }),
    ).toBeVisible();
    expect(screen.getByText(`${strings.member.startedWord} 2026-07-01`)).toBeVisible();
    expect(screen.getByText(`${strings.member.roundWord} ٢`)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(strings.member.warningNote);
    expect(screen.getByText('٢ صفحات')).toBeVisible();
    expect(screen.getByText('٣')).toBeVisible();
    expect(screen.getByText('٤')).toBeVisible();
    expect(
      screen.getByRole('link', { name: strings.reader.readMyPages }),
    ).toHaveAttribute('href', '#/khatma/active/read');
    expect(
      screen.getByRole('button', { name: strings.member.finishedToday }),
    ).toBeEnabled();
    expect(screen.getByText(/١ من ٢/)).toBeVisible();
    expect(screen.getByText('⏳ Amina')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: strings.member.historyHeading }),
    ).toBeVisible();
    expect(screen.getByText(/أهل القرآن ١ · اكتملت في 2026-06-30/)).toBeVisible();

    harness.subscriptions.assignment(active.id).emit([makeAssignment(amina.id), other]);
    expect(screen.getByText(strings.member.awaitingDistribution)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: strings.member.finishedToday }),
    ).not.toBeInTheDocument();

    await harness.user.click(
      screen.getByRole('link', { name: strings.member.khatmasHeading }),
    );
    expect(
      await screen.findByRole('heading', { name: strings.member.khatmasHeading }),
    ).toBeVisible();
  });

  it('shows the paused state without member reading actions', async () => {
    const paused = { ...amina, enabled: false };
    const active = makeKhatma('active');
    renderMember({
      route: `/khatma/${active.id}`,
      data: {
        roster: [paused],
        khatmas: [active],
        assignments: {
          [active.id]: [makeAssignment(amina.id, [round(1, [1, 2])])],
        },
      },
    });

    expect(await screen.findByText(strings.member.pausedNote)).toBeVisible();
    expect(screen.queryByRole('link', { name: strings.reader.readMyPages })).toBeNull();
    expect(
      screen.queryByRole('button', { name: strings.member.finishedToday }),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { name: strings.member.groupProgress }),
    ).toBeVisible();
  });

  it('handles loading, not-found, and assignment subscription errors', () => {
    const loading = renderMember({
      route: '/khatma/missing',
      data: { roster: [amina] },
    });
    expect(screen.getByText(strings.common.loading)).toBeVisible();

    loading.subscriptions.khatmas.emit([makeKhatma('other', { memberIds: [maryam.id] })]);
    expect(screen.getByText(strings.member.noKhatmas)).toBeVisible();
    loading.unmount();

    const active = makeKhatma('active');
    const failed = renderMember({
      route: `/khatma/${active.id}`,
      data: { roster: [amina], khatmas: [active] },
    });
    failed.subscriptions.assignment(active.id).fail(new Error('offline'));
    expect(screen.getByRole('alert')).toHaveTextContent(strings.member.connectionError);
  });

  it('disables completion while pending and shows success immediately', async () => {
    const active = makeKhatma('active');
    const pending = deferred<void>();
    const markRoundDone = vi.fn<WriteOperations['markRoundDone']>(() => pending.promise);
    const harness = renderMember({
      route: `/khatma/${active.id}`,
      data: {
        roster: [amina],
        khatmas: [active],
        assignments: {
          [active.id]: [makeAssignment(amina.id, [round(1, [1, 2])])],
        },
      },
      operations: { ...writeOperations, markRoundDone },
    });
    const finish = await screen.findByRole('button', {
      name: strings.member.finishedToday,
    });

    await harness.user.click(finish);
    expect(finish).toBeDisabled();
    expect(markRoundDone).toHaveBeenCalledWith(active.id, amina.id, 1);

    await act(async () => pending.resolve());
    expect(
      screen.getByText((content) => content.includes(strings.member.doneToday)),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: strings.member.finishedToday }),
    ).toBeNull();
  });

  it('distinguishes released chunks from generic completion failures', async () => {
    const active = makeKhatma('active');
    const markRoundDone = vi
      .fn<WriteOperations['markRoundDone']>()
      .mockRejectedValueOnce(new ReleasedChunkError())
      .mockRejectedValueOnce(new Error('offline'));
    const harness = renderMember({
      route: `/khatma/${active.id}`,
      data: {
        roster: [amina],
        khatmas: [active],
        assignments: {
          [active.id]: [makeAssignment(amina.id, [round(1, [1, 2])])],
        },
      },
      operations: { ...writeOperations, markRoundDone },
    });
    const finish = await screen.findByRole('button', {
      name: strings.member.finishedToday,
    });

    await harness.user.click(finish);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      strings.member.releasedNote,
    );
    expect(finish).toBeEnabled();

    await harness.user.click(finish);
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.member.saveError);
    expect(markRoundDone).toHaveBeenCalledTimes(2);
  });
});

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

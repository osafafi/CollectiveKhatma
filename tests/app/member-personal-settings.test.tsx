import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { formatPercent } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
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

function makeKhatma(id: string, overrides: Partial<Khatma> = {}): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: `ختمة ${id}`,
    seriesNumber: 1,
    totalPages: 6,
    scope: { kind: 'range', fromPage: 1, toPage: 6 },
    memberIds: [amina.id],
    capacities: { [amina.id]: { pages: 2, surahs: 0, juz: 0 } },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [3, 4, 5, 6],
    roundCount: 1,
    createdAt: 1,
    ...overrides,
  };
}

function assignment(
  rounds: RoundChunk[],
  doneByRound: Record<number, number> = {},
): Assignment {
  return { memberId: amina.id, rounds, doneByRound, missedStreak: 0 };
}

function round(roundNumber: number, pages: number[]): RoundChunk {
  return {
    round: roundNumber,
    date: '2026-07-22',
    pages,
    loosePages: [...pages],
    redistributedPages: [],
  };
}

function TestMemberExperience() {
  return (
    <MemberIdentityBoundary>
      <MemberExperience />
    </MemberIdentityBoundary>
  );
}

function renderMember(options: RenderWithAppProvidersOptions = {}) {
  localStorage.setItem('khatma.memberId', amina.id);
  return renderWithAppProviders(<TestMemberExperience />, options);
}

function topReaderInsight(percent: number): string {
  return `${strings.personal.topReadersLead} ${formatPercent(percent)} ${strings.personal.topReadersTail}`;
}

describe('member personal and settings routes', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.readingScale;
  });

  it('renders the empty personal insight and follows live member updates', () => {
    const harness = renderMember({
      route: '/personal',
      data: { roster: [amina] },
    });

    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();
    const completion = screen.getByRole('region', {
      name: strings.personal.quranCompletionHeading,
    });
    expect(
      within(completion).getByText(toArabicDigits(0), {
        selector: 'span.MuiTypography-root',
      }),
    ).toBeVisible();
    expect(within(completion).getByRole('img', { name: formatPercent(0) })).toBeVisible();
    expect(within(completion).getByText(topReaderInsight(100))).toBeVisible();

    const completedPages = Array.from({ length: 151 }, (_, index) => index + 1);
    harness.subscriptions.roster.emit([
      { ...amina, name: 'Amina updated', completedPages },
      {
        ...amina,
        id: 'leader',
        name: 'Leader',
        completedPages: [...completedPages, 152],
      },
      { ...amina, id: 'tied', name: 'Tied', completedPages },
      { ...amina, id: 'behind', name: 'Behind', completedPages: [] },
    ]);

    expect(screen.getByText('Amina updated')).toBeVisible();
    expect(
      within(completion).getByText(toArabicDigits(151), {
        selector: 'span.MuiTypography-root',
      }),
    ).toBeVisible();
    expect(
      within(completion).getByRole('img', { name: formatPercent(25) }),
    ).toBeVisible();
    expect(within(completion).getByText(topReaderInsight(50))).toBeVisible();
  });

  it('derives history metadata and subscribes to completed khatmas only on the personal route', async () => {
    const active = makeKhatma('active');
    const firstCompleted = makeKhatma('completed-first', {
      status: 'completed',
      remainingPages: [],
    });
    const secondCompleted = makeKhatma('completed-second', {
      status: 'completed',
      remainingPages: [],
    });
    const now = new Date();
    const thisMonth = (day: number): number =>
      new Date(now.getFullYear(), now.getMonth(), day, 12).getTime();
    const harness = renderMember({
      route: '/personal',
      data: {
        roster: [amina],
        khatmas: [active, firstCompleted, secondCompleted],
        assignments: {
          [active.id]: [assignment([round(1, [1, 2])], { 1: thisMonth(5) })],
          [firstCompleted.id]: [assignment([round(1, [3, 4, 5])], { 1: thisMonth(6) })],
          [secondCompleted.id]: [assignment([round(1, [6])], { 1: thisMonth(8) })],
        },
      },
    });
    const completion = screen.getByRole('region', {
      name: strings.personal.quranCompletionHeading,
    });

    expect(
      within(
        within(completion).getByRole('region', {
          name: strings.personal.completedKhatmas,
        }),
      ).getByText(toArabicDigits(2)),
    ).toBeVisible();
    expect(
      within(
        within(completion).getByRole('region', {
          name: strings.personal.pagesThisMonth,
        }),
      ).getByText(toArabicDigits(6)),
    ).toBeVisible();
    expect(
      within(
        within(completion).getByRole('region', {
          name: strings.personal.longestDailyStreak,
        }),
      ).getByText(toArabicDigits(2)),
    ).toBeVisible();
    expect(harness.subscriptions.assignment(firstCompleted.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(secondCompleted.id).counts().active).toBe(1);

    await harness.user.click(screen.getByRole('link', { name: strings.nav.settings }));
    expect(
      await screen.findByRole('heading', { name: strings.nav.settings }),
    ).toBeVisible();
    expect(harness.subscriptions.assignment(active.id).counts().active).toBe(1);
    expect(harness.subscriptions.assignment(firstCompleted.id).counts().active).toBe(0);
    expect(harness.subscriptions.assignment(secondCompleted.id).counts().active).toBe(0);
  });

  it('lists every pending khatma assignment and opens its reader directly', () => {
    const first = makeKhatma('first', {
      seriesName: 'أهل القرآن',
      imageName: 'green-arch.svg',
      createdAt: 1,
    });
    const second = makeKhatma('second', {
      seriesName: 'رفقة النور',
      seriesNumber: 2,
      createdAt: 2,
    });
    const alreadyDone = makeKhatma('done');
    const completed = makeKhatma('completed', { status: 'completed' });
    const firstAssignment = assignment([round(1, [1, 2])]);
    const harness = renderMember({
      route: '/personal',
      data: {
        roster: [amina],
        khatmas: [first, second, alreadyDone, completed],
        assignments: {
          [first.id]: [firstAssignment],
          [second.id]: [assignment([round(1, [5, 6])])],
          [alreadyDone.id]: [assignment([round(1, [3, 4])], { 1: 10 })],
          [completed.id]: [assignment([round(1, [1, 2])])],
        },
      },
    });

    expect(
      screen.getByRole('heading', {
        name: strings.personal.pendingAssignmentsHeading,
      }),
    ).toBeVisible();

    const firstTitle = `أهل القرآن ${toArabicDigits(1)}`;
    const firstLink = screen.getByRole('link', {
      name: `${strings.reader.readMyPages}: ${firstTitle}`,
    });
    expect(firstLink).toHaveAttribute('href', '#/khatma/first/read');
    expect(within(firstLink).getByRole('img')).toHaveAttribute(
      'src',
      '/khatma-images/green-arch.svg',
    );
    expect(
      within(firstLink).getByText(`${toArabicDigits(2)} ${strings.member.pagesWord}`),
    ).toBeVisible();
    expect(
      within(firstLink).getByText(
        `${strings.personal.assignedPages}: ${toArabicDigits(1)}، ${toArabicDigits(2)}`,
      ),
    ).toBeVisible();

    const secondTitle = `رفقة النور ${toArabicDigits(2)}`;
    expect(
      screen.getByRole('link', {
        name: `${strings.reader.readMyPages}: ${secondTitle}`,
      }),
    ).toHaveAttribute('href', '#/khatma/second/read');
    expect(screen.queryByText(`ختمة done ${toArabicDigits(1)}`)).toBeNull();
    expect(screen.queryByText(`ختمة completed ${toArabicDigits(1)}`)).toBeNull();

    harness.subscriptions
      .assignment(first.id)
      .emit([{ ...firstAssignment, doneByRound: { 1: 20 } }]);
    expect(
      screen.queryByRole('link', {
        name: `${strings.reader.readMyPages}: ${firstTitle}`,
      }),
    ).toBeNull();
  });

  it('restores, live-applies, and persists the five-level reading scale', async () => {
    localStorage.setItem('khatma.readingScale', '4');
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
    });
    await screen.findByRole('heading', { name: strings.nav.settings });
    const disclosure = document.querySelector('details');

    expect(disclosure).not.toBeNull();
    await harness.user.click(disclosure!.querySelector('summary')!);

    const slider = screen.getByRole('slider', { name: strings.settings.fontSize });
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '4');
    expect(screen.getByText(strings.settings.sample)).toHaveClass('quran-text');

    slider.focus();
    await harness.user.keyboard('{ArrowLeft}');

    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(document.documentElement).toHaveAttribute('data-reading-scale', '5');
    expect(localStorage.getItem('khatma.readingScale')).toBe('5');
  });

  it('offers the appearance toggle in Settings and persists the dark choice', async () => {
    const harness = renderMember({ route: '/settings', data: { roster: [amina] } });
    await screen.findByRole('heading', { name: strings.nav.settings });

    const group = screen.getByRole('group', { name: strings.settings.appearanceTitle });
    const lightButton = within(group).getByRole('button', {
      name: strings.settings.themeLight,
    });
    const darkButton = within(group).getByRole('button', {
      name: strings.settings.themeDark,
    });
    expect(lightButton).toHaveAttribute('aria-pressed', 'true');
    expect(darkButton).toHaveAttribute('aria-pressed', 'false');

    await harness.user.click(darkButton);

    expect(darkButton).toHaveAttribute('aria-pressed', 'true');
    expect(lightButton).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('khatma.themeMode')).toBe('dark');
  });

  it('lets the selected member save an optional emoji avatar', async () => {
    const updatePerson = vi
      .fn<WriteOperations['updatePerson']>()
      .mockResolvedValue(undefined);
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
      operations: { ...writeOperations, updatePerson },
    });

    expect(
      await screen.findByLabelText(strings.settings.avatarPreview),
    ).toHaveTextContent('A');
    const field = screen.getByLabelText(strings.settings.avatarLabel);
    await harness.user.type(field, '🌙');
    expect(screen.getByLabelText(strings.settings.avatarPreview)).toHaveTextContent('🌙');
    await harness.user.click(
      screen.getByRole('button', { name: strings.settings.saveAvatar }),
    );

    expect(updatePerson).toHaveBeenCalledWith('person-1', { emoji: '🌙' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      strings.settings.avatarSaved,
    );
  });

  it('validates and submits append-only feedback with member identity metadata', async () => {
    const submitFeedback = vi
      .fn<WriteOperations['submitFeedback']>()
      .mockResolvedValue('feedback-1');
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
      operations: { ...writeOperations, submitFeedback },
    });

    const disclosure = (await screen.findByText(strings.settings.feedbackTitle)).closest(
      'details',
    );
    expect(disclosure).not.toBeNull();
    await harness.user.click(
      within(disclosure!).getByText(strings.settings.feedbackTitle),
    );

    const field = screen.getByLabelText(strings.settings.feedbackLabel);
    const send = screen.getByRole('button', { name: strings.settings.sendFeedback });
    expect(field).toHaveAttribute('maxlength', '500');
    expect(send).toBeDisabled();

    await harness.user.type(field, '123456789');
    expect(send).toBeDisabled();
    await harness.user.type(field, '0');
    expect(send).toBeEnabled();
    await harness.user.click(send);

    expect(submitFeedback).toHaveBeenCalledWith(amina.id, amina.name, '1234567890');
    expect(await screen.findByRole('status')).toHaveTextContent(
      strings.settings.feedbackSent,
    );
    expect(field).toHaveValue('');
  });

  it('navigates between both routes and preserves the settings disclosure state', async () => {
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
    });
    await screen.findByRole('heading', { name: strings.nav.settings });
    const disclosure = document.querySelector('details');

    expect(disclosure).not.toBeNull();
    await harness.user.click(disclosure!.querySelector('summary')!);
    expect(disclosure).toHaveAttribute('open');

    await harness.user.click(screen.getByRole('link', { name: strings.nav.personal }));
    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();

    await harness.user.click(screen.getByRole('link', { name: strings.nav.settings }));
    expect(
      await screen.findByRole('heading', { name: strings.nav.settings }),
    ).toBeVisible();
    expect(document.querySelector('details')).toHaveAttribute('open');
  });
});

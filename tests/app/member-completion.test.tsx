import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { DEFAULT_DU3A_TEXT, strings } from '@/content/strings.ar';
import type { Assignment, Khatma, Person } from '@/domain/types';
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

const completedAssignment: Assignment = {
  memberId: amina.id,
  rounds: [
    {
      round: 1,
      date: '2026-07-14',
      pages: [1, 2],
      loosePages: [1, 2],
      redistributedPages: [],
    },
  ],
  doneByRound: { 1: Date.UTC(2026, 6, 14) },
  missedStreak: 0,
};

function completedKhatma(overrides: Partial<Khatma> = {}): Khatma {
  return {
    id: 'khatma-1',
    seriesId: 'series-1',
    seriesName: 'Series',
    seriesNumber: 1,
    totalPages: 2,
    scope: { kind: 'range', fromPage: 1, toPage: 2 },
    memberIds: [amina.id, maryam.id],
    capacities: {
      [amina.id]: { pages: 2, surahs: 0, juz: 0 },
      [maryam.id]: { pages: 2, surahs: 0, juz: 0 },
    },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [],
    roundCount: 1,
    createdAt: 2,
    ...overrides,
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

describe('member completion/du3a interrupt', () => {
  beforeEach(() => localStorage.clear());

  it('interrupts any route with live du3a content and restores it after acknowledgement', async () => {
    const khatma = completedKhatma({ duaReciterId: amina.id });
    const harness = renderMember({
      route: '/settings',
      data: {
        roster: [amina, maryam],
        content: { du3aText: 'دعاء منشور للاختبار' },
        khatmas: [khatma],
        assignments: { [khatma.id]: [completedAssignment] },
      },
    });

    expect(
      screen.getByRole('heading', { name: strings.member.khatmaComplete }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: strings.member.du3aHeading }),
    ).toBeVisible();
    expect(screen.getByText('دعاء منشور للاختبار')).toHaveClass('quran-text');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: strings.nav.settings }),
    ).not.toBeInTheDocument();
    expect(harness.subscriptions.assignment(khatma.id).counts().active).toBe(1);

    harness.subscriptions.content.emit({ du3aText: 'دعاء محدّث' });
    expect(screen.getByText('دعاء محدّث')).toHaveClass('quran-text');

    await harness.user.click(screen.getByRole('button', { name: strings.common.done }));

    expect(localStorage.getItem(`khatma.du3aAck.${khatma.id}`)).toBe('1');
    expect(window.location.hash).toBe('#/settings');
    expect(screen.getByRole('heading', { name: strings.nav.settings })).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
  });

  it('uses the default du3a when no reciter or live content is set', () => {
    const khatma = completedKhatma();
    renderMember({
      route: '/personal',
      data: {
        roster: [amina],
        khatmas: [khatma],
        assignments: { [khatma.id]: [completedAssignment] },
      },
    });

    expect(screen.getByText(DEFAULT_DU3A_TEXT)).toHaveClass('quran-text');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('names the designated reciter without showing the du3a to another member', () => {
    const khatma = completedKhatma({ duaReciterId: maryam.id });
    renderMember({
      route: '/khatmas',
      data: {
        roster: [amina, maryam],
        content: { du3aText: 'لا ينبغي عرض هذا النص' },
        khatmas: [khatma],
        assignments: { [khatma.id]: [completedAssignment] },
      },
    });

    expect(screen.getByText(maryam.name)).toBeVisible();
    expect(screen.getByText(strings.member.reciterLead, { exact: false })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: strings.member.du3aHeading }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('لا ينبغي عرض هذا النص')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('presents multiple unacknowledged completions one at a time', async () => {
    const first = completedKhatma({ id: 'khatma-first', duaReciterId: amina.id });
    const second = completedKhatma({ id: 'khatma-second', duaReciterId: maryam.id });
    const harness = renderMember({
      route: '/khatmas',
      data: {
        roster: [amina, maryam],
        content: { du3aText: 'دعاء الختمة الأولى' },
        khatmas: [first, second],
        assignments: {
          [first.id]: [completedAssignment],
          [second.id]: [completedAssignment],
        },
      },
    });

    expect(screen.getByText('دعاء الختمة الأولى')).toBeVisible();
    await harness.user.click(screen.getByRole('button', { name: strings.common.done }));

    expect(localStorage.getItem(`khatma.du3aAck.${first.id}`)).toBe('1');
    expect(screen.getByText(maryam.name)).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await harness.user.click(screen.getByRole('button', { name: strings.common.done }));

    expect(localStorage.getItem(`khatma.du3aAck.${second.id}`)).toBe('1');
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
  });

  it('only interrupts for an active completed khatma belonging to this member', () => {
    const acknowledged = completedKhatma({ id: 'acked' });
    const inactive = completedKhatma({ id: 'inactive', status: 'completed' });
    const outsider = completedKhatma({ id: 'outsider', memberIds: [maryam.id] });
    const incomplete = completedKhatma({ id: 'incomplete', remainingPages: [2] });
    localStorage.setItem(`khatma.du3aAck.${acknowledged.id}`, '1');

    renderMember({
      route: '/personal',
      data: {
        roster: [amina, maryam],
        khatmas: [acknowledged, inactive, outsider, incomplete],
        assignments: {
          [acknowledged.id]: [completedAssignment],
          [incomplete.id]: [completedAssignment],
        },
      },
    });

    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: strings.member.khatmaComplete }),
    ).not.toBeInTheDocument();
  });
});

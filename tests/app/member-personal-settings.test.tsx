import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { formatPercent } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { lifetimePercent } from '@/domain/progress';
import type { Person } from '@/domain/types';
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

function lifetimeInsight(completedPageCount: number): string {
  const percent = lifetimePercent(completedPageCount);
  return `${strings.member.lifetimeLead} ${toArabicDigits(completedPageCount)} ${strings.member.lifetimeTail} (${formatPercent(percent)})`;
}

describe('member personal and settings routes', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.readingScale;
  });

  it('renders the empty personal insight and follows live member updates', () => {
    const harness = renderMember({ route: '/personal' });

    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();
    expect(screen.getByText(lifetimeInsight(0))).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: strings.member.lifetimeLead }),
    ).toHaveAttribute('aria-valuenow', '0');

    const completedPages = Array.from({ length: 151 }, (_, index) => index + 1);
    harness.subscriptions.roster.emit([
      { ...amina, name: 'Amina updated', completedPages },
    ]);

    expect(screen.getByText('Amina updated')).toBeVisible();
    expect(screen.getByText(lifetimeInsight(151))).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: strings.member.lifetimeLead }),
    ).toHaveAttribute('aria-valuenow', '25');
  });

  it('restores, live-applies, and persists the five-level reading scale', async () => {
    localStorage.setItem('khatma.readingScale', '4');
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
    });
    const disclosure = document.querySelector('details');

    expect(disclosure).not.toBeNull();
    await harness.user.click(within(disclosure!).getByText(strings.settings.title));

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

  it('lets the selected member save an optional emoji avatar', async () => {
    const updatePerson = vi
      .fn<WriteOperations['updatePerson']>()
      .mockResolvedValue(undefined);
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
      operations: { ...writeOperations, updatePerson },
    });

    expect(screen.getByLabelText(strings.settings.avatarPreview)).toHaveTextContent('A');
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

  it('navigates between both routes and preserves the settings disclosure state', async () => {
    const harness = renderMember({
      route: '/settings',
      data: { roster: [amina] },
    });
    const disclosure = document.querySelector('details');

    expect(disclosure).not.toBeNull();
    await harness.user.click(within(disclosure!).getByText(strings.settings.title));
    expect(disclosure).toHaveAttribute('open');

    await harness.user.click(screen.getByRole('link', { name: strings.nav.personal }));
    expect(screen.getByRole('heading', { name: strings.personal.heading })).toBeVisible();

    await harness.user.click(screen.getByRole('link', { name: strings.nav.settings }));
    expect(screen.getByRole('heading', { name: strings.nav.settings })).toBeVisible();
    expect(document.querySelector('details')).toHaveAttribute('open');
  });
});

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemberHero } from '@/app/member/MemberHero';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberIdentitySummary } from '@/app/member/MemberIdentitySummary';
import { MemberShell } from '@/app/member/MemberShell';
import { strings } from '@/content/strings.ar';
import type { Person } from '@/domain/types';
import { renderWithAppProviders } from '../support/reactTestHarness';

const amina: Person = {
  id: 'person-1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

const maryam: Person = { ...amina, id: 'person-2', name: 'Maryam' };

function MemberExperience() {
  return (
    <MemberIdentityBoundary>
      <MemberShell>
        {/* The redesign shows the member name in the hero (identity summary
            keeps only heading + actions), so the probe includes both. */}
        <MemberHero />
        <MemberIdentitySummary />
      </MemberShell>
    </MemberIdentityBoundary>
  );
}

describe('member identity gate', () => {
  beforeEach(() => localStorage.clear());

  it('shows live loading, empty, and ready roster states without navigation', () => {
    const harness = renderWithAppProviders(<MemberExperience />);

    expect(screen.getByRole('heading', { name: strings.member.title })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(strings.member.connecting);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    harness.subscriptions.roster.emit([]);
    expect(screen.getByRole('status')).toHaveTextContent(strings.member.emptyRoster);

    harness.subscriptions.roster.emit([amina, maryam]);
    expect(screen.getByRole('button', { name: amina.name })).toBeVisible();
    expect(screen.getByRole('button', { name: maryam.name })).toBeVisible();
  });

  it('persists a selection, keeps one listener, and switches back to the gate', async () => {
    const harness = renderWithAppProviders(<MemberExperience />, {
      data: { roster: [amina] },
    });

    await harness.user.click(screen.getByRole('button', { name: amina.name }));

    expect(localStorage.getItem('khatma.memberId')).toBe(amina.id);
    expect(screen.getByText(amina.name)).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: strings.common.appName }),
    ).toBeVisible();
    expect(harness.subscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });

    harness.subscriptions.roster.emit([{ ...amina, name: 'Amina updated' }]);
    expect(screen.getByText('Amina updated')).toBeVisible();

    await harness.user.click(
      screen.getByRole('button', { name: strings.member.switchPerson }),
    );

    expect(localStorage.getItem('khatma.memberId')).toBeNull();
    expect(screen.getByRole('heading', { name: strings.member.title })).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(harness.subscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });

    harness.unmount();
    expect(harness.subscriptions.roster.counts()).toEqual({
      starts: 1,
      stops: 1,
      active: 0,
    });
  });

  it('restores a remembered identity and surfaces roster errors at the gate', () => {
    localStorage.setItem('khatma.memberId', maryam.id);
    const remembered = renderWithAppProviders(<MemberExperience />, {
      data: { roster: [maryam] },
    });

    expect(screen.getByText(maryam.name)).toBeVisible();
    remembered.unmount();

    localStorage.clear();
    const failed = renderWithAppProviders(<MemberExperience />);
    failed.subscriptions.roster.fail(new Error('offline'));

    expect(screen.getByRole('alert')).toHaveTextContent(strings.member.connectionError);
    expect(screen.queryByRole('button', { name: amina.name })).not.toBeInTheDocument();
  });
});

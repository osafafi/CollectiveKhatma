import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemberExperience } from '@/app/member/MemberApp';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { strings } from '@/content/strings.ar';
import type { Khatma, Person } from '@/domain/types';
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

function makeKhatma(id: string): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: `سلسلة ${id}`,
    seriesNumber: 1,
    totalPages: 604,
    scope: { kind: 'full' },
    memberIds: [amina.id],
    capacities: { [amina.id]: { pages: 2, surahs: 0, juz: 0 } },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [30, 31, 32],
    roundCount: 1,
    createdAt: Date.UTC(2026, 6, 1),
  };
}

/** jsdom reports `onLine` as a fixed `true`; replace the getter to steer it. */
function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
}

/** Flip the connection the way a browser does: value first, then the event. */
function goOffline(): void {
  act(() => {
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
  });
}

function goOnline(): void {
  act(() => {
    setOnline(true);
    window.dispatchEvent(new Event('online'));
  });
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

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('member offline banner', () => {
  it('appears only while the browser reports no connection', () => {
    renderMember({
      data: { roster: [amina], khatmas: [makeKhatma('k1')] },
    });

    expect(screen.queryByText(strings.member.offlineNotice)).not.toBeInTheDocument();

    goOffline();
    expect(screen.getByText(strings.member.offlineNotice)).toBeVisible();

    goOnline();
    expect(screen.queryByText(strings.member.offlineNotice)).not.toBeInTheDocument();
  });

  it('shows on a route rendered while already offline', () => {
    setOnline(false);
    renderMember({
      route: '/personal',
      data: { roster: [amina], khatmas: [] },
    });

    expect(screen.getByText(strings.member.offlineNotice)).toBeVisible();
  });
});

describe('member identity gate offline', () => {
  it('says nothing is saved on this device instead of spinning forever', () => {
    setOnline(false);
    // No roster snapshot ever arrives: offline on a device with an empty
    // Firestore cache, the one case persistence cannot rescue.
    renderWithAppProviders(<TestMemberExperience />, { data: {} });

    expect(screen.getByText(strings.member.offlineNoData)).toBeVisible();
    expect(screen.queryByText(strings.member.connecting)).not.toBeInTheDocument();
  });

  it('keeps the connecting spinner while a snapshot can still arrive', () => {
    renderWithAppProviders(<TestMemberExperience />, { data: {} });

    expect(screen.getByText(strings.member.connecting)).toBeVisible();
  });

  it('does not read an empty cache as an empty group', () => {
    setOnline(false);
    // What Firestore actually delivers from an empty persistent cache: a READY
    // snapshot carrying nothing. Verified against the emulator with the backend
    // stopped. Keyed on listener status alone this said "no members yet".
    renderWithAppProviders(<TestMemberExperience />, { data: { roster: [] } });

    expect(screen.getByText(strings.member.offlineNoData)).toBeVisible();
    expect(screen.queryByText(strings.member.emptyRoster)).not.toBeInTheDocument();
  });

  it('still reports a genuinely empty roster while online', () => {
    renderWithAppProviders(<TestMemberExperience />, { data: { roster: [] } });

    expect(screen.getByText(strings.member.emptyRoster)).toBeVisible();
  });
});

describe('assigned reader without a khatma snapshot', () => {
  it('says it could not load rather than spinning forever while offline', () => {
    setOnline(false);
    renderMember({ route: '/khatma/k1/read', data: { roster: [amina] } });

    expect(screen.getByText(strings.reader.loadFailed)).toBeVisible();
    expect(screen.queryByText(strings.common.loading)).not.toBeInTheDocument();
  });

  it('says it could not load when the khatma subscription fails', () => {
    const harness = renderMember({
      route: '/khatma/k1/read',
      data: { roster: [amina] },
    });
    expect(screen.getByText(strings.common.loading)).toBeVisible();

    act(() => {
      harness.subscriptions.khatmas.fail(new Error('permission denied'));
    });

    expect(screen.getByText(strings.reader.loadFailed)).toBeVisible();
  });

  it('treats a delivered empty khatma list as a real answer, not as loading', () => {
    renderMember({ route: '/khatma/k1/read', data: { roster: [amina], khatmas: [] } });

    expect(screen.getByText(strings.reader.noPagesToday)).toBeVisible();
    expect(screen.queryByText(strings.common.loading)).not.toBeInTheDocument();
  });

  it('does not read an empty cache as "you have no pages" while offline', () => {
    setOnline(false);
    // Same ready-but-empty snapshot the gate sees. "لا توجد صفحات مطلوبة منك"
    // would be a claim about this member's assignment that nothing supports.
    renderMember({ route: '/khatma/k1/read', data: { roster: [amina], khatmas: [] } });

    expect(screen.getByText(strings.reader.loadFailed)).toBeVisible();
    expect(screen.queryByText(strings.reader.noPagesToday)).not.toBeInTheDocument();
  });

  it('still loads a cached khatma while offline', () => {
    setOnline(false);
    renderMember({
      route: '/khatma/k1/read',
      // What Firestore's persistent cache delivers offline: last-known data.
      data: { roster: [amina], khatmas: [makeKhatma('k1')] },
    });

    // No assignment chunk in this khatma, so the reader lands on "no pages" —
    // the point is that it resolved from cached data instead of failing.
    expect(screen.getByText(strings.reader.noPagesToday)).toBeVisible();
    expect(screen.getByText(strings.member.offlineNotice)).toBeVisible();
  });
});

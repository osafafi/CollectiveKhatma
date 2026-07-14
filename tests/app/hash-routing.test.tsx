import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminApp } from '@/app/admin/AdminApp';
import { MemberApp } from '@/app/member/MemberApp';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import { AdminRouteLink, MemberRouteLink } from '@/app/routing/RouteLink';
import {
  useAdminNavigate,
  useAdminRoute,
  useMemberNavigate,
  useMemberRoute,
} from '@/app/routing/hooks';

function setHash(hash: string): void {
  window.history.replaceState(null, '', `/${hash}`);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

function MemberRouteProbe() {
  const route = useMemberRoute();
  const navigate = useMemberNavigate();

  return (
    <>
      <output data-testid="member-route">{JSON.stringify(route)}</output>
      <button type="button" onClick={() => navigate({ name: 'quran', page: 50 })}>
        Open Quran
      </button>
      <MemberRouteLink to={{ name: 'settings' }}>Member settings</MemberRouteLink>
    </>
  );
}

function AdminRouteProbe() {
  const route = useAdminRoute();
  const navigate = useAdminNavigate();

  return (
    <>
      <output data-testid="admin-route">{JSON.stringify(route)}</output>
      <button type="button" onClick={() => navigate({ name: 'khatma', id: 'k2' })}>
        Open khatma
      </button>
      <AdminRouteLink to={{ name: 'roster' }}>Admin roster</AdminRouteLink>
    </>
  );
}

describe('typed React hash routing', () => {
  it('reads member deep links and navigates with typed route objects', async () => {
    setHash('#/khatma/k1/read');
    const user = userEvent.setup();

    render(
      <AppHashRouter>
        <MemberRouteProbe />
      </AppHashRouter>,
    );

    expect(screen.getByTestId('member-route')).toHaveTextContent(
      JSON.stringify({ name: 'khatmaRead', id: 'k1' }),
    );
    expect(screen.getByRole('link', { name: 'Member settings' })).toHaveAttribute(
      'href',
      '#/settings',
    );

    await user.click(screen.getByRole('button', { name: 'Open Quran' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/quran/50');
      expect(screen.getByTestId('member-route')).toHaveTextContent(
        JSON.stringify({ name: 'quran', page: 50 }),
      );
    });
  });

  it('reads admin deep links and navigates with typed route objects', async () => {
    setHash('#/khatmas/k1');
    const user = userEvent.setup();

    render(
      <AppHashRouter>
        <AdminRouteProbe />
      </AppHashRouter>,
    );

    expect(screen.getByTestId('admin-route')).toHaveTextContent(
      JSON.stringify({ name: 'khatma', id: 'k1' }),
    );
    expect(screen.getByRole('link', { name: 'Admin roster' })).toHaveAttribute(
      'href',
      '#/roster',
    );

    await user.click(screen.getByRole('button', { name: 'Open khatma' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/khatmas/k2');
      expect(screen.getByTestId('admin-route')).toHaveTextContent(
        JSON.stringify({ name: 'khatma', id: 'k2' }),
      );
    });
  });

  it('keeps member fallback behavior without rewriting an unknown hash', () => {
    setHash('#/unknown-member-route');
    localStorage.setItem('khatma.memberId', 'routing-test-member');

    const { container } = render(<MemberApp />);

    expect(container.querySelector('[data-react-surface="member"]')).toHaveAttribute(
      'data-route',
      'khatmas',
    );
    expect(window.location.hash).toBe('#/unknown-member-route');
  });

  it('keeps admin fallback behavior without rewriting an unknown hash', () => {
    setHash('#/unknown-admin-route');

    const { container } = render(<AdminApp />);

    expect(container.querySelector('[data-react-surface="admin"]')).toHaveAttribute(
      'data-route',
      'home',
    );
    expect(window.location.hash).toBe('#/unknown-admin-route');
  });
});

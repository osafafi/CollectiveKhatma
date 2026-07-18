import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApp } from '@/app/admin/AdminApp';
import { MemberApp } from '@/app/member/MemberApp';
import { strings } from '@/content/strings.ar';

vi.mock('@/app/store/firestoreSubscriptionSources', () => {
  const subscribe = () => () => undefined;
  return {
    firestoreSubscriptionSources: {
      roster: subscribe,
      content: subscribe,
      khatmas: subscribe,
      assignments: subscribe,
    },
  };
});

describe('React app roots', () => {
  beforeEach(() => localStorage.clear());

  it('renders the isolated member preview root', () => {
    render(<MemberApp />);

    expect(
      screen.getByRole('heading', { name: strings.member.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(strings.member.connecting);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: strings.preview.memberHeading }),
    ).not.toBeInTheDocument();
  });

  it('renders the admin experience shell with the Home dashboard as default', () => {
    const { container } = render(<AdminApp />);

    // Persistent admin chrome: the title header and the responsive nav landmark.
    expect(screen.getByText(strings.admin.heading)).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: strings.admin.heading }),
    ).toBeInTheDocument();

    // Home is the default route; with no seeded khatmas it shows the empty state.
    expect(
      screen.getByRole('heading', { name: strings.admin.homeHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.admin.noActive)).toBeInTheDocument();
    expect(container.querySelector('[data-react-surface="admin"]')).toHaveAttribute(
      'data-route',
      'home',
    );

    // Production renders the current member surface.
    expect(
      screen.queryByRole('heading', { name: strings.preview.adminHeading }),
    ).not.toBeInTheDocument();
  });
});

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

  it('renders the isolated admin preview root', () => {
    const { container } = render(<AdminApp />);

    expect(
      screen.getByRole('heading', { name: strings.preview.adminHeading }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-react-surface="admin"]')).toHaveAttribute(
      'data-route',
      'home',
    );
    expect(screen.getByText(strings.preview.notProduction)).toHaveAttribute(
      'role',
      'status',
    );
    expect(
      screen.getByRole('heading', { name: strings.preview.primitivesHeading }),
    ).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminApp } from '@/app/admin/AdminApp';
import { MemberApp } from '@/app/member/MemberApp';
import { strings } from '@/content/strings.ar';

describe('React app roots', () => {
  it('renders the isolated member preview root', () => {
    const { container } = render(<MemberApp />);

    expect(
      screen.getByRole('heading', { name: strings.preview.memberHeading }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-react-surface="member"]')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(strings.preview.notProduction);
  });

  it('renders the isolated admin preview root', () => {
    const { container } = render(<AdminApp />);

    expect(
      screen.getByRole('heading', { name: strings.preview.adminHeading }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-react-surface="admin"]')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(strings.preview.notProduction);
  });
});

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import {
  AsyncContent,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback';
import { strings } from '@/content/strings.ar';

/** Render under the real MUI RTL theme so the primitives are exercised in-context. */
function renderThemed(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('Feedback primitives (RM-300)', () => {
  it('LoadingState announces a status region with default and custom copy', () => {
    const { rerender } = renderThemed(<LoadingState />);
    expect(screen.getByRole('status')).toHaveTextContent(strings.feedback.loading);

    rerender(
      <AppThemeProvider>
        <LoadingState message="Custom loading" />
      </AppThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Custom loading');
  });

  it('EmptyState shows the default message plus an optional action', () => {
    renderThemed(<EmptyState action={<button type="button">Add member</button>} />);
    expect(screen.getByText(strings.feedback.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeInTheDocument();
  });

  it('ErrorState alerts, and only offers retry when a handler is supplied', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const { rerender } = renderThemed(<ErrorState />);
    expect(screen.getByRole('alert')).toHaveTextContent(strings.feedback.errorTitle);
    expect(
      screen.queryByRole('button', { name: strings.feedback.retry }),
    ).not.toBeInTheDocument();

    rerender(
      <AppThemeProvider>
        <ErrorState onRetry={onRetry} message="Boom detail" />
      </AppThemeProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Boom detail');
    await user.click(screen.getByRole('button', { name: strings.feedback.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('AsyncContent maps listener status to feedback (RM-300)', () => {
  const child = <p>Ready content</p>;

  it('treats idle and loading as loading', () => {
    const { rerender } = renderThemed(<AsyncContent status="idle">{child}</AsyncContent>);
    expect(screen.getByRole('status')).toHaveTextContent(strings.feedback.loading);
    expect(screen.queryByText('Ready content')).not.toBeInTheDocument();

    rerender(
      <AppThemeProvider>
        <AsyncContent status="loading">{child}</AsyncContent>
      </AppThemeProvider>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the stored error string with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderThemed(
      <AsyncContent status="error" error="roster unavailable" onRetry={onRetry}>
        {child}
      </AsyncContent>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('roster unavailable');
    await user.click(screen.getByRole('button', { name: strings.feedback.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows empty when ready and empty, otherwise the children', () => {
    const { rerender } = renderThemed(
      <AsyncContent status="ready" isEmpty empty={{ message: 'Nothing here' }}>
        {child}
      </AsyncContent>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText('Ready content')).not.toBeInTheDocument();

    rerender(
      <AppThemeProvider>
        <AsyncContent status="ready">{child}</AsyncContent>
      </AppThemeProvider>,
    );
    expect(screen.getByText('Ready content')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { strings } from '@/content/strings.ar';

let shouldThrow = true;

function Bomb() {
  if (shouldThrow) {
    throw new Error('kaboom');
  }
  return <p>Recovered content</p>;
}

afterEach(() => {
  shouldThrow = true;
});

describe('ErrorBoundary', () => {
  it('renders children unchanged when nothing throws', () => {
    shouldThrow = false;
    render(
      <AppThemeProvider>
        <ErrorBoundary>
          <p>Healthy content</p>
        </ErrorBoundary>
      </AppThemeProvider>,
    );
    expect(screen.getByText('Healthy content')).toBeInTheDocument();
  });

  it('shows the crash fallback, notifies onError/console, then recovers on retry', async () => {
    const user = userEvent.setup();
    // Suppress React's own error logging and assert the boundary logged too.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <AppThemeProvider>
        <ErrorBoundary onError={onError}>
          <Bomb />
        </ErrorBoundary>
      </AppThemeProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(strings.feedback.crashTitle);
    expect(onError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalled();

    // Fix the underlying condition, then retry: the subtree re-mounts cleanly.
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: strings.feedback.retry }));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('supports a custom fallback render prop', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppThemeProvider>
        <ErrorBoundary fallback={(error) => <p>Custom: {error.message}</p>}>
          <Bomb />
        </ErrorBoundary>
      </AppThemeProvider>,
    );
    expect(screen.getByText('Custom: kaboom')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});

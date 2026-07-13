import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { SnackbarProvider } from '@/app/providers/SnackbarProvider';
import { useSnackbar } from '@/app/providers/useSnackbar';
import { strings } from '@/content/strings.ar';

function Trigger() {
  const { enqueueSnackbar } = useSnackbar();
  return (
    <div>
      <button
        type="button"
        onClick={() => enqueueSnackbar('First message', { severity: 'success' })}
      >
        Enqueue first
      </button>
      <button
        type="button"
        onClick={() => enqueueSnackbar('Second message', { severity: 'error' })}
      >
        Enqueue second
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AppThemeProvider>
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>
    </AppThemeProvider>,
  );
}

describe('SnackbarProvider (RM-300)', () => {
  it('shows an enqueued message and dismisses it on demand', async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByRole('button', { name: 'Enqueue first' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('First message');

    await user.click(screen.getByRole('button', { name: strings.feedback.dismiss }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('queues messages and surfaces the next once the current is dismissed', async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByRole('button', { name: 'Enqueue first' }));
    await user.click(screen.getByRole('button', { name: 'Enqueue second' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('First message');

    await user.click(screen.getByRole('button', { name: strings.feedback.dismiss }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Second message');
  });
});

describe('useSnackbar (RM-300)', () => {
  it('throws when used outside a SnackbarProvider', () => {
    function Orphan() {
      useSnackbar();
      return null;
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/SnackbarProvider/);
    consoleError.mockRestore();
  });
});

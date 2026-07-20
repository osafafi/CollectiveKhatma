import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { useConfirmation } from '@/app/providers/useConfirmation';
import { useSnackbar } from '@/app/providers/useSnackbar';
import { useMemberRoute } from '@/app/routing/hooks';
import {
  createAppStore,
  selectRosterListener,
  useAppSelector,
  type FirestoreSubscriptionSources,
} from '@/app/store';
import { strings } from '@/content/strings.ar';

/** Inert sources: they register a cleanup but never push a snapshot. */
const inertSources: FirestoreSubscriptionSources = {
  roster: () => () => undefined,
  content: () => () => undefined,
  feedback: () => () => undefined,
  khatmas: () => () => undefined,
  assignments: () => () => undefined,
};

function CompositionProbe() {
  const route = useMemberRoute();
  const rosterStatus = useAppSelector(selectRosterListener).status;
  const { enqueueSnackbar } = useSnackbar();
  const { confirm } = useConfirmation();
  const [confirmation, setConfirmation] = useState('idle');
  return (
    <div>
      <output data-testid="route">{route.name}</output>
      <output data-testid="roster-status">{rosterStatus}</output>
      <button
        type="button"
        onClick={() => enqueueSnackbar('Saved', { severity: 'success' })}
      >
        Notify
      </button>
      <button
        type="button"
        onClick={() => {
          void confirm('Continue?').then((answer) => setConfirmation(String(answer)));
        }}
      >
        Ask
      </button>
      <output aria-label="confirmation result">{confirmation}</output>
    </div>
  );
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('AppProviders composition', () => {
  it('wires store, subscriptions, router, RTL theme, and snackbar into one tree', async () => {
    window.history.replaceState(null, '', '/#/khatmas');
    const user = userEvent.setup();

    render(
      <AppProviders appStore={createAppStore()} sources={inertSources}>
        <CompositionProbe />
      </AppProviders>,
    );

    // Store + subscription bridge started: the roster listener left `idle`.
    expect(screen.getByTestId('roster-status')).toHaveTextContent('loading');
    // Router resolves the current hash.
    expect(screen.getByTestId('route')).toHaveTextContent('khatmas');
    // Theme provider forced RTL onto the document.
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    // Snackbar is reachable from any descendant of the composition.
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved');

    // The shared confirmation flow is also reachable and resolves asynchronously.
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Continue?')).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: strings.common.confirm }),
    );
    expect(screen.getByLabelText('confirmation result')).toHaveTextContent('true');
  });
});

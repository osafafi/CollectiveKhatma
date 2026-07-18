import { useState, type ReactElement } from 'react';
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { ConfirmationProvider } from '@/app/providers/ConfirmationProvider';
import { useConfirmation } from '@/app/providers/useConfirmation';
import {
  AppButton,
  AppCheckboxField,
  AppSelectField,
  AppSliderField,
  AppTextField,
  NoticeBanner,
  NumberStepper,
  ProgressView,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';

function renderThemed(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('Shared action and surface primitives', () => {
  it('covers compact, outlined, quiet, link, hero, and clickable-card actions', () => {
    renderThemed(
      <div>
        <SurfaceCard
          title="Series card"
          actions={
            <>
              <AppButton>Save</AppButton>
              <AppButton variant="outlined">Pause</AppButton>
              <AppButton variant="text" color="error" quiet>
                Remove
              </AppButton>
              <AppButton href="#/read" hero>
                Read pages
              </AppButton>
            </>
          }
        >
          <p>Card body</p>
        </SurfaceCard>
        <SurfaceCard title="Open series" href="#/khatma/k1" linkLabel="Open Khatma 1">
          <p>Progress summary</p>
        </SurfaceCard>
      </div>,
    );

    expect(screen.getByRole('heading', { name: 'Series card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'type',
      'button',
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    const hero = screen.getByRole('link', { name: 'Read pages' });
    expect(hero).toHaveAttribute('href', '#/read');
    expect(hero).toHaveClass('MuiButton-fullWidth', 'MuiButton-sizeLarge');

    expect(screen.getByRole('link', { name: 'Open Khatma 1' })).toHaveAttribute(
      'href',
      '#/khatma/k1',
    );
  });
});

describe('Shared form primitives', () => {
  function FieldsHarness() {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('full');
    const [checked, setChecked] = useState(false);
    const [scale, setScale] = useState(3);
    return (
      <div>
        <AppTextField
          label="Search members"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <AppTextField
          label="Pages"
          type="number"
          value="2"
          fieldWidth={96}
          slotProps={{ htmlInput: { min: 1 } }}
          onChange={() => {}}
        />
        <AppTextField
          label="Created date"
          type="date"
          value="2026-07-14"
          onChange={() => {}}
        />
        <AppTextField
          label="Du3a"
          value="Sample"
          multiline
          rows={4}
          slotProps={{ htmlInput: { className: 'quran-text' } }}
          onChange={() => {}}
        />
        <AppSelectField
          label="Scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'full', label: 'Full Quran' },
            { value: 'range', label: 'Page range' },
          ]}
        />
        <AppCheckboxField label="Member A" checked={checked} onChange={setChecked} />
        <AppSliderField
          label="Reading size"
          value={scale}
          onChange={setScale}
          min={1}
          max={5}
        />
      </div>
    );
  }

  it('keeps controlled text/search/number/date/multiline and checkbox drafts usable', async () => {
    const user = userEvent.setup();
    renderThemed(<FieldsHarness />);

    const search = screen.getByRole('searchbox', { name: 'Search members' });
    await user.type(search, 'Ali');
    expect(search).toHaveValue('Ali');

    expect(screen.getByRole('spinbutton', { name: 'Pages' })).toHaveAttribute('min', '1');
    expect(screen.getByLabelText('Created date')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('textbox', { name: 'Du3a' })).toHaveClass('quran-text');

    const checkbox = screen.getByRole('checkbox', { name: 'Member A' });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const slider = screen.getByRole('slider', { name: 'Reading size' });
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '5');
    expect(slider).toHaveAttribute('aria-valuenow', '3');
  });

  it('changes a labelled portalled RTL select without losing controlled value', async () => {
    const user = userEvent.setup();
    const { container } = renderThemed(<FieldsHarness />);

    await user.click(screen.getByRole('combobox', { name: 'Scope' }));
    const listbox = screen.getByRole('listbox');
    expect(container).not.toContainElement(listbox);
    expect(listbox.className).toMatch(/mui-rtl-/);
    await user.click(within(listbox).getByRole('option', { name: 'Page range' }));
    expect(screen.getByRole('combobox', { name: 'Scope' })).toHaveTextContent(
      'Page range',
    );
  });
});

describe('Shared numeric and display primitives', () => {
  function StepperHarness() {
    const [value, setValue] = useState(1);
    return (
      <NumberStepper
        label="Pages per round"
        value={value}
        min={1}
        max={2}
        onChange={setValue}
        suffix="pages"
        incrementLabel="Increase"
        decrementLabel="Decrease"
      />
    );
  }

  it('formats stepper values as Arabic digits and enforces min/max bounds', async () => {
    const user = userEvent.setup();
    renderThemed(<StepperHarness />);
    const decrement = screen.getByRole('button', { name: 'Decrease: Pages per round' });
    const increment = screen.getByRole('button', { name: 'Increase: Pages per round' });

    expect(decrement).toBeDisabled();
    expect(screen.getByText('١')).toHaveAttribute('aria-live', 'polite');
    await user.click(increment);
    expect(screen.getByText('٢')).toHaveAttribute('aria-live', 'polite');
    expect(increment).toBeDisabled();
  });

  it('pairs semantic text with chips, notices, and clamped accessible progress', () => {
    renderThemed(
      <div>
        <StatusChip tone="warning" label="First warning" />
        <NoticeBanner tone="danger">Returned pages</NoticeBanner>
        <ProgressView value={120} label="Group progress" />
      </div>,
    );

    expect(screen.getByText('First warning')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Returned pages');
    const progress = screen.getByRole('progressbar', { name: 'Group progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(progress).toHaveAttribute('aria-valuetext', '١٠٠٪');
    expect(screen.getByText('١٠٠٪')).toBeInTheDocument();
  });
});

describe('Queued confirmation pattern', () => {
  function ConfirmationHarness() {
    const { confirm } = useConfirmation();
    const [result, setResult] = useState('idle');
    const [queueResult, setQueueResult] = useState<string[]>([]);
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            void confirm({
              title: 'Remove member',
              message: 'Remove this member?',
              confirmLabel: 'Remove',
              cancelLabel: 'Keep',
              tone: 'danger',
            }).then((confirmed) => setResult(String(confirmed)));
          }}
        >
          Ask
        </button>
        <button
          type="button"
          onClick={() => {
            void confirm('First question').then((answer) =>
              setQueueResult((current) => [...current, String(answer)]),
            );
            void confirm('Second question').then((answer) =>
              setQueueResult((current) => [...current, String(answer)]),
            );
          }}
        >
          Queue
        </button>
        <output aria-label="result">{result}</output>
        <output aria-label="queue result">{queueResult.join(',')}</output>
      </div>
    );
  }

  function renderConfirmations() {
    return renderThemed(
      <ConfirmationProvider>
        <ConfirmationHarness />
      </ConfirmationProvider>,
    );
  }

  it('resolves false on cancel and true on explicit destructive confirmation', async () => {
    const user = userEvent.setup();
    renderConfirmations();

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove member' });
    expect(within(dialog).getByText('Remove this member?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(screen.getByLabelText('result')).toHaveTextContent('false');
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByLabelText('result')).toHaveTextContent('true');
  });

  it('shows concurrent requests FIFO and resolves each answer independently', async () => {
    const user = userEvent.setup();
    renderConfirmations();

    await user.click(screen.getByRole('button', { name: 'Queue' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('First question');
    await user.click(screen.getByRole('button', { name: 'تأكيد' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Second question');
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.getByLabelText('queue result')).toHaveTextContent('true,false');
  });

  it('keeps a portalled RTL dialog keyboard-bound and restores trigger focus', async () => {
    const user = userEvent.setup();
    const { container } = renderConfirmations();
    const ask = screen.getByRole('button', { name: 'Ask' });

    await user.tab();
    expect(ask).toHaveFocus();
    await user.keyboard('{Enter}');

    const dialog = screen.getByRole('dialog', { name: 'Remove member' });
    expect(container).not.toContainElement(dialog);
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(dialog.className).toMatch(/mui-rtl-/);
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Remove' })).toHaveFocus(),
    );

    await user.keyboard('{Escape}');
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(ask).toHaveFocus();
    expect(screen.getByLabelText('result')).toHaveTextContent('false');
  });
});

describe('useConfirmation', () => {
  it('throws when used outside a ConfirmationProvider', () => {
    function Orphan() {
      useConfirmation();
      return null;
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ConfirmationProvider/);
    consoleError.mockRestore();
  });
});

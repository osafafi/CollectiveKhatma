/**
 * Shared UI building blocks used by BOTH the member and admin apps (cards,
 * buttons, form fields, progress bar). Rendering only — no business logic.
 * One definition per widget so the two apps look consistent and stay in sync
 * (REQUIREMENTS §3: one place to restyle).
 */
import { toArabicDigits } from '@/content/quran/symbols';
import { el } from '@/ui/shared/dom';

/** A titled surface card (pass an empty title to omit the heading). */
export function card(title: string, children: Node[]): HTMLElement {
  const kids: Node[] = title
    ? [el('h2', { class: 'mb-3 text-xl font-semibold' }, [title]), ...children]
    : children;
  return el(
    'section',
    { class: 'space-y-3 rounded-card border border-border bg-surface p-4 shadow-sm' },
    kids,
  );
}

export function heading(text: string): HTMLElement {
  return el('h2', { class: 'text-xl font-bold text-primary' }, [text]);
}

export function progressBar(percent: number): HTMLElement {
  const fill = el('div', { class: 'h-2 rounded-button bg-primary' });
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  return el('div', { class: 'h-2 w-full overflow-hidden rounded-button bg-border' }, [fill]);
}

export function mutedText(text: string): HTMLElement {
  return el('p', { class: 'text-muted' }, [text]);
}

export function dangerText(text: string): HTMLElement {
  return el('p', { class: 'text-danger' }, [text]);
}

export function badge(text: string): HTMLElement {
  return el('span', { class: 'rounded-button bg-bg px-2 py-1 text-xs text-muted' }, [text]);
}

/** A rendered-but-invisible placeholder (display:none), so helpers can return an HTMLElement. */
export function emptyNode(): HTMLElement {
  return el('span', { hidden: 'hidden' });
}

export function labelled(label: string, control: Node): HTMLElement {
  return el('div', { class: 'space-y-1' }, [
    el('label', { class: 'block text-muted' }, [label]),
    control,
  ]);
}

// -----------------------------------------------------------------------------
// Buttons. `primaryButton` is the compact action; the member app's full-width
// hero action keeps its own class builder in `src/ui/member/components.ts`.
// -----------------------------------------------------------------------------

export function primaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    { type: 'button', class: 'rounded-button bg-primary px-4 py-2 font-semibold text-white' },
    [label],
  ) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

export function secondaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    { type: 'button', class: 'rounded-button border border-primary px-3 py-2 text-primary' },
    [label],
  ) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

/** A quiet text button. `tone: 'danger'` for destructive actions (remove/delete). */
export function linkButton(
  label: string,
  onClick: () => void,
  tone: 'muted' | 'danger' = 'muted',
): HTMLButtonElement {
  const button = el(
    'button',
    { type: 'button', class: `text-sm underline ${tone === 'danger' ? 'text-danger' : 'text-muted'}` },
    [label],
  ) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

// -----------------------------------------------------------------------------
// Form fields (uncontrolled — the caller keeps values in a draft object).
// -----------------------------------------------------------------------------

export function textField(
  value: string,
  placeholder: string,
  onInput: (v: string) => void,
): HTMLInputElement {
  const input = el('input', {
    type: 'text',
    placeholder,
    value,
    class: 'w-full rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

/** A text field wired for live filtering (search-as-you-type). */
export function searchField(
  value: string,
  placeholder: string,
  onInput: (v: string) => void,
): HTMLInputElement {
  const input = el('input', {
    type: 'search',
    placeholder,
    value,
    class: 'w-full rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

export function numberField(
  value: string,
  onInput: (v: string) => void,
  opts: { min?: string; width?: string } = {},
): HTMLInputElement {
  const input = el('input', {
    type: 'number',
    value,
    ...(opts.min ? { min: opts.min } : {}),
    class: `${opts.width ?? 'w-24'} rounded-button border border-border bg-bg px-3 py-2 tabular-nums`,
  }) as HTMLInputElement;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

export function selectField(
  options: Array<{ value: string; label: string }>,
  selected: string,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const select = el('select', {
    class: 'rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLSelectElement;
  for (const opt of options) {
    const option = el('option', { value: opt.value }, [opt.label]) as HTMLOptionElement;
    if (opt.value === selected) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

export function stepper(
  value: number,
  suffix: string,
  onInc: () => void,
  onDec: () => void,
): HTMLElement {
  return el('div', { class: 'flex items-center gap-1' }, [
    roundButton('−', onDec),
    el('span', { class: 'w-10 text-center tabular-nums' }, [toArabicDigits(value)]),
    roundButton('+', onInc),
    el('span', { class: 'text-xs text-muted' }, [suffix]),
  ]);
}

function roundButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    { type: 'button', class: 'h-8 w-8 rounded-full bg-bg text-lg font-bold text-primary' },
    [label],
  ) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

/** Today's local calendar date as YYYY-MM-DD (what the apps think of as "today"). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

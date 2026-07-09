/**
 * Shared member-app UI building blocks (card, progress bar, buttons, links).
 * Rendering only — no business logic. Kept here so the tab pages
 * (khatmas / personal / quran) and the shell render consistently.
 */
import { el } from '@/ui/shared/dom';

/** A titled surface card (pass an empty title to omit the heading). */
export function card(title: string, children: Node[]): HTMLElement {
  const kids: Node[] = title
    ? [el('h2', { class: 'mb-3 text-xl font-semibold' }, [title]), ...children]
    : children;
  return el('section', { class: 'rounded-card border border-border bg-surface p-4 shadow-sm' }, kids);
}

export function progressBar(percent: number): HTMLElement {
  const fill = el('div', { class: 'h-2 rounded-button bg-primary' });
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  return el('div', { class: 'h-2 w-full overflow-hidden rounded-button bg-border' }, [fill]);
}

export function mutedText(text: string): HTMLElement {
  return el('p', { class: 'text-muted' }, [text]);
}

/** Classes for the app's full-width primary action (button or anchor). */
export function primaryButtonClass(enabled = true): string {
  return `w-full rounded-button bg-primary px-4 py-4 text-lg font-semibold text-white${
    enabled ? '' : ' opacity-50'
  }`;
}

export function primaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', class: primaryButtonClass(true) }, [
    label,
  ]) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

/** A hash link styled as a full-width primary action (e.g. "read my pages"). */
export function primaryLink(label: string, href: string): HTMLElement {
  return el('a', { href, class: `${primaryButtonClass(true)} block text-center` }, [label]);
}

/** A quiet text button (e.g. "switch person"). */
export function linkButton(label: string, onClick: () => void): HTMLElement {
  const button = el('button', { type: 'button', class: 'text-sm text-muted underline' }, [label]);
  button.addEventListener('click', onClick);
  return button;
}

/** A quiet back link (hash navigation). */
export function backLink(label: string, href: string): HTMLElement {
  return el('a', { href, class: 'inline-block text-sm text-muted underline' }, [`‹ ${label}`]);
}

/** Today's local calendar date as YYYY-MM-DD (what the reader thinks of as "today"). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Member-app UI building blocks. The generic widgets live in
 * `src/ui/shared/components.ts` (shared with the admin app) and are re-exported
 * here; only the member-specific full-width hero actions are defined locally.
 */
import { el } from '@/ui/shared/dom';

export { card, linkButton, mutedText, progressBar, todayIso } from '@/ui/shared/components';

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

/** A quiet back link (hash navigation). */
export function backLink(label: string, href: string): HTMLElement {
  return el('a', { href, class: 'inline-block text-sm text-muted underline' }, [`‹ ${label}`]);
}

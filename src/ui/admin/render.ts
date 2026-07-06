import { strings } from '@/content/strings.ar';
import { el, mount } from '@/ui/shared/dom';

/**
 * Admin app — placeholder render for the scaffold. Proves the second entry
 * builds, themes, and deploys. The real dashboard (roster, khatmas,
 * assignments, progress) is built in later stages.
 */
export function renderAdmin(root: HTMLElement): void {
  mount(
    root,
    el('main', { class: 'mx-auto max-w-xl space-y-6 p-4' }, [
      el('header', { class: 'text-center' }, [
        el('h1', { class: 'text-3xl font-bold text-primary' }, [strings.admin.heading]),
      ]),
      el(
        'section',
        {
          class:
            'rounded-card border border-border bg-surface p-6 text-center text-muted',
        },
        [el('p', {}, [strings.admin.placeholder])],
      ),
    ]),
  );
}

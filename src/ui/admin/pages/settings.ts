/**
 * Admin Settings tab: global parameters — today only the du3a2 al-khatma text
 * (REQUIREMENTS §7) — plus the shared reading font-size control.
 */
import { setDu3aText } from '@/data/content';
import { strings } from '@/content/strings.ar';
import { card, emptyNode, primaryButton } from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import type { AdminCtx } from '@/ui/admin/ctx';

export function settingsPage(ctx: AdminCtx, settings: HTMLElement): HTMLElement {
  return el('div', { class: 'space-y-4' }, [
    el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.admin.navSettings]),
    du3aSection(ctx),
    settings,
  ]);
}

function du3aSection(ctx: AdminCtx): HTMLElement {
  const { draft } = ctx;
  const area = el(
    'textarea',
    { class: 'quran-text min-h-32 w-full rounded-button border border-border bg-bg p-3', rows: '4' },
    [draft.du3aText],
  ) as HTMLTextAreaElement;
  area.addEventListener('input', () => {
    draft.du3aText = area.value;
    draft.du3aTouched = true;
  });
  return card(strings.admin.du3aEditorHeading, [
    area,
    el('div', { class: 'mt-2 flex items-center gap-2' }, [
      primaryButton(strings.admin.save, () => {
        void setDu3aText(area.value)
          .then(() => {
            draft.du3aStatus = strings.admin.saved;
            draft.du3aTouched = false;
            ctx.rerender();
          })
          .catch(() => {
            draft.du3aStatus = strings.admin.saveError;
            ctx.rerender();
          });
      }),
      draft.du3aStatus ? el('span', { class: 'text-success' }, [draft.du3aStatus]) : emptyNode(),
    ]),
  ]);
}

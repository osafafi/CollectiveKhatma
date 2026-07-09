/**
 * The Personal tab: who you are on this device, your lifetime reading insight
 * (pages completed across every khatma, out of 604 — REQUIREMENTS §6), and the
 * "switch person" escape hatch. View-only.
 */
import { lifetimePercent } from '@/domain/progress';
import type { Person } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { el } from '@/ui/shared/dom';
import { card, linkButton, progressBar } from '@/ui/member/components';

export function personalView(params: { me: Person | undefined; onSwitch: () => void }): HTMLElement {
  const { me, onSwitch } = params;
  const count = me?.completedPages.length ?? 0;
  const percent = lifetimePercent(count);

  const identity = el('div', { class: 'space-y-1' }, [
    el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.personal.heading]),
    el('p', { class: 'text-muted' }, [strings.member.greeting]),
    el('p', { class: 'text-xl font-semibold' }, [me?.name ?? '']),
    linkButton(strings.member.switchPerson, onSwitch),
  ]);

  const insight = card(strings.member.lifetimeLead, [
    el('p', { class: 'text-lg' }, [
      `${strings.member.lifetimeLead} ${toArabicDigits(count)} ${strings.member.lifetimeTail} (${toArabicDigits(percent)}٪)`,
    ]),
    progressBar(percent),
  ]);

  return el('div', { class: 'space-y-4' }, [identity, insight]);
}

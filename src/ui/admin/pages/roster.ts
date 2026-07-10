/**
 * Admin Roster tab (REQUIREMENTS §8): search-as-you-type over the member list,
 * per-person controls (chunk size, pause, remove), and the add-member form.
 */
import { addPerson, removePerson, updatePerson } from '@/data/roster';
import { isNameUnique } from '@/domain/validation';
import type { Person } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import {
  badge,
  card,
  dangerText,
  emptyNode,
  linkButton,
  mutedText,
  numberField,
  primaryButton,
  searchField,
  secondaryButton,
  stepper,
  textField,
} from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import type { AdminCtx } from '@/ui/admin/ctx';

export function rosterPage(ctx: AdminCtx): HTMLElement {
  const { state, draft } = ctx;
  const query = draft.search.trim();
  const matches = query
    ? state.roster.filter((p) => p.name.includes(query))
    : state.roster;

  const rows =
    state.roster.length === 0
      ? [mutedText(strings.admin.emptyRoster)]
      : matches.length === 0
        ? [mutedText(strings.admin.noMatches)]
        : matches.map((p) => personRow(p));

  return el('div', { class: 'space-y-4' }, [
    el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.admin.rosterHeading]),
    card('', [
      searchField(draft.search, strings.admin.searchPlaceholder, (v) => {
        draft.search = v;
        rerenderPreservingSearchFocus(ctx);
      }),
      ...rows,
      addForm(ctx),
    ]),
  ]);
}

/**
 * Rerender while keeping the caret in the search box — a full DOM rebuild
 * would otherwise blur the input after every keystroke.
 */
function rerenderPreservingSearchFocus(ctx: AdminCtx): void {
  ctx.rerender();
  const input = document.querySelector<HTMLInputElement>('input[type="search"]');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function personRow(p: Person): HTMLElement {
  return el('div', { class: 'flex flex-wrap items-center gap-2 border-b border-border py-2' }, [
    el('span', { class: `flex-1 font-semibold${p.enabled ? '' : ' text-muted line-through'}` }, [
      p.name,
    ]),
    p.enabled ? emptyNode() : badge(strings.admin.disabledBadge),
    stepper(
      p.pagesPerDay,
      strings.admin.pagesPerDayLabel,
      () => void updatePerson(p.id, { pagesPerDay: p.pagesPerDay + 1 }),
      () => void updatePerson(p.id, { pagesPerDay: Math.max(1, p.pagesPerDay - 1) }),
    ),
    secondaryButton(p.enabled ? strings.admin.disable : strings.admin.enable, () =>
      void updatePerson(p.id, { enabled: !p.enabled }),
    ),
    linkButton(
      strings.admin.remove,
      () => {
        if (confirm(strings.admin.confirmRemove)) void removePerson(p.id);
      },
      'danger',
    ),
  ]);
}

function addForm(ctx: AdminCtx): HTMLElement {
  const { draft } = ctx;
  return el('div', { class: 'mt-4 space-y-2 border-t border-border pt-4' }, [
    textField(draft.newName, strings.admin.namePlaceholder, (v) => (draft.newName = v)),
    textField(draft.newNote, strings.admin.notePlaceholder, (v) => (draft.newNote = v)),
    el('div', { class: 'flex items-center gap-2' }, [
      el('label', { class: 'text-muted' }, [strings.admin.pagesPerDayLabel]),
      numberField(draft.newPagesPerDay, (v) => (draft.newPagesPerDay = v), {
        min: '1',
        width: 'w-20',
      }),
      primaryButton(strings.admin.addPerson, () => onAddPerson(ctx)),
    ]),
    draft.addError ? dangerText(draft.addError) : emptyNode(),
  ]);
}

function onAddPerson(ctx: AdminCtx): void {
  const { state, draft } = ctx;
  const name = draft.newName.trim();
  if (!name) {
    draft.addError = strings.admin.nameRequired;
    ctx.rerender();
    return;
  }
  if (!isNameUnique(name, state.roster)) {
    draft.addError = strings.admin.nameTaken;
    ctx.rerender();
    return;
  }
  const n = parseInt(draft.newPagesPerDay, 10);
  const pagesPerDay = Math.max(1, Number.isInteger(n) ? n : 2);
  void addPerson({ name, note: draft.newNote.trim() || undefined, pagesPerDay });
  draft.newName = '';
  draft.newNote = '';
  draft.addError = '';
  ctx.rerender();
}

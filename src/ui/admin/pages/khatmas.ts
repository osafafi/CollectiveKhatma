/**
 * Admin Khatmas tab (REQUIREMENTS §5, §8): the create form (open-ended — no
 * duration or start date; a name matching an existing series continues it with
 * the next number) and the list of all khatmas linking to their own pages.
 */
import { createKhatma } from '@/data/khatmas';
import { resolvePageScope } from '@/domain/assignment';
import { khatmaProgress } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import { findSeriesByName, nextSeriesNumber, seriesTitle } from '@/domain/series';
import type { Khatma, PageScope, Person } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import {
  badge,
  card,
  dangerText,
  emptyNode,
  labelled,
  mutedText,
  numberField,
  primaryButton,
  selectField,
  textField,
} from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import { adminHash } from '@/ui/admin/routes';
import type { AdminCtx, AdminDraft } from '@/ui/admin/ctx';

export function khatmasPage(ctx: AdminCtx): HTMLElement {
  return el('div', { class: 'space-y-4' }, [
    el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.admin.navKhatmas]),
    createSection(ctx),
    listSection(ctx),
  ]);
}

// -----------------------------------------------------------------------------
// Create form.
// -----------------------------------------------------------------------------

function createSection(ctx: AdminCtx): HTMLElement {
  const { state, draft } = ctx;

  const memberPicker = el(
    'div',
    { class: 'flex flex-wrap gap-2' },
    state.roster.length === 0
      ? [mutedText(strings.admin.emptyRoster)]
      : state.roster.map((p) => memberCheckbox(ctx, p)),
  );

  const scopeControls = el('div', { class: 'space-y-2' }, [
    selectField(
      [
        { value: 'full', label: strings.admin.scopeFull },
        { value: 'range', label: strings.admin.scopeRange },
        { value: 'surahs', label: strings.admin.scopeSurahs },
      ],
      draft.scopeKind,
      (v) => {
        draft.scopeKind = v as PageScope['kind'];
        ctx.rerender();
      },
    ),
    ...(draft.scopeKind === 'range'
      ? [
          el('div', { class: 'flex items-center gap-2' }, [
            el('label', { class: 'text-muted' }, [strings.admin.fromPage]),
            numberField(draft.rangeFrom, (v) => (draft.rangeFrom = v), { min: '1', width: 'w-24' }),
            el('label', { class: 'text-muted' }, [strings.admin.toPage]),
            numberField(draft.rangeTo, (v) => (draft.rangeTo = v), { min: '1', width: 'w-24' }),
          ]),
        ]
      : []),
    ...(draft.scopeKind === 'surahs'
      ? [textField(draft.surahsText, strings.admin.surahsPlaceholder, (v) => (draft.surahsText = v))]
      : []),
  ]);

  return card(strings.admin.createHeading, [
    textField(draft.seriesName, strings.admin.seriesNamePlaceholder, (v) => {
      draft.seriesName = v;
    }),
    seriesContinuationNote(ctx),
    labelled(strings.admin.scopeLabel, scopeControls),
    labelled(strings.admin.membersLabel, memberPicker),
    labelled(strings.admin.reciterLabel, reciterSelect(ctx)),
    primaryButton(strings.admin.createButton, () => void onCreate(ctx)),
    draft.createError ? dangerText(draft.createError) : emptyNode(),
  ]);
}

/** When the typed name matches an existing series, say which number comes next. */
function seriesContinuationNote(ctx: AdminCtx): HTMLElement {
  const existing = findSeriesByName(ctx.state.khatmas, ctx.draft.seriesName);
  if (!existing) return emptyNode();
  const next = nextSeriesNumber(ctx.state.khatmas, existing.seriesId);
  return el('p', { class: 'text-sm text-muted' }, [
    `${strings.admin.continuesSeries} ${toArabicDigits(next)}`,
  ]);
}

function memberCheckbox(ctx: AdminCtx, p: Person): HTMLElement {
  const { draft } = ctx;
  const box = el('input', { type: 'checkbox', class: 'accent-primary' }) as HTMLInputElement;
  box.checked = draft.memberIds.has(p.id);
  box.addEventListener('change', () => {
    if (box.checked) draft.memberIds.add(p.id);
    else draft.memberIds.delete(p.id);
    ctx.rerender();
  });
  return el('label', { class: 'flex items-center gap-1 rounded-button bg-bg px-3 py-1' }, [
    box,
    el('span', { class: p.enabled ? '' : 'text-muted' }, [
      p.enabled ? p.name : `${p.name} (${strings.admin.disabledBadge})`,
    ]),
  ]);
}

function reciterSelect(ctx: AdminCtx): HTMLElement {
  const { state, draft } = ctx;
  const selected = state.roster.filter((p) => draft.memberIds.has(p.id));
  const options = [
    { value: '', label: strings.admin.reciterAuto },
    ...selected.map((p) => ({ value: p.id, label: p.name })),
  ];
  const value = draft.memberIds.has(draft.reciterId) ? draft.reciterId : '';
  return selectField(options, value, (v) => {
    draft.reciterId = v;
    ctx.rerender();
  });
}

async function onCreate(ctx: AdminCtx): Promise<void> {
  const { state, draft } = ctx;
  draft.createError = '';
  const name = draft.seriesName.trim();
  if (!name) {
    draft.createError = strings.admin.seriesNameRequired;
    ctx.rerender();
    return;
  }
  const ids = [...draft.memberIds];
  if (ids.length === 0) {
    draft.createError = strings.admin.selectMembers;
    ctx.rerender();
    return;
  }
  const scope = buildScope(draft);
  let pool: number[];
  try {
    if (!scope) throw new Error('invalid');
    pool = resolvePageScope(scope, state.surahToPages);
  } catch {
    draft.createError = strings.admin.createError;
    ctx.rerender();
    return;
  }

  // Same name = same series, next number; otherwise a brand-new series.
  const existing = findSeriesByName(state.khatmas, name);
  const seriesId = existing?.seriesId ?? crypto.randomUUID();
  const seriesNumber = existing ? nextSeriesNumber(state.khatmas, seriesId) : 1;
  const reciter = draft.memberIds.has(draft.reciterId)
    ? draft.reciterId
    : pickDuaReciter(ids, state.khatmas);

  try {
    await createKhatma({
      seriesId,
      seriesName: existing?.seriesName ?? name,
      seriesNumber,
      totalPages: pool.length,
      scope,
      memberIds: ids,
      anonymous: false,
      remainingPages: pool,
      duaReciterId: reciter,
    });
    draft.seriesName = '';
    draft.memberIds = new Set();
    draft.reciterId = '';
    draft.createError = '';
    ctx.rerender();
  } catch {
    draft.createError = strings.admin.createError;
    ctx.rerender();
  }
}

function buildScope(draft: AdminDraft): PageScope | null {
  switch (draft.scopeKind) {
    case 'full':
      return { kind: 'full' };
    case 'range': {
      const fromPage = parseInt(draft.rangeFrom, 10);
      const toPage = parseInt(draft.rangeTo, 10);
      if (!Number.isInteger(fromPage) || !Number.isInteger(toPage)) return null;
      if (fromPage < 1 || toPage < fromPage) return null;
      return { kind: 'range', fromPage, toPage };
    }
    case 'surahs': {
      const surahIds = draft.surahsText
        .split(/[,،\s]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 114);
      if (surahIds.length === 0) return null;
      return { kind: 'surahs', surahIds };
    }
  }
}

// -----------------------------------------------------------------------------
// List of all khatmas (active first, then completed), each on its own page.
// -----------------------------------------------------------------------------

function listSection(ctx: AdminCtx): HTMLElement {
  const { state } = ctx;
  if (state.khatmas.length === 0) {
    return card(strings.admin.khatmasHeading, [mutedText(strings.admin.noActive)]);
  }
  const ordered = [...state.khatmas].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return card(
    strings.admin.khatmasHeading,
    ordered.map((k) => listLine(ctx, k)),
  );
}

function listLine(ctx: AdminCtx, k: Khatma): HTMLElement {
  const assignments = ctx.state.assignments.get(k.id) ?? [];
  const percent =
    k.status === 'completed' ? 100 : khatmaProgress(k, assignments).percent;
  return el(
    'a',
    {
      href: adminHash.khatma(k.id),
      class: 'flex items-center justify-between gap-2 border-b border-border py-2',
    },
    [
      el('span', { class: 'flex-1 font-semibold text-primary' }, [seriesTitle(k, toArabicDigits)]),
      badge(k.status === 'active' ? strings.admin.statusActive : strings.admin.statusCompleted),
      el('span', { class: 'text-sm tabular-nums text-muted' }, [`${toArabicDigits(percent)}٪`]),
    ],
  );
}

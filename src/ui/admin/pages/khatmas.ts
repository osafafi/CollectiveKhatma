/**
 * Admin Khatmas tab (REQUIREMENTS §5, §8): the list of all khatmas first, then a
 * gated create form (revealed by a button) that collects name/scope/members,
 * per-member additive capacity, and optional backfill (creation date + series
 * number). A name matching an existing series continues it with the next number.
 */
import { createKhatma } from '@/data/khatmas';
import { resolvePageScope } from '@/domain/assignment';
import { khatmaProgress } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import { findSeriesByName, nextSeriesNumber, seriesTitle } from '@/domain/series';
import type { Khatma, MemberCapacity, PageScope, Person } from '@/domain/types';
import type { Surah } from '@/content/quran/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import {
  badge,
  card,
  dangerText,
  emptyNode,
  labelled,
  linkButton,
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
    listSection(ctx),
    createArea(ctx),
  ]);
}

// -----------------------------------------------------------------------------
// Create: hidden behind a button (list-first), revealed as a full form.
// -----------------------------------------------------------------------------

function createArea(ctx: AdminCtx): HTMLElement {
  const { draft } = ctx;
  if (!draft.showCreateForm) {
    return primaryButton(strings.admin.createNewButton, () => {
      draft.showCreateForm = true;
      ctx.rerender();
    });
  }
  return createSection(ctx);
}

function createSection(ctx: AdminCtx): HTMLElement {
  const { state, draft } = ctx;

  const memberPicker = el(
    'div',
    { class: 'flex flex-wrap gap-2' },
    state.roster.length === 0
      ? [mutedText(strings.admin.emptyRoster)]
      : state.roster.map((p) => memberCheckbox(ctx, p)),
  );

  return card(strings.admin.createHeading, [
    textField(draft.seriesName, strings.admin.seriesNamePlaceholder, (v) => {
      draft.seriesName = v;
      ctx.rerender();
    }),
    seriesContinuationNote(ctx),
    labelled(strings.admin.scopeLabel, scopeControls(ctx)),
    labelled(strings.admin.membersLabel, memberPicker),
    capacitySection(ctx),
    labelled(strings.admin.reciterLabel, reciterSelect(ctx)),
    backfillSection(ctx),
    el('div', { class: 'flex flex-wrap items-center gap-2' }, [
      primaryButton(strings.admin.createButton, () => void onCreate(ctx)),
      linkButton(strings.admin.cancel, () => {
        draft.showCreateForm = false;
        ctx.rerender();
      }),
    ]),
    draft.createError ? dangerText(draft.createError) : emptyNode(),
  ]);
}

function scopeControls(ctx: AdminCtx): HTMLElement {
  const { draft } = ctx;
  return el('div', { class: 'space-y-2' }, [
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
    ...(draft.scopeKind === 'surahs' ? [surahChecklist(ctx)] : []),
  ]);
}

/** A checklist of surah NAMES (REQUIREMENTS §4) — replaces typing surah numbers. */
function surahChecklist(ctx: AdminCtx): HTMLElement {
  const { state } = ctx;
  if (!state.surahs) return mutedText(strings.common.loading);
  return el(
    'div',
    { class: 'flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-button bg-bg p-2' },
    state.surahs.map((s) => surahCheckbox(ctx, s)),
  );
}

function surahCheckbox(ctx: AdminCtx, s: Surah): HTMLElement {
  const { draft } = ctx;
  const box = el('input', { type: 'checkbox', class: 'accent-primary' }) as HTMLInputElement;
  box.checked = draft.surahIds.has(s.id);
  box.addEventListener('change', () => {
    if (box.checked) draft.surahIds.add(s.id);
    else draft.surahIds.delete(s.id);
  });
  return el('label', { class: 'flex items-center gap-1 rounded-button bg-surface px-2 py-1 text-sm' }, [
    box,
    el('span', {}, [`${toArabicDigits(s.id)}. ${s.name}`]),
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
    else {
      draft.memberIds.delete(p.id);
      delete draft.memberCaps[p.id];
    }
    ctx.rerender();
  });
  return el('label', { class: 'flex items-center gap-1 rounded-button bg-bg px-3 py-1' }, [
    box,
    el('span', { class: p.enabled ? '' : 'text-muted' }, [
      p.enabled ? p.name : `${p.name} (${strings.admin.disabledBadge})`,
    ]),
  ]);
}

/** Per-selected-member additive capacity: pages + whole surahs + whole juz. */
function capacitySection(ctx: AdminCtx): HTMLElement {
  const { state, draft } = ctx;
  const selected = state.roster.filter((p) => draft.memberIds.has(p.id));
  if (selected.length === 0) return emptyNode();
  const solo = selected.length === 1;
  return labelled(
    strings.admin.capacityLabel,
    el('div', { class: 'space-y-2' }, selected.map((p) => capacityRow(ctx, p, solo))),
  );
}

function capacityRow(ctx: AdminCtx, p: Person, solo: boolean): HTMLElement {
  const { draft } = ctx;
  // A solo reader defaults to one juz per round; group members to their roster pace.
  const fallback: MemberCapacity = solo
    ? { pages: 0, surahs: 0, juz: 1 }
    : { pages: p.pagesPerDay, surahs: 0, juz: 0 };
  const cap = (draft.memberCaps[p.id] ??= fallback);
  return el('div', { class: 'flex flex-wrap items-center gap-2' }, [
    el('span', { class: 'w-28 shrink-0 font-semibold' }, [p.name]),
    capacityField(cap.pages, strings.admin.capacityPages, (n) => (cap.pages = n)),
    surahCapacitySelect(ctx, cap),
    capacityField(cap.juz, strings.admin.capacityJuz, (n) => (cap.juz = n)),
  ]);
}

function capacityField(value: number, label: string, onSet: (n: number) => void): HTMLElement {
  return el('label', { class: 'flex items-center gap-1 text-xs text-muted' }, [
    numberField(String(value), (v) => onSet(Math.max(0, parseInt(v, 10) || 0)), {
      min: '0',
      width: 'w-16',
    }),
    label,
  ]);
}

/** The surah capacity as a name dropdown (first option = none) instead of a number. */
function surahCapacitySelect(ctx: AdminCtx, cap: MemberCapacity): HTMLElement {
  const options = [
    { value: '', label: strings.admin.noSurah },
    ...(ctx.state.surahs ?? []).map((s) => ({
      value: String(s.id),
      label: `${toArabicDigits(s.id)}. ${s.name}`,
    })),
  ];
  const select = selectField(options, cap.surahs > 0 ? String(cap.surahs) : '', (v) => {
    cap.surahs = v ? parseInt(v, 10) : 0;
  });
  return el('label', { class: 'flex items-center gap-1 text-xs text-muted' }, [
    select,
    strings.admin.capacitySurahs,
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

/** Optional backfill (REQUIREMENTS §8): real creation date and series number. */
function backfillSection(ctx: AdminCtx): HTMLElement {
  const { draft } = ctx;
  const dateInput = el('input', {
    type: 'date',
    value: draft.createdDate,
    class: 'rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  dateInput.addEventListener('input', () => (draft.createdDate = dateInput.value));
  return el('div', { class: 'flex flex-wrap gap-4' }, [
    labelled(strings.admin.createdDateLabel, dateInput),
    labelled(
      strings.admin.khatmaNumberLabel,
      numberField(draft.seriesNumberOverride, (v) => (draft.seriesNumberOverride = v), {
        min: '1',
        width: 'w-24',
      }),
    ),
  ]);
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Local midnight of a YYYY-MM-DD string as epoch ms, or undefined if unset/invalid. */
function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
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
  } catch (err) {
    console.error('onCreate: scope resolution failed', err);
    draft.createError = strings.admin.createError;
    ctx.rerender();
    return;
  }

  // Same name = same series, next number; otherwise a brand-new series.
  const existing = findSeriesByName(state.khatmas, name);
  const seriesId = existing?.seriesId ?? safeUUID();
  const autoNumber = existing ? nextSeriesNumber(state.khatmas, seriesId) : 1;
  const override = parseInt(draft.seriesNumberOverride, 10);
  const seriesNumber = Number.isInteger(override) && override > 0 ? override : autoNumber;
  const reciter = draft.memberIds.has(draft.reciterId)
    ? draft.reciterId
    : pickDuaReciter(ids, state.khatmas);
  const capacities = buildCapacities(ctx, ids);
  const createdAt = dateToEpoch(draft.createdDate);

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
      ...(Object.keys(capacities).length > 0 ? { capacities } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
    });
    resetCreateForm(draft);
    ctx.rerender();
  } catch (err) {
    console.error('onCreate: createKhatma failed', err);
    draft.createError = strings.admin.createError;
    ctx.rerender();
  }
}

function buildCapacities(ctx: AdminCtx, ids: string[]): Record<string, MemberCapacity> {
  const { state, draft } = ctx;
  const out: Record<string, MemberCapacity> = {};
  for (const id of ids) {
    const person = state.roster.find((p) => p.id === id);
    out[id] = draft.memberCaps[id] ?? {
      pages: person?.pagesPerDay ?? 2,
      surahs: 0,
      juz: 0,
    };
  }
  return out;
}

function resetCreateForm(draft: AdminDraft): void {
  draft.showCreateForm = false;
  draft.seriesName = '';
  draft.scopeKind = 'full';
  draft.surahIds = new Set();
  draft.memberIds = new Set();
  draft.memberCaps = {};
  draft.reciterId = '';
  draft.createdDate = '';
  draft.seriesNumberOverride = '';
  draft.createError = '';
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
      const surahIds = [...draft.surahIds].sort((a, b) => a - b);
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
  const percent = k.status === 'completed' ? 100 : khatmaProgress(k, assignments).percent;
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

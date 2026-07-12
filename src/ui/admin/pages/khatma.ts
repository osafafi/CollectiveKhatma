/**
 * Admin per-khatma management page (REQUIREMENTS §8): header with donut +
 * status, an edit card (name/number/creation date), a per-member table (warning
 * with clear, current chunk with mark-done/undo, manual return-to-pool, remove,
 * and per-member capacity), reciter controls, start-next-in-series,
 * complete/delete, and the series' completed-khatmas history.
 */
import { clearRoundDone, clearWarning, markRoundDone } from '@/data/assignments';
import {
  addMemberToKhatma,
  completeKhatma,
  deleteKhatma,
  releaseMemberChunk,
  removeMemberFromKhatma,
  renameSeries,
  updateKhatma,
} from '@/data/khatmas';
import { defaultCapacity } from '@/domain/assignment';
import { warningLevel } from '@/domain/distribution';
import { isRoundDone, khatmaProgress, latestReadableChunk } from '@/domain/progress';
import { completedInSeries, seriesTitle } from '@/domain/series';
import type {
  Assignment,
  Khatma,
  MemberCapacity,
  PageScope,
  Person,
  RoundChunk,
} from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { donutChart } from '@/ui/shared/charts';
import {
  badge,
  card,
  emptyNode,
  linkButton,
  mutedText,
  numberField,
  primaryButton,
  progressBar,
  secondaryButton,
  selectField,
  textField,
} from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import { adminHash } from '@/ui/admin/routes';
import { warningChip } from '@/ui/admin/pages/home';
import type { AdminCtx } from '@/ui/admin/ctx';

export function khatmaPage(ctx: AdminCtx, id: string): HTMLElement {
  const k = ctx.state.khatmas.find((x) => x.id === id);
  if (!k) {
    return el('div', { class: 'space-y-4' }, [
      backToList(),
      card('', [
        mutedText(
          ctx.state.khatmas.length === 0
            ? strings.common.loading
            : strings.admin.noActive,
        ),
      ]),
    ]);
  }
  const assignments = ctx.state.assignments.get(k.id) ?? [];

  const sections: Node[] = [backToList(), headerCard(k, assignments), editCard(ctx, k)];
  if (k.status === 'active')
    sections.push(membersCard(ctx, k, assignments), controlsCard(ctx, k));
  else sections.push(completedControls(ctx, k));
  sections.push(historyCard(ctx, k));
  return el('div', { class: 'space-y-4' }, sections);
}

function backToList(): HTMLElement {
  return el(
    'a',
    { href: adminHash.khatmas(), class: 'inline-block text-sm text-muted underline' },
    [`‹ ${strings.admin.navKhatmas}`],
  );
}

// -----------------------------------------------------------------------------
// Header: title, status, donut, progress, remaining/round facts.
// -----------------------------------------------------------------------------

function headerCard(k: Khatma, assignments: Assignment[]): HTMLElement {
  const progress = khatmaProgress(k, assignments);
  const percent = k.status === 'completed' ? 100 : progress.percent;
  return card('', [
    el('div', { class: 'flex items-center gap-4' }, [
      donutChart(percent, 88),
      el('div', { class: 'flex-1 space-y-1' }, [
        el('h1', { class: 'text-2xl font-bold text-primary' }, [
          seriesTitle(k, toArabicDigits),
        ]),
        badge(
          k.status === 'active'
            ? strings.admin.statusActive
            : strings.admin.statusCompleted,
        ),
        el('p', { class: 'text-sm text-muted' }, [
          `${toArabicDigits(k.remainingPages.length)} ${strings.admin.pagesRemaining}` +
            ` · ${strings.admin.roundWord} ${toArabicDigits(k.roundCount)}` +
            (k.lastDistributionDate
              ? ` · ${strings.admin.lastDistribution}: ${k.lastDistributionDate}`
              : ''),
        ]),
      ]),
    ]),
    progressBar(percent),
  ]);
}

// -----------------------------------------------------------------------------
// Edit card: name (whole series), number, creation date (REQUIREMENTS §8).
// -----------------------------------------------------------------------------

function editCard(ctx: AdminCtx, k: Khatma): HTMLElement {
  const { draft } = ctx;
  const edit = (draft.editKhatma[k.id] ??= {
    name: k.seriesName,
    number: String(k.seriesNumber),
    date: dateToInput(k.createdAt),
  });
  const dateInput = el('input', {
    type: 'date',
    value: edit.date,
    class: 'rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  dateInput.addEventListener('input', () => (edit.date = dateInput.value));

  const status = draft.status[k.id];
  return card(strings.admin.editKhatmaHeading, [
    el('div', { class: 'space-y-2' }, [
      el('label', { class: 'block text-muted' }, [strings.admin.seriesNamePlaceholder]),
      textField(edit.name, strings.admin.seriesNamePlaceholder, (v) => (edit.name = v)),
    ]),
    el('div', { class: 'flex flex-wrap gap-4' }, [
      el('div', { class: 'space-y-1' }, [
        el('label', { class: 'block text-muted' }, [strings.admin.khatmaNumberLabel]),
        numberField(edit.number, (v) => (edit.number = v), { min: '1', width: 'w-24' }),
      ]),
      el('div', { class: 'space-y-1' }, [
        el('label', { class: 'block text-muted' }, [strings.admin.createdDateLabel]),
        dateInput,
      ]),
    ]),
    el('div', { class: 'flex items-center gap-2' }, [
      primaryButton(strings.admin.saveKhatma, () => void onSaveEdit(ctx, k)),
      status ? el('span', { class: 'text-success' }, [status]) : emptyNode(),
    ]),
  ]);
}

async function onSaveEdit(ctx: AdminCtx, k: Khatma): Promise<void> {
  const edit = ctx.draft.editKhatma[k.id];
  if (!edit) return;
  const name = edit.name.trim();
  if (name && name !== k.seriesName) await renameSeries(k.seriesId, name);

  const changes: Partial<Pick<Khatma, 'seriesNumber' | 'createdAt'>> = {};
  const num = parseInt(edit.number, 10);
  if (Number.isInteger(num) && num > 0 && num !== k.seriesNumber)
    changes.seriesNumber = num;
  const ms = dateToEpoch(edit.date);
  if (ms !== undefined && ms !== k.createdAt) changes.createdAt = ms;
  if (Object.keys(changes).length > 0) await updateKhatma(k.id, changes);

  ctx.draft.status[k.id] = strings.admin.saved;
  ctx.rerender();
}

// -----------------------------------------------------------------------------
// Per-member table.
// -----------------------------------------------------------------------------

function membersCard(ctx: AdminCtx, k: Khatma, assignments: Assignment[]): HTMLElement {
  const rows = k.memberIds
    .map((memberId) => assignments.find((a) => a.memberId === memberId))
    .filter((a): a is Assignment => a !== undefined)
    .map((a) => memberRow(ctx, k, a));
  const children: Node[] = rows.length > 0 ? rows : [mutedText(strings.common.loading)];
  children.push(addMemberRow(ctx, k));
  return card(strings.admin.membersProgress, children);
}

function memberRow(ctx: AdminCtx, k: Khatma, a: Assignment): HTMLElement {
  const person = ctx.state.roster.find((p) => p.id === a.memberId);
  const name = person?.name ?? a.memberId;
  const level = warningLevel(a.missedStreak);
  const chunk = latestReadableChunk(a);
  const pending = chunk !== undefined && !isRoundDone(a, chunk.round);

  const top: Node[] = [el('span', { class: 'w-28 shrink-0 font-semibold' }, [name])];
  if (level !== 'none') {
    top.push(
      warningChip(name, level),
      linkButton(strings.admin.clearWarning, () => {
        const activeIds = ctx.state.khatmas
          .filter((x) => x.seriesId === k.seriesId && x.status === 'active')
          .map((x) => x.id);
        void clearWarning(activeIds, a.memberId);
      }),
    );
  }
  top.push(chunkCell(k, a));
  if (pending) {
    top.push(
      linkButton(strings.admin.returnToPool, () => {
        if (confirm(strings.admin.confirmReturnToPool))
          void releaseMemberChunk(k.id, a.memberId);
      }),
    );
  }
  top.push(
    linkButton(
      strings.admin.removeFromKhatma,
      () => {
        if (confirm(strings.admin.confirmRemoveFromKhatma))
          void removeMemberFromKhatma(k.id, a.memberId);
      },
      'danger',
    ),
  );

  const rows: Node[] = [el('div', { class: 'flex flex-wrap items-center gap-2' }, top)];
  if (person) rows.push(capacityEditor(ctx, k, a.memberId, person));
  return el('div', { class: 'space-y-1 border-b border-border py-2' }, rows);
}

/** Edit a member's per-khatma capacity (pages + whole surahs + whole juz). */
/** A surah-name dropdown (first option = none) for the surah capacity field. */
function surahSelectEl(ctx: AdminCtx, selectedId: number): HTMLSelectElement {
  const options = [
    { value: '', label: strings.admin.noSurah },
    ...(ctx.state.surahs ?? []).map((s) => ({
      value: String(s.id),
      label: `${toArabicDigits(s.id)}. ${s.name}`,
    })),
  ];
  return selectField(options, selectedId > 0 ? String(selectedId) : '', () => undefined);
}

function capacityEditor(
  ctx: AdminCtx,
  k: Khatma,
  memberId: string,
  person: Person,
): HTMLElement {
  const start = k.capacities?.[memberId] ?? defaultCapacity(person);
  const pagesIn = numberField(String(start.pages), () => undefined, {
    min: '0',
    width: 'w-16',
  });
  const surahsIn = surahSelectEl(ctx, start.surahs);
  const juzIn = numberField(String(start.juz), () => undefined, {
    min: '0',
    width: 'w-16',
  });
  const field = (input: HTMLElement, label: string): HTMLElement =>
    el('label', { class: 'flex items-center gap-1 text-xs text-muted' }, [input, label]);
  return el('div', { class: 'flex flex-wrap items-center gap-2 ps-2' }, [
    field(pagesIn, strings.admin.capacityPages),
    field(surahsIn, strings.admin.capacitySurahs),
    field(juzIn, strings.admin.capacityJuz),
    linkButton(strings.admin.saveCapacity, () => {
      const capacity: MemberCapacity = {
        pages: toInt(pagesIn.value),
        surahs: toInt(surahsIn.value),
        juz: toInt(juzIn.value),
      };
      void updateKhatma(k.id, {
        capacities: { ...(k.capacities ?? {}), [memberId]: capacity },
      });
    }),
  ]);
}

/** The member's current chunk: state text + pages span + mark-done/undo action. */
function chunkCell(k: Khatma, a: Assignment): HTMLElement {
  const chunk = latestReadableChunk(a);
  if (!chunk) {
    const last = a.rounds[a.rounds.length - 1];
    return el('span', { class: 'text-sm text-muted' }, [
      last?.released === true ? strings.admin.chunkReleased : strings.admin.noChunk,
    ]);
  }
  const done = isRoundDone(a, chunk.round);
  const label = `${chunkSpan(chunk)} · ${done ? strings.admin.chunkDone : strings.admin.chunkPending}`;
  const cls = done
    ? 'rounded-button bg-success/20 px-2 py-1 text-xs text-success'
    : 'rounded-button bg-bg px-2 py-1 text-xs text-muted';
  const chip = el(
    'button',
    {
      type: 'button',
      class: cls,
      title: done ? strings.admin.undo : strings.admin.markDone,
    },
    [label],
  ) as HTMLButtonElement;
  chip.addEventListener('click', () => {
    if (done) void clearRoundDone(k.id, a.memberId, chunk.round);
    else void markRoundDone(k.id, a.memberId, chunk.round);
  });
  return chip;
}

/** "٣ صفحات (١٥–١٧)" — count plus first–last page numbers. */
function chunkSpan(chunk: RoundChunk): string {
  const count = chunk.pages.length;
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  const first = chunk.pages[0];
  const last = chunk.pages[count - 1];
  const span =
    first === undefined || last === undefined || first === last
      ? toArabicDigits(first ?? 0)
      : `${toArabicDigits(first)}–${toArabicDigits(last)}`;
  return `${toArabicDigits(count)} ${word} (${span})`;
}

function addMemberRow(ctx: AdminCtx, k: Khatma): HTMLElement {
  const candidates = ctx.state.roster.filter((p) => !k.memberIds.includes(p.id));
  if (candidates.length === 0) return emptyNode();
  const select = selectField(
    candidates.map((p) => ({ value: p.id, label: p.name })),
    candidates[0]?.id ?? '',
    () => undefined,
  );
  const pagesIn = numberField(String(candidates[0]?.pagesPerDay ?? 2), () => undefined, {
    min: '0',
    width: 'w-16',
  });
  const surahsIn = surahSelectEl(ctx, 0);
  const juzIn = numberField('0', () => undefined, { min: '0', width: 'w-16' });
  const field = (input: HTMLElement, label: string): HTMLElement =>
    el('label', { class: 'flex items-center gap-1 text-xs text-muted' }, [input, label]);
  return el('div', { class: 'flex flex-wrap items-center gap-2 pt-2' }, [
    select,
    field(pagesIn, strings.admin.capacityPages),
    field(surahsIn, strings.admin.capacitySurahs),
    field(juzIn, strings.admin.capacityJuz),
    secondaryButton(strings.admin.addMember, () => {
      const capacity: MemberCapacity = {
        pages: toInt(pagesIn.value),
        surahs: toInt(surahsIn.value),
        juz: toInt(juzIn.value),
      };
      void addMemberToKhatma(k.id, select.value, capacity);
    }),
  ]);
}

// -----------------------------------------------------------------------------
// Controls.
// -----------------------------------------------------------------------------

function controlsCard(ctx: AdminCtx, k: Khatma): HTMLElement {
  const members = ctx.state.roster.filter((p) => k.memberIds.includes(p.id));
  const reciter =
    members.length > 0
      ? el('div', { class: 'flex items-center gap-2' }, [
          el('span', { class: 'text-muted' }, [`${strings.admin.reciterIs}:`]),
          selectField(
            members.map((p) => ({ value: p.id, label: p.name })),
            k.duaReciterId ?? '',
            (v) => void updateKhatma(k.id, { duaReciterId: v }),
          ),
        ])
      : emptyNode();

  return card('', [
    reciter,
    el('div', { class: 'flex flex-wrap gap-2' }, [
      secondaryButton(strings.admin.startNext, () => prefillNextKhatma(ctx, k)),
      primaryButton(strings.admin.markComplete, () => {
        if (confirm(strings.admin.confirmComplete)) void completeKhatma(k.id);
      }),
      linkButton(
        strings.admin.remove,
        () => {
          if (confirm(strings.admin.confirmRemoveKhatma)) void deleteKhatma(k.id);
        },
        'danger',
      ),
    ]),
  ]);
}

/** For a completed khatma: start the next cycle (prefilled create form). */
function completedControls(ctx: AdminCtx, k: Khatma): HTMLElement {
  return card('', [
    secondaryButton(strings.admin.startNext, () => prefillNextKhatma(ctx, k)),
  ]);
}

/**
 * Launch khatma N+1 in this series with the same members/scope/capacities by
 * default (REQUIREMENTS §5) — works even while N is still active. Prefills the
 * create form and jumps to it so the admin can tweak before confirming.
 */
function prefillNextKhatma(ctx: AdminCtx, k: Khatma): void {
  const { draft } = ctx;
  draft.seriesName = k.seriesName;
  draft.memberIds = new Set(k.memberIds);
  draft.memberCaps = Object.fromEntries(
    Object.entries(k.capacities ?? {}).map(([id, cap]) => [id, { ...cap }]),
  );
  draft.reciterId = k.duaReciterId ?? '';
  draft.seriesNumberOverride = '';
  draft.createdDate = '';
  hydrateScope(draft, k.scope);
  draft.showCreateForm = true;
  draft.createError = '';
  window.location.hash = adminHash.khatmas();
}

function hydrateScope(draft: AdminCtx['draft'], scope: PageScope): void {
  draft.scopeKind = scope.kind;
  draft.rangeFrom = '1';
  draft.rangeTo = '604';
  draft.surahIds = new Set();
  if (scope.kind === 'range') {
    draft.rangeFrom = String(scope.fromPage);
    draft.rangeTo = String(scope.toPage);
  } else if (scope.kind === 'surahs') {
    draft.surahIds = new Set(scope.surahIds);
  }
}

// -----------------------------------------------------------------------------
// Series history.
// -----------------------------------------------------------------------------

function historyCard(ctx: AdminCtx, k: Khatma): HTMLElement {
  const history = completedInSeries(ctx.state.khatmas, k.seriesId).filter(
    (x) => x.id !== k.id,
  );
  if (history.length === 0 && k.status === 'active') {
    return card(strings.admin.historyHeading, [mutedText(strings.admin.noCompleted)]);
  }
  const lines = (k.status === 'completed' ? [k, ...history] : history).map((x) => {
    const reciter =
      ctx.state.roster.find((p) => p.id === x.duaReciterId)?.name ?? strings.admin.none;
    const date = x.completedAt ? new Date(x.completedAt).toISOString().slice(0, 10) : '—';
    return el('div', { class: 'border-b border-border py-2 text-sm' }, [
      `${seriesTitle(x, toArabicDigits)} · ${strings.admin.completedOn} ${date} · ${strings.admin.reciterIs}: ${reciter}`,
    ]);
  });
  return card(strings.admin.historyHeading, lines);
}

// -----------------------------------------------------------------------------
// Small helpers.
// -----------------------------------------------------------------------------

const toInt = (v: string): number => Math.max(0, parseInt(v, 10) || 0);

/** Epoch ms of a YYYY-MM-DD string at local midnight, or undefined if invalid. */
function dateToEpoch(date: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Epoch ms → local YYYY-MM-DD for a date input. */
function dateToInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

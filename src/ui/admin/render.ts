import {
  addPerson,
  removePerson,
  subscribeRoster,
  updatePerson,
} from '@/data/roster';
import {
  completeKhatma,
  createKhatma,
  deleteKhatma,
  replanRemainingDays,
  subscribeKhatmas,
  updateKhatma,
} from '@/data/khatmas';
import {
  clearDayDone,
  markDayDone,
  overrideAssignment,
  subscribeAssignments,
} from '@/data/assignments';
import { setDu3aText, subscribeGlobalContent } from '@/data/content';
import { planAssignments, resolvePageScope } from '@/domain/assignment';
import { pickDuaReciter } from '@/domain/rotation';
import {
  isDayDone,
  khatmaProgress,
  pendingReaders,
  remainingPool,
  unassignedPages,
} from '@/domain/progress';
import { currentDayIndex, daysRemaining, isFinalStretch, isWithinKhatma } from '@/domain/schedule';
import { isNameUnique } from '@/domain/validation';
import type { Assignment, GlobalContent, Khatma, PageScope, Person } from '@/domain/types';
import { getQuranIndex } from '@/content/quran/loader';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { settingsControl } from '@/ui/shared/settings';
import { el, mount } from '@/ui/shared/dom';

/**
 * Admin app (REQUIREMENTS §8). Framework-free reactive loop like the member app:
 * Firestore realtime listeners write into `state` and call `rerender()`, which
 * rebuilds the page. Form fields live in a persistent `draft` so their values
 * survive rerenders. Sections: roster management, create-khatma, the active
 * dashboards (progress, pending, leftover pages, regenerate, reciter, complete,
 * per-member correction), the du3a editor, and the previous-khatmas log.
 */

interface AdminState {
  roster: Person[];
  khatmas: Khatma[];
  assignments: Map<string, Assignment[]>;
  content?: GlobalContent;
  surahToPages?: Record<number, [number, number]>;
}

interface Draft {
  newName: string;
  newNote: string;
  newPagesPerDay: string;
  addError: string;
  khatmaName: string;
  duration: string;
  startDate: string;
  scopeKind: PageScope['kind'];
  rangeFrom: string;
  rangeTo: string;
  surahsText: string;
  memberIds: Set<string>;
  reciterId: string; // '' = auto (rotation)
  createError: string;
  du3aText: string;
  du3aTouched: boolean;
  du3aStatus: string;
  status: Record<string, string>; // per-khatma transient message
}

interface Ctx {
  state: AdminState;
  draft: Draft;
  rerender: () => void;
}

export function renderAdmin(root: HTMLElement): void {
  const state: AdminState = { roster: [], khatmas: [], assignments: new Map() };
  const draft: Draft = {
    newName: '',
    newNote: '',
    newPagesPerDay: '2',
    addError: '',
    khatmaName: '',
    duration: '7',
    startDate: todayIso(),
    scopeKind: 'full',
    rangeFrom: '1',
    rangeTo: '604',
    surahsText: '',
    memberIds: new Set(),
    reciterId: '',
    createError: '',
    du3aText: '',
    du3aTouched: false,
    du3aStatus: '',
    status: {},
  };
  const settings = settingsControl();
  const assignmentSubs = new Map<string, () => void>();

  const ctx: Ctx = { state, draft, rerender: () => rerender() };
  const rerender = (): void => mount(root, renderApp(ctx, settings));

  rerender();

  // Surah page-spans, for resolving a "specific surahs" scope.
  void getQuranIndex()
    .then((index) => {
      state.surahToPages = index.surahToPages;
      rerender();
    })
    .catch(() => undefined);

  subscribeRoster((people) => {
    state.roster = people;
    rerender();
  });
  subscribeGlobalContent((content) => {
    state.content = content;
    if (!draft.du3aTouched) draft.du3aText = content?.du3aText ?? '';
    rerender();
  });
  subscribeKhatmas((khatmas) => {
    state.khatmas = khatmas;
    reconcileAssignmentSubs(state, khatmas, assignmentSubs, rerender);
    rerender();
  });
}

/** Subscribe to assignments for every active khatma (the dashboards need them). */
function reconcileAssignmentSubs(
  state: AdminState,
  khatmas: Khatma[],
  subs: Map<string, () => void>,
  rerender: () => void,
): void {
  const activeIds = new Set(khatmas.filter((k) => k.status === 'active').map((k) => k.id));
  for (const id of activeIds) {
    if (subs.has(id)) continue;
    subs.set(
      id,
      subscribeAssignments(id, (assignments) => {
        state.assignments.set(id, assignments);
        rerender();
      }),
    );
  }
  for (const id of [...subs.keys()]) {
    if (activeIds.has(id)) continue;
    subs.get(id)?.();
    subs.delete(id);
    state.assignments.delete(id);
  }
}

// -----------------------------------------------------------------------------
// Top-level render.
// -----------------------------------------------------------------------------

function renderApp(ctx: Ctx, settings: HTMLElement): HTMLElement {
  const { state } = ctx;
  const active = state.khatmas.filter((k) => k.status === 'active');
  const completed = state.khatmas.filter((k) => k.status === 'completed');

  return shell([
    header(),
    rosterSection(ctx),
    createSection(ctx),
    activeSection(ctx, active),
    du3aSection(ctx),
    completedSection(ctx, completed),
    settings,
  ]);
}

// -----------------------------------------------------------------------------
// Roster management.
// -----------------------------------------------------------------------------

function rosterSection(ctx: Ctx): HTMLElement {
  const { state, draft } = ctx;
  const rows =
    state.roster.length === 0
      ? [mutedText(strings.admin.emptyRoster)]
      : state.roster.map((p) => personRow(p));

  return card(strings.admin.rosterHeading, [
    ...rows,
    el('div', { class: 'mt-4 space-y-2 border-t border-border pt-4' }, [
      textField(draft.newName, strings.admin.namePlaceholder, (v) => (draft.newName = v)),
      textField(draft.newNote, strings.admin.notePlaceholder, (v) => (draft.newNote = v)),
      el('div', { class: 'flex items-center gap-2' }, [
        el('label', { class: 'text-muted' }, [strings.admin.pagesPerDayLabel]),
        numberField(draft.newPagesPerDay, (v) => (draft.newPagesPerDay = v), { min: '1', width: 'w-20' }),
        primaryButton(strings.admin.addPerson, () => onAddPerson(ctx)),
      ]),
      draft.addError ? dangerText(draft.addError) : emptyNode(),
    ]),
  ]);
}

function personRow(p: Person): HTMLElement {
  return el(
    'div',
    { class: 'flex flex-wrap items-center gap-2 border-b border-border py-2' },
    [
      el('span', { class: `flex-1 font-semibold${p.enabled ? '' : ' text-muted line-through'}` }, [
        p.name,
      ]),
      p.enabled ? emptyNode() : badge(strings.admin.disabledBadge),
      // pages/day stepper
      stepper(
        p.pagesPerDay,
        () => void updatePerson(p.id, { pagesPerDay: p.pagesPerDay + 1 }),
        () => void updatePerson(p.id, { pagesPerDay: Math.max(1, p.pagesPerDay - 1) }),
      ),
      secondaryButton(p.enabled ? strings.admin.disable : strings.admin.enable, () =>
        void updatePerson(p.id, { enabled: !p.enabled }),
      ),
      linkButton(strings.admin.remove, () => {
        if (confirm(strings.admin.confirmRemove)) void removePerson(p.id);
      }),
    ],
  );
}

function onAddPerson(ctx: Ctx): void {
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
  const pagesPerDay = Math.max(1, parseIntOr(draft.newPagesPerDay, 2));
  void addPerson({ name, note: draft.newNote.trim() || undefined, pagesPerDay });
  draft.newName = '';
  draft.newNote = '';
  draft.addError = '';
  ctx.rerender();
}

// -----------------------------------------------------------------------------
// Create khatma.
// -----------------------------------------------------------------------------

function createSection(ctx: Ctx): HTMLElement {
  const { state, draft } = ctx;

  const memberPicker = el(
    'div',
    { class: 'flex flex-wrap gap-2' },
    state.roster.length === 0
      ? [mutedText(strings.admin.emptyRoster)]
      : state.roster.map((p) => memberCheckbox(ctx, p)),
  );

  const scopeControls = el('div', { class: 'space-y-2' }, [
    scopeSelect(ctx),
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
    textField(draft.khatmaName, strings.admin.khatmaNamePlaceholder, (v) => (draft.khatmaName = v)),
    el('div', { class: 'flex flex-wrap items-center gap-3' }, [
      el('label', { class: 'text-muted' }, [strings.admin.durationLabel]),
      numberField(draft.duration, (v) => (draft.duration = v), { min: '1', width: 'w-20' }),
      el('label', { class: 'text-muted' }, [strings.admin.startDateLabel]),
      dateField(draft.startDate, (v) => (draft.startDate = v)),
    ]),
    labelled(strings.admin.scopeLabel, scopeControls),
    labelled(strings.admin.membersLabel, memberPicker),
    labelled(strings.admin.reciterLabel, reciterSelect(ctx)),
    coverageLine(ctx),
    primaryButton(strings.admin.createButton, () => void onCreate(ctx)),
    draft.createError ? dangerText(draft.createError) : emptyNode(),
  ]);
}

function memberCheckbox(ctx: Ctx, p: Person): HTMLElement {
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

function scopeSelect(ctx: Ctx): HTMLElement {
  const { draft } = ctx;
  return selectField(
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
  );
}

function reciterSelect(ctx: Ctx): HTMLElement {
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

/** Live coverage preview: whether current capacity covers the scope pool (REQUIREMENTS §8). */
function coverageLine(ctx: Ctx): HTMLElement {
  const info = coverage(ctx);
  if (!info) return emptyNode();
  if (info.short === 0) {
    return el('p', { class: 'text-success' }, [`✓ ${strings.admin.coverageCovered}`]);
  }
  return el('p', { class: 'text-danger' }, [
    `${toArabicDigits(info.short)} ${strings.admin.coverageShort}`,
  ]);
}

function coverage(ctx: Ctx): { poolSize: number; short: number } | null {
  const { state, draft } = ctx;
  const scope = buildScope(draft);
  if (!scope) return null;
  let pool: number[];
  try {
    pool = resolvePageScope(scope, state.surahToPages);
  } catch {
    return null;
  }
  const duration = parseIntOr(draft.duration, 0);
  if (duration < 1) return null;
  let capacity = 0;
  for (const id of draft.memberIds) {
    const p = state.roster.find((x) => x.id === id);
    if (p && p.enabled) capacity += p.pagesPerDay * duration;
  }
  return { poolSize: pool.length, short: Math.max(0, pool.length - capacity) };
}

async function onCreate(ctx: Ctx): Promise<void> {
  const { state, draft } = ctx;
  draft.createError = '';
  const ids = [...draft.memberIds];
  if (ids.length === 0) {
    draft.createError = strings.admin.selectMembers;
    ctx.rerender();
    return;
  }
  const scope = buildScope(draft);
  const duration = parseIntOr(draft.duration, 0);
  let pool: number[];
  try {
    if (!scope || duration < 1) throw new Error('invalid');
    pool = resolvePageScope(scope, state.surahToPages);
  } catch {
    draft.createError = strings.admin.createError;
    ctx.rerender();
    return;
  }

  const members = planMembers(state, ids);
  const { assignments } = planAssignments({ pages: pool, days: duration, members });
  const reciter = draft.memberIds.has(draft.reciterId)
    ? draft.reciterId
    : pickDuaReciter(ids, state.khatmas);

  try {
    await createKhatma(
      {
        name: draft.khatmaName.trim() || undefined,
        totalPages: pool.length,
        scope,
        startDate: draft.startDate,
        durationDays: duration,
        memberIds: ids,
        anonymous: false,
        duaReciterId: reciter,
      },
      assignments,
    );
    draft.khatmaName = '';
    draft.memberIds = new Set();
    draft.reciterId = '';
    draft.createError = '';
    ctx.rerender();
  } catch {
    draft.createError = strings.admin.createError;
    ctx.rerender();
  }
}

// -----------------------------------------------------------------------------
// Active khatma dashboards.
// -----------------------------------------------------------------------------

function activeSection(ctx: Ctx, active: Khatma[]): HTMLElement {
  if (active.length === 0) {
    return card(strings.admin.activeHeading, [mutedText(strings.admin.noActive)]);
  }
  return el('section', { class: 'space-y-4' }, [
    heading(strings.admin.activeHeading),
    ...active.map((k) => khatmaDashboard(ctx, k)),
  ]);
}

function khatmaDashboard(ctx: Ctx, k: Khatma): HTMLElement {
  const { state } = ctx;
  const assignments = state.assignments.get(k.id) ?? [];
  const today = todayIso();
  const within = isWithinKhatma(k.startDate, k.durationDays, today);
  const idx = currentDayIndex(k.startDate, today);
  const progress = khatmaProgress(assignments);
  const nameOf = (id: string | undefined): string =>
    state.roster.find((p) => p.id === id)?.name ?? strings.admin.none;

  const body: Node[] = [
    el('div', { class: 'flex items-center justify-between' }, [
      el('h3', { class: 'text-xl font-bold text-primary' }, [k.name ?? strings.common.appName]),
      dashStatus(k, today, within, idx),
    ]),
    el('div', { class: 'flex justify-between text-sm text-muted' }, [
      el('span', {}, [strings.admin.progressLabel]),
      el('span', { class: 'tabular-nums' }, [`${toArabicDigits(progress.percent)}٪`]),
    ]),
    progressBar(progress.percent),
    el('p', {}, [`${strings.admin.reciterIs}: `, el('span', { class: 'font-semibold' }, [nameOf(k.duaReciterId)])]),
    reciterChanger(ctx, k),
    pendingBlock(ctx, k, assignments),
    leftoverBlock(ctx, k, assignments, idx),
    membersProgressBlock(ctx, k, assignments),
    controlsRow(ctx, k, idx),
  ];
  const statusMsg = ctx.draft.status[k.id];
  if (statusMsg) body.push(el('p', { class: 'text-success' }, [statusMsg]));

  return card('', body);
}

function dashStatus(k: Khatma, today: string, within: boolean, idx: number): HTMLElement {
  if (!within) {
    return badge(idx < 0 ? strings.admin.notStarted : strings.admin.ended);
  }
  const left = daysRemaining(k.startDate, k.durationDays, today);
  const dayText = `${strings.admin.dayWord} ${toArabicDigits(idx + 1)} ${strings.admin.ofWord} ${toArabicDigits(k.durationDays)}`;
  const leftText = left === 1 ? strings.admin.oneDayLeft : `${toArabicDigits(left)} ${strings.admin.daysLeft}`;
  return el('span', { class: 'text-sm text-muted' }, [`${dayText} · ${leftText}`]);
}

function reciterChanger(ctx: Ctx, k: Khatma): HTMLElement {
  const { state } = ctx;
  const members = state.roster.filter((p) => k.memberIds.includes(p.id));
  const options = members.map((p) => ({ value: p.id, label: p.name }));
  if (options.length === 0) return emptyNode();
  return selectField(options, k.duaReciterId ?? '', (v) => void updateKhatma(k.id, { duaReciterId: v }));
}

function pendingBlock(ctx: Ctx, k: Khatma, assignments: Assignment[]): HTMLElement {
  const names = pendingReaders(assignments)
    .map((id) => ctx.state.roster.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return emptyNode();
  const urgent = isFinalStretch(k.startDate, k.durationDays, todayIso());
  const cls = urgent
    ? 'rounded-button bg-danger/10 p-3 text-danger'
    : 'rounded-button bg-bg p-3 text-muted';
  return el('div', { class: cls }, [
    el('p', { class: 'font-semibold' }, [
      `${urgent ? strings.admin.finalStretch + ' · ' : ''}${strings.admin.pendingHeading}`,
    ]),
    el('p', {}, [names.join('، ')]),
  ]);
}

/** Leftover unassigned pages — the core of REQUIREMENTS §8 (make them visible). */
function leftoverBlock(ctx: Ctx, k: Khatma, assignments: Assignment[], idx: number): HTMLElement {
  const pool = poolFor(ctx, k);
  if (!pool) return emptyNode();
  const leftover = unassignedPages(pool, assignments);
  if (leftover.length === 0) return emptyNode();

  const children: Node[] = [
    el('p', { class: 'font-semibold text-danger' }, [
      `${strings.admin.leftoverHeading}: ${toArabicDigits(leftover.length)}`,
    ]),
    el('p', { class: 'text-sm text-muted' }, [strings.admin.leftoverHint]),
    el('p', { class: 'max-h-24 overflow-y-auto text-sm tabular-nums' }, [
      leftover.map((p) => toArabicDigits(p)).join('، '),
    ]),
  ];

  // Hand all leftover pages to a chosen volunteer, spread over the days left.
  if (idx < k.durationDays) {
    const members = ctx.state.roster.filter((p) => k.memberIds.includes(p.id) && p.enabled);
    if (members.length > 0) {
      const select = selectField(
        members.map((p) => ({ value: p.id, label: p.name })),
        members[0]?.id ?? '',
        () => undefined,
      ) as HTMLSelectElement;
      children.push(
        el('div', { class: 'mt-2 flex items-center gap-2' }, [
          select,
          secondaryButton(strings.admin.assignTo, () =>
            void assignLeftover(ctx, k, leftover, select.value, idx),
          ),
        ]),
      );
    }
  }

  return el('div', { class: 'rounded-button border border-danger/40 p-3' }, children);
}

function membersProgressBlock(ctx: Ctx, k: Khatma, assignments: Assignment[]): HTMLElement {
  const rows = assignments
    .filter((a) => a.pagesByDay.some((d) => d.length > 0))
    .map((a) => {
      const name = ctx.state.roster.find((p) => p.id === a.memberId)?.name ?? a.memberId;
      const chips = a.pagesByDay
        .map((pages, d) => (pages.length > 0 ? dayChip(k, a, d, pages.length) : null))
        .filter((c): c is HTMLElement => c !== null);
      return el('div', { class: 'flex flex-wrap items-center gap-2 py-1' }, [
        el('span', { class: 'w-28 shrink-0' }, [name]),
        ...chips,
      ]);
    });
  if (rows.length === 0) return emptyNode();
  return el('div', { class: 'border-t border-border pt-2' }, [
    el('p', { class: 'mb-1 text-sm text-muted' }, [strings.admin.membersProgress]),
    ...rows,
  ]);
}

/** One day marker in a member's row: green if done (click to undo), grey if pending (click to mark). */
function dayChip(k: Khatma, a: Assignment, dayIndex: number, pageCount: number): HTMLElement {
  const done = isDayDone(a, dayIndex);
  const cls = done
    ? 'rounded-button bg-success/20 px-2 py-1 text-xs text-success'
    : 'rounded-button bg-bg px-2 py-1 text-xs text-muted';
  const label = `${toArabicDigits(dayIndex + 1)} (${toArabicDigits(pageCount)})`;
  const chip = el('button', { type: 'button', class: cls, title: done ? strings.admin.undo : strings.admin.markDone }, [
    label,
  ]) as HTMLButtonElement;
  chip.addEventListener('click', () => {
    if (done) void clearDayDone(k.id, a.memberId, dayIndex);
    else void markDayDone(k.id, a.memberId, dayIndex);
  });
  return chip;
}

function controlsRow(ctx: Ctx, k: Khatma, idx: number): HTMLElement {
  return el('div', { class: 'flex flex-wrap gap-2 border-t border-border pt-3' }, [
    secondaryButton(strings.admin.regenerate, () => void onRegenerate(ctx, k, idx)),
    secondaryButton(
      k.anonymous ? strings.admin.anonymousOn : strings.admin.anonymousOff,
      () => void updateKhatma(k.id, { anonymous: !k.anonymous }),
    ),
    primaryButton(strings.admin.markComplete, () => {
      if (confirm(strings.admin.confirmComplete)) void completeKhatma(k.id);
    }),
    linkButton(strings.admin.remove, () => {
      if (confirm(strings.admin.confirmRemove)) void deleteKhatma(k.id);
    }),
  ]);
}

async function onRegenerate(ctx: Ctx, k: Khatma, idx: number): Promise<void> {
  const { state } = ctx;
  const pool = poolFor(ctx, k);
  if (!pool) return;
  const fromDay = Math.max(0, idx + 1);
  const remainingDays = k.durationDays - fromDay;
  if (remainingDays < 1) {
    setStatus(ctx, k.id, strings.admin.regenerateEnded);
    return;
  }
  const assignments = state.assignments.get(k.id) ?? [];
  const pages = remainingPool(pool, assignments, fromDay);
  const { assignments: windowByMember } = planAssignments({
    pages,
    days: remainingDays,
    members: planMembers(state, k.memberIds),
  });
  await replanRemainingDays(k.id, fromDay, windowByMember);
  setStatus(ctx, k.id, strings.admin.regenerated);
}

/** Append leftover pages to one volunteer, spread over the days still to come. */
async function assignLeftover(
  ctx: Ctx,
  k: Khatma,
  leftover: number[],
  memberId: string,
  idx: number,
): Promise<void> {
  const assignments = ctx.state.assignments.get(k.id) ?? [];
  const mine = assignments.find((a) => a.memberId === memberId);
  if (!mine) return;
  const startDay = Math.max(0, idx);
  const days = k.durationDays - startDay;
  if (days < 1) return;
  const prefix = mine.pagesByDay.slice(0, startDay);
  const futureExisting = mine.pagesByDay.slice(startDay).flat();
  const combined = [...new Set([...futureExisting, ...leftover])].sort((a, b) => a - b);
  const { assignments: planned } = planAssignments({
    pages: combined,
    days,
    members: [{ id: memberId, completedPages: [], pagesPerDay: combined.length || 1, enabled: true }],
  });
  const window = planned[memberId] ?? [];
  await overrideAssignment(k.id, memberId, [...prefix, ...window]);
}

// -----------------------------------------------------------------------------
// Du3a editor.
// -----------------------------------------------------------------------------

function du3aSection(ctx: Ctx): HTMLElement {
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

// -----------------------------------------------------------------------------
// Previous (completed) khatmas — a simple list of lines (user's request).
// -----------------------------------------------------------------------------

function completedSection(ctx: Ctx, completed: Khatma[]): HTMLElement {
  if (completed.length === 0) {
    return card(strings.admin.completedHeading, [mutedText(strings.admin.noCompleted)]);
  }
  const sorted = [...completed].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return card(
    strings.admin.completedHeading,
    sorted.map((k) => completedLine(ctx, k)),
  );
}

function completedLine(ctx: Ctx, k: Khatma): HTMLElement {
  const reciter = ctx.state.roster.find((p) => p.id === k.duaReciterId)?.name ?? strings.admin.none;
  const date = k.completedAt ? new Date(k.completedAt).toISOString().slice(0, 10) : '—';
  const parts = [
    k.name ?? strings.common.appName,
    date,
    `${strings.admin.durationWord} ${toArabicDigits(k.durationDays)} ${strings.admin.daysWord}`,
    `${strings.admin.reciterIs}: ${reciter}`,
  ];
  return el('div', { class: 'flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm' }, [
    el('span', { class: 'flex-1' }, [parts.join(' · ')]),
    secondaryButton(strings.admin.restart, () => {
      if (confirm(strings.admin.confirmRestart)) void onRestart(ctx, k);
    }),
  ]);
}

async function onRestart(ctx: Ctx, k: Khatma): Promise<void> {
  const { state } = ctx;
  const pool = poolFor(ctx, k);
  if (!pool) return;
  const members = planMembers(state, k.memberIds);
  const { assignments } = planAssignments({ pages: pool, days: k.durationDays, members });
  const reciter = pickDuaReciter(k.memberIds, state.khatmas);
  await createKhatma(
    {
      name: k.name,
      totalPages: pool.length,
      scope: k.scope,
      startDate: todayIso(),
      durationDays: k.durationDays,
      memberIds: k.memberIds,
      anonymous: k.anonymous,
      duaReciterId: reciter,
    },
    assignments,
  );
}

// -----------------------------------------------------------------------------
// Shared helpers.
// -----------------------------------------------------------------------------

/** Map member ids to planner inputs from the current roster (skips removed ids). */
function planMembers(state: AdminState, ids: readonly string[]) {
  return ids
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Person => p !== undefined)
    .map((p) => ({
      id: p.id,
      completedPages: p.completedPages,
      pagesPerDay: p.pagesPerDay,
      enabled: p.enabled,
    }));
}

/** Resolve a khatma's scope to its page pool (needs the surah map for chapter scopes). */
function poolFor(ctx: Ctx, k: Khatma): number[] | null {
  try {
    return resolvePageScope(k.scope, ctx.state.surahToPages);
  } catch {
    return null;
  }
}

function buildScope(draft: Draft): PageScope | null {
  switch (draft.scopeKind) {
    case 'full':
      return { kind: 'full' };
    case 'range': {
      const fromPage = parseIntOr(draft.rangeFrom, 0);
      const toPage = parseIntOr(draft.rangeTo, 0);
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

function setStatus(ctx: Ctx, khatmaId: string, message: string): void {
  ctx.draft.status[khatmaId] = message;
  ctx.rerender();
}

function parseIntOr(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : fallback;
}

function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// -----------------------------------------------------------------------------
// DOM building blocks.
// -----------------------------------------------------------------------------

function shell(children: Node[]): HTMLElement {
  return el('main', { class: 'mx-auto max-w-2xl space-y-6 p-4' }, children);
}

function header(): HTMLElement {
  return el('header', { class: 'text-center' }, [
    el('h1', { class: 'text-3xl font-bold text-primary' }, [strings.admin.heading]),
  ]);
}

function heading(text: string): HTMLElement {
  return el('h2', { class: 'text-xl font-bold text-primary' }, [text]);
}

function card(title: string, children: Node[]): HTMLElement {
  const kids: Node[] = title
    ? [el('h2', { class: 'mb-3 text-xl font-semibold' }, [title]), ...children]
    : children;
  return el('section', { class: 'space-y-3 rounded-card border border-border bg-surface p-4 shadow-sm' }, kids);
}

function labelled(label: string, control: Node): HTMLElement {
  return el('div', { class: 'space-y-1' }, [el('label', { class: 'block text-muted' }, [label]), control]);
}

function textField(value: string, placeholder: string, onInput: (v: string) => void): HTMLInputElement {
  const input = el('input', {
    type: 'text',
    placeholder,
    value,
    class: 'w-full rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function numberField(
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

function dateField(value: string, onInput: (v: string) => void): HTMLInputElement {
  const input = el('input', {
    type: 'date',
    value,
    class: 'rounded-button border border-border bg-bg px-3 py-2',
  }) as HTMLInputElement;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function selectField(
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

function stepper(value: number, onInc: () => void, onDec: () => void): HTMLElement {
  return el('div', { class: 'flex items-center gap-1' }, [
    roundButton('−', onDec),
    el('span', { class: 'w-10 text-center tabular-nums' }, [toArabicDigits(value)]),
    roundButton('+', onInc),
    el('span', { class: 'text-xs text-muted' }, [strings.admin.pagesPerDayLabel]),
  ]);
}

function roundButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'h-8 w-8 rounded-full bg-bg text-lg font-bold text-primary',
  }, [label]) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

function primaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'rounded-button bg-primary px-4 py-2 font-semibold text-white',
  }, [label]) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

function secondaryButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'rounded-button border border-primary px-3 py-2 text-primary',
  }, [label]) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

function linkButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', class: 'text-sm text-danger underline' }, [
    label,
  ]) as HTMLButtonElement;
  button.addEventListener('click', onClick);
  return button;
}

function badge(text: string): HTMLElement {
  return el('span', { class: 'rounded-button bg-bg px-2 py-1 text-xs text-muted' }, [text]);
}

function progressBar(percent: number): HTMLElement {
  const fill = el('div', { class: 'h-2 rounded-button bg-primary' });
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  return el('div', { class: 'h-2 w-full overflow-hidden rounded-button bg-border' }, [fill]);
}

function mutedText(text: string): HTMLElement {
  return el('p', { class: 'text-muted' }, [text]);
}

function dangerText(text: string): HTMLElement {
  return el('p', { class: 'text-danger' }, [text]);
}

/** A rendered-but-invisible placeholder (display:none), so helpers can return an HTMLElement. */
function emptyNode(): HTMLElement {
  return el('span', { hidden: 'hidden' });
}

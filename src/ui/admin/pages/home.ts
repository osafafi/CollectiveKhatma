/**
 * Admin Home tab (REQUIREMENTS §8): at-a-glance metrics per active series —
 * donut + page breakdown, pending readers, warning counts — and the daily
 * "Distribute today's pages" action that drives the whole round model.
 */
import { AlreadyDistributedError, runDistribution } from '@/data/distribution';
import { defaultCapacity, resolvePageScope } from '@/domain/assignment';
import { warningLevel, type DistributionMember } from '@/domain/distribution';
import { currentChunk, khatmaProgress, pendingReaders } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import {
  activeSeriesGroups,
  nextSeriesNumber,
  seriesTitle,
  type SeriesGroup,
} from '@/domain/series';
import type { Assignment, Khatma } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { donutChart, segmentBar } from '@/ui/shared/charts';
import {
  card,
  emptyNode,
  mutedText,
  primaryButton,
  secondaryButton,
  todayIso,
} from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import type { AdminCtx } from '@/ui/admin/ctx';
import { adminHash } from '@/ui/admin/routes';

export function homePage(ctx: AdminCtx): HTMLElement {
  const groups = activeSeriesGroups(ctx.state.khatmas);
  const children: Node[] = [
    el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.admin.homeHeading]),
  ];
  if (groups.length === 0) children.push(card('', [mutedText(strings.admin.noActive)]));
  else children.push(...groups.map((g) => seriesBlock(ctx, g)));
  return el('div', { class: 'space-y-4' }, children);
}

function seriesBlock(ctx: AdminCtx, group: SeriesGroup): HTMLElement {
  const body: Node[] = [];

  for (const k of group.active) {
    body.push(khatmaMetrics(ctx, k), distributionAction(ctx, group, k));
  }

  body.push(warningsLine(ctx, group), pendingLine(ctx, group));

  return card(seriesTitle(group.latest, toArabicDigits), body);
}

/** A separate distribute/redistribute action for every active khatma. */
function distributionAction(ctx: AdminCtx, group: SeriesGroup, k: Khatma): HTMLElement {
  const distributedToday = k.lastDistributionDate === todayIso();
  const busy = ctx.draft.busy.has(k.id);
  const button = distributedToday
    ? secondaryButton(strings.admin.redistribute, () => {
        if (confirm(strings.admin.confirmRedistribute))
          void onDistribute(ctx, group, k, true);
      })
    : primaryButton(strings.admin.distribute, () => {
        if (confirm(strings.admin.confirmDistribute))
          void onDistribute(ctx, group, k, false);
      });
  button.disabled = busy;
  if (busy) button.classList.add('opacity-50');

  const children: Node[] = [];
  if (distributedToday) {
    children.push(
      el('p', { class: 'font-semibold text-success' }, [strings.admin.distributedToday]),
    );
  }
  children.push(button);
  const status = ctx.draft.status[k.id];
  if (status) children.push(el('p', { class: 'text-success' }, [status]));
  return el('div', { class: 'space-y-2 border-b border-border pb-3' }, children);
}

/** One active khatma's numbers: donut, breakdown bar, remaining/round/last-run. */
function khatmaMetrics(ctx: AdminCtx, k: Khatma): HTMLElement {
  const assignments = ctx.state.assignments.get(k.id) ?? [];
  const progress = khatmaProgress(k, assignments);
  const pendingPages = assignments.reduce(
    (sum, a) => sum + (currentChunk(a)?.pages.length ?? 0),
    0,
  );

  const facts = el('div', { class: 'flex-1 space-y-2' }, [
    el(
      'a',
      {
        class: 'inline-block font-semibold text-primary underline',
        href: adminHash.khatma(k.id),
      },
      [seriesTitle(k, toArabicDigits)],
    ),
    segmentBar([
      {
        value: progress.donePages,
        color: 'var(--color-primary)',
        label: strings.admin.legendDone,
      },
      {
        value: pendingPages,
        color: 'var(--color-accent)',
        label: strings.admin.legendPending,
      },
      {
        value: k.remainingPages.length,
        color: 'var(--color-border)',
        label: strings.admin.legendRemaining,
      },
    ]),
    el('p', { class: 'text-sm text-muted' }, [
      `${toArabicDigits(k.remainingPages.length)} ${strings.admin.pagesRemaining}` +
        ` · ${strings.admin.roundWord} ${toArabicDigits(k.roundCount)}` +
        (k.lastDistributionDate
          ? ` · ${strings.admin.lastDistribution}: ${k.lastDistributionDate}`
          : ''),
    ]),
  ]);

  return el('div', { class: 'flex items-center gap-4 border-b border-border pb-3' }, [
    donutChart(progress.percent, 88),
    facts,
  ]);
}

/** Names still reading their current chunk, across the series' active khatmas. */
function pendingLine(ctx: AdminCtx, group: SeriesGroup): HTMLElement {
  const ids = new Set<string>();
  for (const k of group.active) {
    for (const id of pendingReaders(ctx.state.assignments.get(k.id) ?? [])) ids.add(id);
  }
  const names = [...ids]
    .map((id) => ctx.state.roster.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return emptyNode();
  return el('div', { class: 'rounded-button bg-bg p-3 text-muted' }, [
    el('p', { class: 'font-semibold' }, [strings.admin.pendingHeading]),
    el('p', {}, [names.join('، ')]),
  ]);
}

/** Yellow/red warning chips with names (admin sees everything). */
function warningsLine(ctx: AdminCtx, group: SeriesGroup): HTMLElement {
  const flagged = flaggedMembers(ctx.state.assignments.get(group.latest.id) ?? []);
  const chips: Node[] = [];
  for (const { memberId, level } of flagged) {
    const name = ctx.state.roster.find((p) => p.id === memberId)?.name ?? memberId;
    chips.push(warningChip(name, level));
  }
  if (chips.length === 0) return emptyNode();
  return el('div', { class: 'flex flex-wrap gap-2' }, chips);
}

export function flaggedMembers(
  assignments: readonly Assignment[],
): Array<{ memberId: string; level: 'yellow' | 'red' }> {
  const out: Array<{ memberId: string; level: 'yellow' | 'red' }> = [];
  for (const a of assignments) {
    const level = warningLevel(a.missedStreak);
    if (level !== 'none') out.push({ memberId: a.memberId, level });
  }
  return out;
}

export function warningChip(name: string, level: 'yellow' | 'red'): HTMLElement {
  const cls =
    level === 'red'
      ? 'rounded-button bg-danger/10 px-2 py-1 text-xs font-semibold text-danger'
      : 'rounded-button bg-warn/10 px-2 py-1 text-xs font-semibold text-warn';
  const word =
    level === 'red' ? strings.admin.warningRedWord : strings.admin.warningYellowWord;
  return el('span', { class: cls }, [`⚠ ${name} · ${word}`]);
}

// -----------------------------------------------------------------------------
// The distribute action.
// -----------------------------------------------------------------------------

async function onDistribute(
  ctx: AdminCtx,
  group: SeriesGroup,
  khatma: Khatma,
  redistributePages: boolean,
): Promise<void> {
  const { state, draft } = ctx;

  let pool: number[];
  try {
    pool = resolvePageScope(khatma.scope, state.surahToPages);
  } catch {
    draft.status[khatma.id] = strings.admin.distributeError;
    ctx.rerender();
    return;
  }

  const members: DistributionMember[] = khatma.memberIds
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id,
      capacity: khatma.capacities?.[p.id] ?? defaultCapacity(p),
      completedPages: p.completedPages,
      enabled: p.enabled,
    }));

  draft.busy.add(khatma.id);
  delete draft.status[khatma.id];
  ctx.rerender();
  try {
    const isNewestActive = group.active.every(
      (active) => active.seriesNumber <= khatma.seriesNumber,
    );
    const outcome = await runDistribution({
      khatmaIds: [khatma.id],
      members,
      today: todayIso(),
      unitOfPage: state.pageUnitMaps,
      redistributePages,
      rolloverSeed: {
        seriesId: group.seriesId,
        seriesName: group.seriesName,
        seriesNumber: nextSeriesNumber(state.khatmas, group.seriesId),
        totalPages: pool.length,
        scope: khatma.scope,
        memberIds: khatma.memberIds,
        duaReciterId: pickDuaReciter(khatma.memberIds, state.khatmas),
        ...(khatma.capacities ? { capacities: khatma.capacities } : {}),
        pool: isNewestActive ? pool : [],
      },
    });
    const notes: string[] = [
      redistributePages
        ? strings.admin.redistributeSuccess
        : strings.admin.distributeSuccess,
    ];
    if (outcome.rolloverKhatmaId) notes.push(strings.admin.rolloverNote);
    if (outcome.completedKhatmaIds.length > 0) notes.push(strings.admin.completedNote);
    draft.status[khatma.id] = notes.join(' · ');
  } catch (err) {
    draft.status[khatma.id] =
      err instanceof AlreadyDistributedError
        ? strings.admin.alreadyDistributed
        : strings.admin.distributeError;
  } finally {
    draft.busy.delete(khatma.id);
    ctx.rerender();
  }
}

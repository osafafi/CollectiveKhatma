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
import { activeSeriesGroups, nextSeriesNumber, seriesTitle, type SeriesGroup } from '@/domain/series';
import type { Assignment, Khatma } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { donutChart, segmentBar } from '@/ui/shared/charts';
import { card, emptyNode, mutedText, primaryButton, todayIso } from '@/ui/shared/components';
import { el } from '@/ui/shared/dom';
import type { AdminCtx } from '@/ui/admin/ctx';

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
  const { draft } = ctx;
  const body: Node[] = [];

  for (const k of group.active) {
    body.push(khatmaMetrics(ctx, k));
  }

  body.push(warningsLine(ctx, group), pendingLine(ctx, group));

  // The daily action. One button per series; blocked when today already ran.
  const distributedToday = group.active.some((k) => k.lastDistributionDate === todayIso());
  if (distributedToday) {
    body.push(el('p', { class: 'font-semibold text-success' }, [strings.admin.distributedToday]));
  } else {
    const busy = draft.busy.has(group.seriesId);
    const btn = primaryButton(strings.admin.distribute, () => {
      if (confirm(strings.admin.confirmDistribute)) void onDistribute(ctx, group);
    });
    btn.disabled = busy;
    if (busy) btn.classList.add('opacity-50');
    body.push(btn);
  }

  const status = draft.status[group.seriesId];
  if (status) body.push(el('p', { class: 'text-success' }, [status]));

  return card(seriesTitle(group.latest, toArabicDigits), body);
}

/** One active khatma's numbers: donut, breakdown bar, remaining/round/last-run. */
function khatmaMetrics(ctx: AdminCtx, k: Khatma): HTMLElement {
  const assignments = ctx.state.assignments.get(k.id) ?? [];
  const progress = khatmaProgress(k, assignments);
  const pendingPages = assignments.reduce((sum, a) => sum + (currentChunk(a)?.pages.length ?? 0), 0);

  const facts = el('div', { class: 'flex-1 space-y-2' }, [
    el('p', { class: 'font-semibold' }, [seriesTitle(k, toArabicDigits)]),
    segmentBar([
      { value: progress.donePages, color: 'var(--color-primary)', label: strings.admin.legendDone },
      { value: pendingPages, color: 'var(--color-accent)', label: strings.admin.legendPending },
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
  const word = level === 'red' ? strings.admin.warningRedWord : strings.admin.warningYellowWord;
  return el('span', { class: cls }, [`⚠ ${name} · ${word}`]);
}

// -----------------------------------------------------------------------------
// The distribute action.
// -----------------------------------------------------------------------------

async function onDistribute(ctx: AdminCtx, group: SeriesGroup): Promise<void> {
  const { state, draft } = ctx;
  const { latest } = group;

  let pool: number[];
  try {
    pool = resolvePageScope(latest.scope, state.surahToPages);
  } catch {
    draft.status[group.seriesId] = strings.admin.distributeError;
    ctx.rerender();
    return;
  }

  const members: DistributionMember[] = latest.memberIds
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id,
      capacity: latest.capacities?.[p.id] ?? defaultCapacity(p),
      completedPages: p.completedPages,
      enabled: p.enabled,
    }));

  draft.busy.add(group.seriesId);
  delete draft.status[group.seriesId];
  ctx.rerender();
  try {
    const outcome = await runDistribution({
      khatmaIds: group.active.map((k) => k.id),
      members,
      today: todayIso(),
      unitOfPage: state.pageUnitMaps,
      rolloverSeed: {
        seriesId: group.seriesId,
        seriesName: group.seriesName,
        seriesNumber: nextSeriesNumber(state.khatmas, group.seriesId),
        totalPages: pool.length,
        scope: latest.scope,
        memberIds: latest.memberIds,
        anonymous: latest.anonymous,
        duaReciterId: pickDuaReciter(latest.memberIds, state.khatmas),
        ...(latest.capacities ? { capacities: latest.capacities } : {}),
        pool,
      },
    });
    const notes: string[] = [strings.admin.distributeSuccess];
    if (outcome.rolloverKhatmaId) notes.push(strings.admin.rolloverNote);
    if (outcome.completedKhatmaIds.length > 0) notes.push(strings.admin.completedNote);
    draft.status[group.seriesId] = notes.join(' · ');
  } catch (err) {
    draft.status[group.seriesId] =
      err instanceof AlreadyDistributedError
        ? strings.admin.alreadyDistributed
        : strings.admin.distributeError;
  } finally {
    draft.busy.delete(group.seriesId);
    ctx.rerender();
  }
}

/**
 * Admin per-khatma management page (REQUIREMENTS §8): header with donut +
 * status, per-member table (warning badge with clear, current chunk with
 * mark-done/undo), reciter + anonymous controls, add-member, complete/delete,
 * and the series' completed-khatmas history. Replaces the old single-page
 * dashboard's per-khatma section.
 */
import { clearRoundDone, clearWarning, markRoundDone } from '@/data/assignments';
import { addMemberToKhatma, completeKhatma, createKhatma, deleteKhatma, updateKhatma } from '@/data/khatmas';
import { resolvePageScope } from '@/domain/assignment';
import { warningLevel } from '@/domain/distribution';
import { isRoundDone, khatmaProgress, latestReadableChunk } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import { completedInSeries, nextSeriesNumber, seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, RoundChunk } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { donutChart } from '@/ui/shared/charts';
import {
  badge,
  card,
  emptyNode,
  linkButton,
  mutedText,
  primaryButton,
  progressBar,
  secondaryButton,
  selectField,
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
      card('', [mutedText(ctx.state.khatmas.length === 0 ? strings.common.loading : strings.admin.noActive)]),
    ]);
  }
  const assignments = ctx.state.assignments.get(k.id) ?? [];

  const sections: Node[] = [backToList(), headerCard(k, assignments)];
  if (k.status === 'active') sections.push(membersCard(ctx, k, assignments), controlsCard(ctx, k));
  else sections.push(completedControls(ctx, k));
  sections.push(historyCard(ctx, k));
  return el('div', { class: 'space-y-4' }, sections);
}

function backToList(): HTMLElement {
  return el('a', { href: adminHash.khatmas(), class: 'inline-block text-sm text-muted underline' }, [
    `‹ ${strings.admin.navKhatmas}`,
  ]);
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
        el('h1', { class: 'text-2xl font-bold text-primary' }, [seriesTitle(k, toArabicDigits)]),
        badge(k.status === 'active' ? strings.admin.statusActive : strings.admin.statusCompleted),
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
  const name = ctx.state.roster.find((p) => p.id === a.memberId)?.name ?? a.memberId;
  const level = warningLevel(a.missedStreak);

  const cells: Node[] = [el('span', { class: 'w-28 shrink-0 font-semibold' }, [name])];
  if (level !== 'none') {
    cells.push(
      warningChip(name, level),
      linkButton(strings.admin.clearWarning, () => {
        const activeIds = ctx.state.khatmas
          .filter((x) => x.seriesId === k.seriesId && x.status === 'active')
          .map((x) => x.id);
        void clearWarning(activeIds, a.memberId);
      }),
    );
  }
  cells.push(chunkCell(k, a));
  return el('div', { class: 'flex flex-wrap items-center gap-2 border-b border-border py-2' }, cells);
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
    { type: 'button', class: cls, title: done ? strings.admin.undo : strings.admin.markDone },
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
  return el('div', { class: 'flex items-center gap-2 pt-2' }, [
    select,
    secondaryButton(strings.admin.addMember, () => void addMemberToKhatma(k.id, select.value)),
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
      secondaryButton(k.anonymous ? strings.admin.anonymousOn : strings.admin.anonymousOff, () =>
        void updateKhatma(k.id, { anonymous: !k.anonymous }),
      ),
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

/** For a completed khatma whose series has no active one: start the next cycle. */
function completedControls(ctx: AdminCtx, k: Khatma): HTMLElement {
  const seriesHasActive = ctx.state.khatmas.some(
    (x) => x.seriesId === k.seriesId && x.status === 'active',
  );
  if (seriesHasActive) return emptyNode();
  return card('', [
    secondaryButton(strings.admin.startNext, () => {
      if (confirm(strings.admin.confirmStartNext)) void onStartNext(ctx, k);
    }),
  ]);
}

async function onStartNext(ctx: AdminCtx, k: Khatma): Promise<void> {
  let pool: number[];
  try {
    pool = resolvePageScope(k.scope, ctx.state.surahToPages);
  } catch {
    return;
  }
  await createKhatma({
    seriesId: k.seriesId,
    seriesName: k.seriesName,
    seriesNumber: nextSeriesNumber(ctx.state.khatmas, k.seriesId),
    totalPages: pool.length,
    scope: k.scope,
    memberIds: k.memberIds,
    anonymous: k.anonymous,
    remainingPages: pool,
    duaReciterId: pickDuaReciter(k.memberIds, ctx.state.khatmas),
  });
}

// -----------------------------------------------------------------------------
// Series history.
// -----------------------------------------------------------------------------

function historyCard(ctx: AdminCtx, k: Khatma): HTMLElement {
  const history = completedInSeries(ctx.state.khatmas, k.seriesId).filter((x) => x.id !== k.id);
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

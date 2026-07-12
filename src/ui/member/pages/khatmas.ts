/**
 * The Khatmas tab: one card per active series, and the per-khatma landing
 * page — the member's hub for one khatma: this round's pages, the one-tap
 * "finished" action, an entry into the reader, group progress, their own
 * warning (if any), and the series' completed-khatmas history.
 *
 * View-only: render.ts passes in the current live data and these functions
 * return DOM. The finish action writes through the data layer (allowed: UI→data).
 */
import { markRoundDone, ReleasedChunkError } from '@/data/assignments';
import { warningLevel } from '@/domain/distribution';
import {
  currentChunk,
  isRoundDone,
  khatmaProgress,
  latestReadableChunk,
  pendingReaders,
} from '@/domain/progress';
import { activeSeriesGroups, completedInSeries, seriesTitle } from '@/domain/series';
import type { Assignment, Khatma, Person, RoundChunk } from '@/domain/types';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { hash } from '@/ui/shared/router';
import { el } from '@/ui/shared/dom';
import {
  backLink,
  card,
  mutedText,
  primaryButtonClass,
  primaryLink,
  progressBar,
} from '@/ui/member/components';

// -----------------------------------------------------------------------------
// Khatmas list (tab root) — one card per series.
// -----------------------------------------------------------------------------

export function khatmasListView(params: {
  khatmas: Khatma[];
  assignmentsByKhatma: Map<string, Assignment[]>;
  memberId: string;
}): HTMLElement {
  const { khatmas, assignmentsByKhatma, memberId } = params;
  const heading = el('h1', { class: 'text-2xl font-bold text-primary' }, [
    strings.member.khatmasHeading,
  ]);

  const groups = activeSeriesGroups(khatmas);
  if (groups.length === 0) {
    return el('div', { class: 'space-y-4' }, [
      heading,
      card('', [mutedText(strings.member.noKhatmas)]),
    ]);
  }

  const grid = el(
    'div',
    { class: 'grid gap-4 md:grid-cols-2' },
    groups.map((g) => {
      // Land on the khatma holding my pending chunk; fall back to the newest.
      const mineIn =
        g.active.find((k) => {
          const a = assignmentsByKhatma.get(k.id)?.find((x) => x.memberId === memberId);
          return a ? currentChunk(a) !== undefined : false;
        }) ?? g.latest;
      return listCard(mineIn, assignmentsByKhatma.get(mineIn.id) ?? [], memberId);
    }),
  );
  return el('div', { class: 'space-y-4' }, [heading, grid]);
}

function listCard(k: Khatma, assignments: Assignment[], memberId: string): HTMLElement {
  const mine = assignments.find((a) => a.memberId === memberId);
  const progress = khatmaProgress(k, assignments);
  const chunk = mine ? latestReadableChunk(mine) : undefined;

  const myLine = !chunk
    ? mutedText(strings.member.awaitingDistribution)
    : isRoundDone(mine!, chunk.round)
      ? el('p', { class: 'font-semibold text-success' }, [
          `✓ ${strings.member.doneToday}`,
        ])
      : el('p', {}, [
          `${strings.member.todayHeading}: `,
          el('span', { class: 'font-semibold tabular-nums' }, [
            pagesCount(chunk.pages.length),
          ]),
        ]);

  return el(
    'a',
    {
      href: hash.khatma(k.id),
      class: 'block space-y-2 rounded-card border border-border bg-surface p-4 shadow-sm',
    },
    [
      el('div', { class: 'flex items-center justify-between gap-2' }, [
        el('h2', { class: 'text-lg font-bold text-primary' }, [
          seriesTitle(k, toArabicDigits),
        ]),
        el('span', { class: 'text-sm text-muted' }, [
          `${toArabicDigits(progress.percent)}٪`,
        ]),
      ]),
      progressBar(progress.percent),
      myLine,
    ],
  );
}

// -----------------------------------------------------------------------------
// Per-khatma landing page.
// -----------------------------------------------------------------------------

export function khatmaLandingView(params: {
  khatma: Khatma;
  /** ALL khatmas (for the series history card). */
  allKhatmas: Khatma[];
  assignments: Assignment[];
  roster: Person[];
  memberId: string;
  paused: boolean;
}): HTMLElement {
  const { khatma: k, allKhatmas, assignments, roster, memberId, paused } = params;
  const mine = assignments.find((a) => a.memberId === memberId);

  const sections: Node[] = [
    backLink(strings.member.khatmasHeading, hash.khatmas()),
    el('h1', { class: 'text-2xl font-bold text-primary' }, [
      seriesTitle(k, toArabicDigits),
    ]),
    roundLine(k),
  ];

  const myWarning = mine ? warningLevel(mine.missedStreak) : 'none';
  if (myWarning !== 'none') sections.push(warningBanner(myWarning));

  if (paused) {
    sections.push(
      el(
        'p',
        { class: 'rounded-button bg-primary/10 px-4 py-3 text-center text-primary' },
        [strings.member.pausedNote],
      ),
    );
  } else if (mine) {
    sections.push(myRoundCard(k, mine, memberId));
  }

  sections.push(
    card(strings.member.groupProgress, [groupProgress(k, assignments, roster)]),
  );

  const history = completedInSeries(allKhatmas, k.seriesId);
  if (history.length > 0) sections.push(historyCard(history));

  return el('div', { class: 'space-y-4' }, sections);
}

// -----------------------------------------------------------------------------
// Pieces.
// -----------------------------------------------------------------------------

/** "الجولة ٥ · بدأت 2026-07-08" — replaces the old day-of-duration line. */
function roundLine(k: Khatma): HTMLElement {
  const started = new Date(k.createdAt).toISOString().slice(0, 10);
  return el('p', { class: 'flex justify-between text-muted' }, [
    el('span', {}, [
      `${strings.member.roundWord} ${toArabicDigits(Math.max(1, k.roundCount))}`,
    ]),
    el('span', {}, [`${strings.member.startedWord} ${started}`]),
  ]);
}

/** The member's own warning — gentle wording, yellow or red tint (REQUIREMENTS §8). */
function warningBanner(level: 'yellow' | 'red'): HTMLElement {
  const cls =
    level === 'red'
      ? 'rounded-button bg-danger/10 px-4 py-3 text-danger'
      : 'rounded-button bg-warn/10 px-4 py-3 text-warn';
  return el('p', { class: cls }, [`⚠ ${strings.member.warningNote}`]);
}

function myRoundCard(k: Khatma, mine: Assignment, memberId: string): HTMLElement {
  const chunk = latestReadableChunk(mine);
  if (!chunk) {
    return card(strings.member.todayHeading, [
      mutedText(strings.member.awaitingDistribution),
    ]);
  }
  const done = isRoundDone(mine, chunk.round);
  const children: Node[] = [pagesRow(chunk.pages)];
  if (!done)
    children.push(primaryLink(strings.reader.readMyPages, hash.khatmaRead(k.id)));
  children.push(done ? doneBanner() : finishButton(k.id, memberId, chunk));
  return card(strings.member.todayHeading, children);
}

function pagesCount(count: number): string {
  const word = count === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return `${toArabicDigits(count)} ${word}`;
}

function pagesRow(pages: number[]): HTMLElement {
  if (pages.length === 0) return mutedText('—');
  return el('div', { class: 'space-y-2' }, [
    el('p', { class: 'font-semibold' }, [pagesCount(pages.length)]),
    el(
      'div',
      { class: 'flex flex-wrap gap-2' },
      pages.map((p) =>
        el('span', { class: 'rounded-button bg-bg px-3 py-1 text-lg tabular-nums' }, [
          toArabicDigits(p),
        ]),
      ),
    ),
  ]);
}

function finishButton(
  khatmaId: string,
  memberId: string,
  chunk: RoundChunk,
): HTMLElement {
  const error = el('p', { class: 'mt-2 text-center text-danger' }, []);
  const button = el('button', { type: 'button', class: primaryButtonClass(true) }, [
    strings.member.finishedToday,
  ]) as HTMLButtonElement;
  button.addEventListener('click', () => {
    button.disabled = true;
    error.textContent = '';
    void markRoundDone(khatmaId, memberId, chunk.round).catch((err: unknown) => {
      button.disabled = false;
      error.textContent =
        err instanceof ReleasedChunkError
          ? strings.member.releasedNote
          : strings.member.saveError;
    });
  });
  return el('div', {}, [button, error]);
}

function doneBanner(): HTMLElement {
  return el(
    'p',
    {
      class:
        'rounded-button bg-success/10 px-4 py-4 text-center text-lg font-semibold text-success',
    },
    [`✓ ${strings.member.doneToday}`],
  );
}

function groupProgress(
  k: Khatma,
  assignments: Assignment[],
  roster: Person[],
): HTMLElement {
  const progress = khatmaProgress(k, assignments);
  const children: Node[] = [
    el('div', { class: 'flex justify-between text-sm text-muted' }, [
      el('span', {}, [strings.member.groupProgress]),
      el('span', { class: 'tabular-nums' }, [`${toArabicDigits(progress.percent)}٪`]),
    ]),
    progressBar(progress.percent),
  ];

  // This round: who received a chunk in the khatma's current round, who's done.
  const inRound = assignments.filter((a) =>
    a.rounds.some(
      (c) => c.round === k.roundCount && c.pages.length > 0 && c.released !== true,
    ),
  );
  if (inRound.length > 0) {
    const doneCount = inRound.filter((a) => isRoundDone(a, k.roundCount)).length;
    children.push(
      el('p', { class: 'text-sm text-muted' }, [
        `${strings.member.completedRoundCount}: ${toArabicDigits(doneCount)} ${strings.member.ofWord} ${toArabicDigits(inRound.length)}`,
      ]),
    );
  }

  // Members can see who is still reading, but never each other's warning levels.
  const pendingNames = pendingReaders(assignments)
    .map((id) => roster.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (pendingNames.length > 0) {
    children.push(
      el('p', { class: 'text-sm text-muted' }, [`⏳ ${pendingNames.join('، ')}`]),
    );
  }

  return el('div', { class: 'space-y-1' }, children);
}

/** Completed khatmas of this series, newest first (REQUIREMENTS §5). */
function historyCard(history: Khatma[]): HTMLElement {
  return card(
    strings.member.historyHeading,
    history.map((k) => {
      const date = k.completedAt
        ? new Date(k.completedAt).toISOString().slice(0, 10)
        : '—';
      return el('p', { class: 'border-b border-border py-2 text-sm text-muted' }, [
        `${seriesTitle(k, toArabicDigits)} · ${strings.member.completedOn} ${date}`,
      ]);
    }),
  );
}

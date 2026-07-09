/**
 * The Khatmas tab: a list of the khatmas I'm part of, and the per-khatma landing
 * page. The landing page is the daily hub for one khatma — today's pages, the
 * one-tap "finished" action, an entry into the reader, and group progress.
 *
 * View-only: render.ts passes in the current live data and these functions
 * return DOM. The finish action writes through the data layer (allowed: UI→data).
 */
import { markDayDone } from '@/data/assignments';
import { currentDayIndex, daysRemaining, isWithinKhatma } from '@/domain/schedule';
import { isDayDone, khatmaProgress, pendingForDay } from '@/domain/progress';
import type { Assignment, Khatma, Person } from '@/domain/types';
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
  todayIso,
} from '@/ui/member/components';

// -----------------------------------------------------------------------------
// Khatmas list (tab root).
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

  if (khatmas.length === 0) {
    return el('div', { class: 'space-y-4' }, [heading, card('', [mutedText(strings.member.noKhatmas)])]);
  }

  const grid = el(
    'div',
    { class: 'grid gap-4 md:grid-cols-2' },
    khatmas.map((k) => listCard(k, assignmentsByKhatma.get(k.id) ?? [], memberId)),
  );
  return el('div', { class: 'space-y-4' }, [heading, grid]);
}

function listCard(k: Khatma, assignments: Assignment[], memberId: string): HTMLElement {
  const today = todayIso();
  const dayIndex = currentDayIndex(k.startDate, today);
  const within = isWithinKhatma(k.startDate, k.durationDays, today);
  const mine = assignments.find((a) => a.memberId === memberId);
  const progress = khatmaProgress(assignments);
  const todayCount = within && mine ? (mine.pagesByDay[dayIndex]?.length ?? 0) : 0;
  const doneToday = within && mine ? isDayDone(mine, dayIndex) : false;

  const todayLine = !within
    ? mutedText(dayIndex < 0 ? strings.member.notStarted : strings.member.ended)
    : doneToday
      ? el('p', { class: 'font-semibold text-success' }, [`✓ ${strings.member.doneToday}`])
      : el('p', {}, [
          `${strings.member.todayHeading}: `,
          el('span', { class: 'font-semibold tabular-nums' }, [
            `${toArabicDigits(todayCount)} ${todayCount === 1 ? strings.member.pageWord : strings.member.pagesWord}`,
          ]),
        ]);

  return el(
    'a',
    { href: hash.khatma(k.id), class: 'block space-y-2 rounded-card border border-border bg-surface p-4 shadow-sm' },
    [
      el('div', { class: 'flex items-center justify-between gap-2' }, [
        el('h2', { class: 'text-lg font-bold text-primary' }, [k.name ?? strings.common.appName]),
        el('span', { class: 'text-sm text-muted' }, [`${toArabicDigits(progress.percent)}٪`]),
      ]),
      progressBar(progress.percent),
      todayLine,
    ],
  );
}

// -----------------------------------------------------------------------------
// Per-khatma landing page.
// -----------------------------------------------------------------------------

export function khatmaLandingView(params: {
  khatma: Khatma;
  assignments: Assignment[];
  roster: Person[];
  memberId: string;
  paused: boolean;
}): HTMLElement {
  const { khatma: k, assignments, roster, memberId, paused } = params;
  const today = todayIso();
  const dayIndex = currentDayIndex(k.startDate, today);
  const within = isWithinKhatma(k.startDate, k.durationDays, today);
  const mine = assignments.find((a) => a.memberId === memberId);

  const sections: Node[] = [
    backLink(strings.member.khatmasHeading, hash.khatmas()),
    el('h1', { class: 'text-2xl font-bold text-primary' }, [k.name ?? strings.common.appName]),
    statusLine(k, today, within, dayIndex),
  ];

  if (paused) {
    sections.push(
      el('p', { class: 'rounded-button bg-primary/10 px-4 py-3 text-center text-primary' }, [
        strings.member.pausedNote,
      ]),
    );
  } else if (within && mine) {
    const pages = mine.pagesByDay[dayIndex] ?? [];
    const done = isDayDone(mine, dayIndex);
    const todayCard: Node[] = [pagesRow(pages)];
    if (pages.length > 0) {
      todayCard.push(primaryLink(strings.reader.readMyPages, hash.khatmaRead(k.id)));
    }
    todayCard.push(done ? doneBanner() : finishButton(k.id, memberId, dayIndex, pages.length > 0));
    sections.push(card(strings.member.todayHeading, todayCard));
  }

  sections.push(card(strings.member.groupProgress, [groupProgress(k, assignments, dayIndex, within, roster)]));
  return el('div', { class: 'space-y-4' }, sections);
}

// -----------------------------------------------------------------------------
// Shared pieces.
// -----------------------------------------------------------------------------

function statusLine(k: Khatma, today: string, within: boolean, dayIndex: number): HTMLElement {
  if (!within) {
    return mutedText(dayIndex < 0 ? strings.member.notStarted : strings.member.ended);
  }
  const left = daysRemaining(k.startDate, k.durationDays, today);
  const leftText =
    left === 1 ? strings.member.oneDayLeft : `${toArabicDigits(left)} ${strings.member.daysLeft}`;
  const dayText = `${strings.member.dayWord} ${toArabicDigits(dayIndex + 1)} ${strings.member.ofWord} ${toArabicDigits(k.durationDays)}`;
  return el('p', { class: 'flex justify-between text-muted' }, [
    el('span', {}, [dayText]),
    el('span', {}, [leftText]),
  ]);
}

function pagesRow(pages: number[]): HTMLElement {
  if (pages.length === 0) return mutedText('—');
  const word = pages.length === 1 ? strings.member.pageWord : strings.member.pagesWord;
  return el('div', { class: 'space-y-2' }, [
    el('p', { class: 'font-semibold' }, [`${toArabicDigits(pages.length)} ${word}`]),
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
  dayIndex: number,
  enabled: boolean,
): HTMLElement {
  const error = el('p', { class: 'mt-2 text-center text-danger' }, []);
  const button = el('button', { type: 'button', class: primaryButtonClass(enabled) }, [
    strings.member.finishedToday,
  ]) as HTMLButtonElement;
  button.disabled = !enabled;
  button.addEventListener('click', () => {
    button.disabled = true;
    error.textContent = '';
    void markDayDone(khatmaId, memberId, dayIndex).catch(() => {
      button.disabled = false;
      error.textContent = strings.member.saveError;
    });
  });
  return el('div', {}, [button, error]);
}

function doneBanner(): HTMLElement {
  return el(
    'p',
    { class: 'rounded-button bg-success/10 px-4 py-4 text-center text-lg font-semibold text-success' },
    [`✓ ${strings.member.doneToday}`],
  );
}

function groupProgress(
  k: Khatma,
  assignments: Assignment[],
  dayIndex: number,
  within: boolean,
  roster: Person[],
): HTMLElement {
  const progress = khatmaProgress(assignments);
  const children: Node[] = [
    el('div', { class: 'flex justify-between text-sm text-muted' }, [
      el('span', {}, [strings.member.groupProgress]),
      el('span', { class: 'tabular-nums' }, [`${toArabicDigits(progress.percent)}٪`]),
    ]),
    progressBar(progress.percent),
  ];

  if (within) {
    const withPagesToday = assignments.filter((a) => (a.pagesByDay[dayIndex]?.length ?? 0) > 0);
    const doneCount = withPagesToday.filter((a) => isDayDone(a, dayIndex)).length;
    children.push(
      el('p', { class: 'text-sm text-muted' }, [
        `${strings.member.completedTodayCount}: ${toArabicDigits(doneCount)} ${strings.member.ofWord} ${toArabicDigits(withPagesToday.length)}`,
      ]),
    );
    // Names of who's still pending today — only when the khatma isn't anonymous
    // (REQUIREMENTS §6: anonymous mode shows counts only, never names).
    if (!k.anonymous) {
      const pendingNames = pendingForDay(assignments, dayIndex)
        .map((id) => roster.find((p) => p.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      if (pendingNames.length > 0) {
        children.push(el('p', { class: 'text-sm text-muted' }, [`⏳ ${pendingNames.join('، ')}`]));
      }
    }
  }

  return el('div', { class: 'space-y-1' }, children);
}

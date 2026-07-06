import { subscribeRoster } from '@/data/roster';
import { subscribeKhatmas } from '@/data/khatmas';
import { markDayDone, subscribeAssignments } from '@/data/assignments';
import { subscribeGlobalContent } from '@/data/content';
import { currentDayIndex, daysRemaining, isWithinKhatma } from '@/domain/schedule';
import { isDayDone, khatmaProgress, lifetimePercent, pendingForDay } from '@/domain/progress';
import type { Assignment, GlobalContent, Khatma, Person } from '@/domain/types';
import { strings, DEFAULT_DU3A_TEXT } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import { forgetMember, getRememberedMemberId, rememberMemberId } from '@/ui/shared/identity';
import { settingsControl } from '@/ui/shared/settings';
import { el, mount } from '@/ui/shared/dom';

/**
 * Member app (REQUIREMENTS §6). Trust-based identity gate, then the daily flow:
 * today's pages per active khatma, one-tap "finished", group progress, personal
 * insight, the font-size control, and the du3a completion screen.
 *
 * Framework-free reactivity: Firestore realtime listeners write into `state` and
 * call `rerender()`, which rebuilds the app from `state`. Stateful controls (the
 * settings popout) are created once and reused so their DOM state survives a
 * rebuild.
 */
export function renderMember(root: HTMLElement): void {
  const memberId = getRememberedMemberId();
  if (memberId) startApp(root, memberId);
  else renderIdentityGate(root);
}

// -----------------------------------------------------------------------------
// Identity gate — pick your name once per device (REQUIREMENTS §4).
// -----------------------------------------------------------------------------

function renderIdentityGate(root: HTMLElement): void {
  const list = el('ul', { class: 'space-y-2' }, [mutedItem(strings.member.connecting)]);
  mount(root, shell([header(), card(strings.member.choosePrompt, [list])]));

  const unsubscribe = subscribeRoster(
    (people) => {
      if (people.length === 0) {
        mount(list, mutedItem(strings.member.emptyRoster));
        return;
      }
      mount(
        list,
        ...people.map((person) =>
          el('li', {}, [
            bigButton(person.name, () => {
              rememberMemberId(person.id);
              unsubscribe();
              startApp(root, person.id);
            }),
          ]),
        ),
      );
    },
    () => mount(list, dangerItem(strings.member.connectionError)),
  );
}

// -----------------------------------------------------------------------------
// App shell — live state + rerender loop.
// -----------------------------------------------------------------------------

interface MemberState {
  roster: Person[];
  khatmas: Khatma[];
  assignments: Map<string, Assignment[]>;
  content?: GlobalContent;
}

interface AppContext {
  settings: HTMLElement;
  rerender: () => void;
  onSwitch: () => void;
}

function startApp(root: HTMLElement, memberId: string): void {
  const state: MemberState = { roster: [], khatmas: [], assignments: new Map() };
  const assignmentSubs = new Map<string, () => void>();
  const topSubs: Array<() => void> = [];
  // Created once so the popout's open/slider state persists across rerenders.
  const settings = settingsControl();

  const cleanup = (): void => {
    topSubs.forEach((u) => u());
    assignmentSubs.forEach((u) => u());
    assignmentSubs.clear();
  };
  const onSwitch = (): void => {
    cleanup();
    forgetMember();
    renderMember(root);
  };
  const ctx: AppContext = { settings, rerender: () => rerender(), onSwitch };
  const rerender = (): void => mount(root, renderApp(state, memberId, ctx));

  rerender();
  topSubs.push(
    subscribeRoster((people) => {
      state.roster = people;
      rerender();
    }),
    subscribeGlobalContent((content) => {
      state.content = content;
      rerender();
    }),
    subscribeKhatmas((khatmas) => {
      state.khatmas = khatmas;
      reconcileAssignmentSubs(state, memberId, assignmentSubs, rerender);
      rerender();
    }),
  );
}

/** Subscribe to assignments for exactly the active khatmas this member is in. */
function reconcileAssignmentSubs(
  state: MemberState,
  memberId: string,
  subs: Map<string, () => void>,
  rerender: () => void,
): void {
  const activeIds = new Set(myActiveKhatmas(state, memberId).map((k) => k.id));
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
// Render.
// -----------------------------------------------------------------------------

function renderApp(state: MemberState, memberId: string, ctx: AppContext): HTMLElement {
  const me = state.roster.find((p) => p.id === memberId);
  const khatmas = myActiveKhatmas(state, memberId);

  // Completion: show the du3a for the first complete khatma not yet acknowledged.
  const pendingDu3a = khatmas.find(
    (k) => khatmaProgress(state.assignments.get(k.id) ?? []).complete && !du3aAcked(k.id),
  );
  if (pendingDu3a) {
    return du3aScreen(state.content?.du3aText ?? DEFAULT_DU3A_TEXT, () => {
      ackDu3a(pendingDu3a.id);
      ctx.rerender();
    });
  }

  const sections: Node[] = [memberHeader(me?.name ?? '', ctx.onSwitch)];
  if (khatmas.length === 0) {
    sections.push(card(strings.member.todayHeading, [mutedText(strings.member.noKhatmas)]));
  } else {
    sections.push(
      ...khatmas.map((k) => khatmaCard(k, state.assignments.get(k.id) ?? [], memberId, state.roster)),
    );
  }
  sections.push(insightsCard(me), ctx.settings);
  return shell(sections);
}

function khatmaCard(
  k: Khatma,
  assignments: Assignment[],
  memberId: string,
  roster: Person[],
): HTMLElement {
  const today = todayIso();
  const dayIndex = currentDayIndex(k.startDate, today);
  const within = isWithinKhatma(k.startDate, k.durationDays, today);
  const mine = assignments.find((a) => a.memberId === memberId);

  const body: Node[] = [statusLine(k, today, within, dayIndex)];

  if (within && mine) {
    const pages = mine.pagesByDay[dayIndex] ?? [];
    const done = isDayDone(mine, dayIndex);
    body.push(pagesRow(pages));
    body.push(done ? doneBanner() : finishedButton(k.id, memberId, dayIndex, pages.length > 0));
  }

  body.push(groupProgress(k, assignments, dayIndex, within, roster));
  return card(k.name ?? strings.common.appName, body);
}

function statusLine(k: Khatma, today: string, within: boolean, dayIndex: number): HTMLElement {
  if (!within) {
    const msg = dayIndex < 0 ? strings.member.notStarted : strings.member.ended;
    return el('p', { class: 'text-muted' }, [msg]);
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
  if (pages.length === 0) {
    return el('p', { class: 'text-muted' }, ['—']);
  }
  const word = pages.length === 1 ? strings.member.pageWord : strings.member.pagesWord;
  const label = `${toArabicDigits(pages.length)} ${word}`;
  return el('div', { class: 'my-3 space-y-2' }, [
    el('p', { class: 'font-semibold' }, [label]),
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

function finishedButton(
  khatmaId: string,
  memberId: string,
  dayIndex: number,
  enabled: boolean,
): HTMLElement {
  const button = bigButton(strings.member.finishedToday, () => {
    button.disabled = true;
    error.textContent = '';
    void markDayDone(khatmaId, memberId, dayIndex).catch(() => {
      button.disabled = false;
      error.textContent = strings.member.saveError;
    });
  });
  button.className = primaryButtonClass(enabled);
  button.disabled = !enabled;

  const error = el('p', { class: 'mt-2 text-center text-danger' }, []);
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
        children.push(
          el('p', { class: 'text-sm text-muted' }, [`⏳ ${pendingNames.join('، ')}`]),
        );
      }
    }
  }

  return el('div', { class: 'mt-4 space-y-1 border-t border-border pt-3' }, children);
}

function insightsCard(me: Person | undefined): HTMLElement {
  const count = me?.completedPages.length ?? 0;
  const percent = lifetimePercent(count);
  return card(strings.member.lifetimeLead, [
    el('p', { class: 'text-lg' }, [
      `${strings.member.lifetimeLead} ${toArabicDigits(count)} ${strings.member.lifetimeTail} (${toArabicDigits(percent)}٪)`,
    ]),
    progressBar(percent),
  ]);
}

function du3aScreen(du3aText: string, onAck: () => void): HTMLElement {
  return el(
    'div',
    { class: 'flex min-h-screen items-center justify-center bg-bg p-4' },
    [
      el('div', { class: 'max-w-xl space-y-6 text-center' }, [
        el('p', { class: 'text-2xl font-bold text-primary' }, [strings.member.khatmaComplete]),
        el('h2', { class: 'text-xl font-semibold' }, [strings.member.du3aHeading]),
        el('p', { class: 'quran-text' }, [du3aText]),
        bigButton(strings.common.done, onAck),
      ]),
    ],
  );
}

// -----------------------------------------------------------------------------
// Small shared building blocks.
// -----------------------------------------------------------------------------

function shell(children: Node[]): HTMLElement {
  return el('main', { class: 'mx-auto max-w-xl space-y-6 p-4' }, children);
}

function header(): HTMLElement {
  return el('header', { class: 'space-y-1 text-center' }, [
    el('h1', { class: 'text-3xl font-bold text-primary' }, [strings.member.title]),
    el('p', { class: 'text-muted' }, [strings.member.tagline]),
  ]);
}

function memberHeader(name: string, onSwitch: () => void): HTMLElement {
  return el('header', { class: 'flex items-center justify-between' }, [
    el('div', {}, [
      el('p', { class: 'text-muted' }, [strings.member.greeting]),
      el('h1', { class: 'text-2xl font-bold text-primary' }, [name]),
    ]),
    linkButton(strings.member.switchPerson, onSwitch),
  ]);
}

function card(title: string, children: Node[]): HTMLElement {
  return el('section', { class: 'rounded-card border border-border bg-surface p-4 shadow-sm' }, [
    el('h2', { class: 'mb-3 text-xl font-semibold' }, [title]),
    ...children,
  ]);
}

function progressBar(percent: number): HTMLElement {
  const fill = el('div', { class: 'h-2 rounded-button bg-primary' });
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  return el('div', { class: 'h-2 w-full overflow-hidden rounded-button bg-border' }, [fill]);
}

function bigButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el('button', { type: 'button', class: primaryButtonClass(true) }, [label]);
  button.addEventListener('click', onClick);
  return button;
}

function linkButton(label: string, onClick: () => void): HTMLElement {
  const button = el('button', { type: 'button', class: 'text-sm text-muted underline' }, [label]);
  button.addEventListener('click', onClick);
  return button;
}

function primaryButtonClass(enabled: boolean): string {
  return `w-full rounded-button bg-primary px-4 py-4 text-lg font-semibold text-white${
    enabled ? '' : ' opacity-50'
  }`;
}

function mutedItem(text: string): HTMLElement {
  return el('li', { class: 'text-muted' }, [text]);
}

function mutedText(text: string): HTMLElement {
  return el('p', { class: 'text-muted' }, [text]);
}

function dangerItem(text: string): HTMLElement {
  return el('li', { class: 'text-danger' }, [text]);
}

// -----------------------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------------------

function myActiveKhatmas(state: MemberState, memberId: string): Khatma[] {
  return state.khatmas.filter((k) => k.status === 'active' && k.memberIds.includes(memberId));
}

/** Today's local calendar date as YYYY-MM-DD (what the reader thinks of as "today"). */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function du3aAcked(khatmaId: string): boolean {
  return localStorage.getItem(`khatma.du3aAck.${khatmaId}`) === '1';
}

function ackDu3a(khatmaId: string): void {
  localStorage.setItem(`khatma.du3aAck.${khatmaId}`, '1');
}

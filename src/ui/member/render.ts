import { subscribeRoster } from '@/data/roster';
import { subscribeKhatmas } from '@/data/khatmas';
import { markRoundDone, subscribeAssignments } from '@/data/assignments';
import { subscribeGlobalContent } from '@/data/content';
import { isRoundDone, khatmaProgress, latestReadableChunk } from '@/domain/progress';
import type { Assignment, GlobalContent, Khatma, Person } from '@/domain/types';
import { DEFAULT_DU3A_TEXT, strings } from '@/content/strings.ar';
import { forgetMember, getRememberedMemberId, rememberMemberId } from '@/ui/shared/identity';
import { settingsControl } from '@/ui/shared/settings';
import { el, mount } from '@/ui/shared/dom';
import { currentRoute, hash, navigate, onRouteChange, type Route } from '@/ui/shared/router';
import { renderNav } from '@/ui/member/nav';
import { createReader, getLastReadPage, type ReaderHandle } from '@/ui/member/reader';
import { khatmaLandingView, khatmasListView } from '@/ui/member/pages/khatmas';
import { personalView } from '@/ui/member/pages/personal';
import { backLink, card, mutedText, primaryButton } from '@/ui/member/components';

/**
 * Member app (REQUIREMENTS §6). A mobile-web-app shell: a persistent bottom tab
 * bar (right-side rail on large screens) over a hash-routed content area, with
 * the daily khatma flow, the in-app reader, personal insight, and settings.
 *
 * Framework-free reactivity: Firestore realtime listeners + `hashchange` both
 * call `render()`, which rebuilds the nav and the content for the current route.
 * The reader is the exception — its instance is cached and reused across renders
 * so background data updates never tear it down or reset the reader's scroll.
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
  mount(root, gateShell([gateHeader(), card(strings.member.choosePrompt, [list])]));

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
            primaryButton(person.name, () => {
              rememberMemberId(person.id);
              unsubscribe();
              startApp(root, person.id);
            }),
          ]),
        ),
      );
    },
    () => mount(list, el('li', { class: 'text-danger' }, [strings.member.connectionError])),
  );
}

// -----------------------------------------------------------------------------
// App shell — persistent chrome + routed content + live state.
// -----------------------------------------------------------------------------

interface MemberState {
  roster: Person[];
  khatmas: Khatma[];
  assignments: Map<string, Assignment[]>;
  content?: GlobalContent;
}

function startApp(root: HTMLElement, memberId: string): void {
  const state: MemberState = { roster: [], khatmas: [], assignments: new Map() };
  const assignmentSubs = new Map<string, () => void>();
  const topSubs: Array<() => void> = [];
  // Created once so the settings popout's open/slider state persists across renders.
  const settings = settingsControl();

  // Persistent layout: a centered content column, and a nav host. The rail
  // reserves space on large screens via `lg:pr-24` (RTL: physical right).
  const content = el('main', {
    class: 'mx-auto w-full max-w-xl space-y-6 p-4 pb-28 md:max-w-2xl lg:max-w-3xl lg:pb-8',
  });
  const navHost = el('div', {});
  mount(root, el('div', { class: 'lg:pr-24' }, [content]), navHost);

  // Reader instance, kept alive while the route stays on the same reader.
  let reader: ReaderHandle | null = null;
  let readerKey: string | null = null;
  let mountedKey: string | null = null;

  const cleanup = (): void => {
    topSubs.forEach((u) => u());
    assignmentSubs.forEach((u) => u());
    assignmentSubs.clear();
  };

  let routeUnsub = (): void => undefined;
  const onSwitch = (): void => {
    cleanup();
    routeUnsub();
    forgetMember();
    renderMember(root);
  };

  const render = (): void => {
    const route = currentRoute();

    // Completion takes over the whole view (REQUIREMENTS §7): the designated
    // reciter sees the du3a; everyone else sees a note naming them. Nav hidden.
    const overlay = completionOverlay();
    if (overlay) {
      reader = null;
      readerKey = null;
      mountedKey = 'overlay';
      mount(navHost);
      mount(content, overlay);
      return;
    }

    mount(navHost, renderNav(route));
    renderRoute(route);
  };

  const renderRoute = (route: Route): void => {
    if (route.name === 'quran') return showBrowseReader(route.page);
    if (route.name === 'khatmaRead') return showAssignedReader(route.id);
    // Non-reader routes rebuild from live state each tick (cheap, data-driven).
    reader = null;
    readerKey = null;
    mountedKey = route.name;
    mount(content, viewForRoute(route));
  };

  const showBrowseReader = (page?: number): void => {
    const key = 'quran';
    if (readerKey !== key) {
      reader = createReader({
        mode: 'browse',
        startPage: page ?? getLastReadPage(),
        onPageChange: (p) => navigate(hash.quran(p)),
      });
      readerKey = key;
    }
    if (mountedKey !== key) {
      mount(content, reader!.el);
      mountedKey = key;
    }
    if (page) reader!.goToPage(page); // deep-link/back sync; no-op if already there
  };

  const showAssignedReader = (id: string): void => {
    const k = state.khatmas.find(
      (x) => x.id === id && x.status === 'active' && x.memberIds.includes(memberId),
    );
    const assignments = state.assignments.get(id);
    // Still loading, or not a khatma of mine → don't build a reader.
    if (!k || !assignments) {
      dropReader('await:' + id, loadingOrBack(id));
      return;
    }
    const me = state.roster.find((p) => p.id === memberId);
    const paused = me ? !me.enabled : false;
    const mine = assignments.find((a) => a.memberId === memberId);
    // The member reads their current round's chunk (revisiting it when done).
    const chunk = mine && !paused ? latestReadableChunk(mine) : undefined;
    if (!chunk || chunk.pages.length === 0) {
      dropReader('noread:' + id, noPagesView(id));
      return;
    }

    const key = `khatmaRead:${id}:${chunk.round}`;
    if (readerKey !== key) {
      reader = createReader({
        mode: 'assigned',
        pages: chunk.pages,
        done: mine ? isRoundDone(mine, chunk.round) : false,
        onFinish: () => markRoundDone(id, memberId, chunk.round),
      });
      readerKey = key;
    }
    if (mountedKey !== key) {
      mount(content, reader!.el);
      mountedKey = key;
    }
  };

  /** Tear down any reader and show a plain (rebuildable) view. */
  const dropReader = (key: string, view: Node): void => {
    reader = null;
    readerKey = null;
    mountedKey = key;
    mount(content, view);
  };

  const viewForRoute = (route: Route): HTMLElement => {
    switch (route.name) {
      case 'personal':
        return personalView({ me: state.roster.find((p) => p.id === memberId), onSwitch });
      case 'settings':
        return el('div', { class: 'space-y-4' }, [
          el('h1', { class: 'text-2xl font-bold text-primary' }, [strings.nav.settings]),
          settings,
        ]);
      case 'khatma': {
        const k = state.khatmas.find((x) => x.id === route.id && x.memberIds.includes(memberId));
        if (!k) return state.khatmas.length === 0 ? loadingCard() : notFoundView();
        const me = state.roster.find((p) => p.id === memberId);
        return khatmaLandingView({
          khatma: k,
          allKhatmas: state.khatmas,
          assignments: state.assignments.get(k.id) ?? [],
          roster: state.roster,
          memberId,
          paused: me ? !me.enabled : false,
        });
      }
      case 'khatmas':
      default:
        return khatmasListView({
          khatmas: myActiveKhatmas(state, memberId),
          assignmentsByKhatma: state.assignments,
          memberId,
        });
    }
  };

  const completionOverlay = (): HTMLElement | null => {
    const pending = myActiveKhatmas(state, memberId).find(
      (k) => khatmaProgress(k, state.assignments.get(k.id) ?? []).complete && !du3aAcked(k.id),
    );
    if (!pending) return null;
    const ack = (): void => {
      ackDu3a(pending.id);
      render();
    };
    const reciterId = pending.duaReciterId;
    if (!reciterId || reciterId === memberId) {
      return du3aScreen(state.content?.du3aText ?? DEFAULT_DU3A_TEXT, ack);
    }
    const reciterName = state.roster.find((p) => p.id === reciterId)?.name ?? '';
    return completionNoticeScreen(reciterName, ack);
  };

  const loadingOrBack = (id: string): HTMLElement =>
    state.khatmas.length === 0 ? loadingCard() : noPagesView(id);

  render();
  routeUnsub = onRouteChange(render);
  topSubs.push(
    subscribeRoster((people) => {
      state.roster = people;
      render();
    }),
    subscribeGlobalContent((c) => {
      state.content = c;
      render();
    }),
    subscribeKhatmas((khatmas) => {
      state.khatmas = khatmas;
      reconcileAssignmentSubs(state, memberId, assignmentSubs, render);
      render();
    }),
  );
}

/** Subscribe to assignments for exactly the active khatmas this member is in. */
function reconcileAssignmentSubs(
  state: MemberState,
  memberId: string,
  subs: Map<string, () => void>,
  render: () => void,
): void {
  const activeIds = new Set(myActiveKhatmas(state, memberId).map((k) => k.id));
  for (const id of activeIds) {
    if (subs.has(id)) continue;
    subs.set(
      id,
      subscribeAssignments(id, (assignments) => {
        state.assignments.set(id, assignments);
        render();
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
// Completion screens (REQUIREMENTS §7).
// -----------------------------------------------------------------------------

function du3aScreen(du3aText: string, onAck: () => void): HTMLElement {
  return centered([
    el('p', { class: 'text-2xl font-bold text-primary' }, [strings.member.khatmaComplete]),
    el('h2', { class: 'text-xl font-semibold' }, [strings.member.du3aHeading]),
    el('p', { class: 'quran-text' }, [du3aText]),
    primaryButton(strings.common.done, onAck),
  ]);
}

function completionNoticeScreen(reciterName: string, onAck: () => void): HTMLElement {
  return centered([
    el('p', { class: 'text-2xl font-bold text-primary' }, [strings.member.khatmaComplete]),
    el('p', { class: 'text-lg' }, [
      `${strings.member.reciterLead}: `,
      el('span', { class: 'font-semibold' }, [reciterName]),
    ]),
    primaryButton(strings.common.done, onAck),
  ]);
}

// -----------------------------------------------------------------------------
// Small shared building blocks.
// -----------------------------------------------------------------------------

function centered(children: Node[]): HTMLElement {
  return el('div', { class: 'flex min-h-[70vh] items-center justify-center p-4' }, [
    el('div', { class: 'mx-auto max-w-xl space-y-6 text-center' }, children),
  ]);
}

function gateShell(children: Node[]): HTMLElement {
  return el('main', { class: 'mx-auto max-w-xl space-y-6 p-4' }, children);
}

function gateHeader(): HTMLElement {
  return el('header', { class: 'space-y-1 text-center' }, [
    el('h1', { class: 'text-3xl font-bold text-primary' }, [strings.member.title]),
    el('p', { class: 'text-muted' }, [strings.member.tagline]),
  ]);
}

function loadingCard(): HTMLElement {
  return card('', [mutedText(strings.common.loading)]);
}

function notFoundView(): HTMLElement {
  return el('div', { class: 'space-y-4' }, [
    backLink(strings.member.khatmasHeading, hash.khatmas()),
    card('', [mutedText(strings.member.noKhatmas)]),
  ]);
}

function noPagesView(id: string): HTMLElement {
  return el('div', { class: 'space-y-4' }, [
    backLink(strings.member.back, hash.khatma(id)),
    card('', [mutedText(strings.reader.noPagesToday)]),
  ]);
}

function mutedItem(text: string): HTMLElement {
  return el('li', { class: 'text-muted' }, [text]);
}

// -----------------------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------------------

function myActiveKhatmas(state: MemberState, memberId: string): Khatma[] {
  return state.khatmas.filter((k) => k.status === 'active' && k.memberIds.includes(memberId));
}

function du3aAcked(khatmaId: string): boolean {
  return localStorage.getItem(`khatma.du3aAck.${khatmaId}`) === '1';
}

function ackDu3a(khatmaId: string): void {
  localStorage.setItem(`khatma.du3aAck.${khatmaId}`, '1');
}

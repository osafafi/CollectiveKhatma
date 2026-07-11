/**
 * Admin app shell (REQUIREMENTS §8). Framework-free reactive loop like the
 * member app: Firestore realtime listeners write into `state` and call
 * `rerender()`, which rebuilds the tab bar + the page for the current hash
 * route. Form fields live in a persistent `draft` so their values survive
 * rerenders. Pages: Home (metrics + distribute), Roster, Khatmas (list +
 * per-khatma management), Settings.
 */
import { subscribeRoster } from '@/data/roster';
import { subscribeKhatmas } from '@/data/khatmas';
import { subscribeAssignments } from '@/data/assignments';
import { subscribeGlobalContent } from '@/data/content';
import type { Khatma } from '@/domain/types';
import { getQuranIndex, getSurahs } from '@/content/quran/loader';
import { buildPageUnitMaps } from '@/domain/assignment';
import { strings } from '@/content/strings.ar';
import { settingsControl } from '@/ui/shared/settings';
import { el, mount } from '@/ui/shared/dom';
import { createRouter } from '@/ui/shared/router';
import { initialDraft, type AdminCtx, type AdminState } from '@/ui/admin/ctx';
import { renderAdminNav } from '@/ui/admin/nav';
import { parseAdminRoute, type AdminRoute } from '@/ui/admin/routes';
import { homePage } from '@/ui/admin/pages/home';
import { rosterPage } from '@/ui/admin/pages/roster';
import { khatmasPage } from '@/ui/admin/pages/khatmas';
import { khatmaPage } from '@/ui/admin/pages/khatma';
import { settingsPage } from '@/ui/admin/pages/settings';

const router = createRouter(parseAdminRoute);

export function renderAdmin(root: HTMLElement): void {
  const state: AdminState = { roster: [], khatmas: [], assignments: new Map() };
  const draft = initialDraft();
  const settings = settingsControl();
  const assignmentSubs = new Map<string, () => void>();

  // Persistent layout mirroring the member app: content column + tab bar
  // (bottom bar on phones, right rail on large screens — RTL).
  const content = el('main', {
    class: 'mx-auto w-full max-w-2xl space-y-6 p-4 pb-28 lg:max-w-4xl lg:pb-8',
  });
  const navHost = el('div', {});
  mount(root, el('div', { class: 'lg:pr-24' }, [content]), navHost);

  const ctx: AdminCtx = { state, draft, rerender: () => rerender() };
  const rerender = (): void => {
    const route = router.current();
    reconcileAssignmentSubs(state, route, assignmentSubs, rerender);
    mount(navHost, renderAdminNav(route));
    mount(content, header(), pageFor(ctx, route, settings));
  };

  rerender();
  router.onChange(rerender);

  // Surah/juz data: page-spans for scope resolution, names for the picker, and
  // page→unit maps for whole-surah / whole-juz capacities.
  void Promise.all([getQuranIndex(), getSurahs()])
    .then(([index, surahs]) => {
      state.surahToPages = index.surahToPages;
      state.surahs = surahs;
      state.pageUnitMaps = buildPageUnitMaps(index.surahToPages, index.juzToPages);
      rerender();
    })
    .catch(() => undefined);

  subscribeRoster((people) => {
    state.roster = people;
    rerender();
  });
  subscribeGlobalContent((content2) => {
    state.content = content2;
    if (!draft.du3aTouched) draft.du3aText = content2?.du3aText ?? '';
    rerender();
  });
  subscribeKhatmas((khatmas) => {
    state.khatmas = khatmas;
    rerender();
  });
}

function pageFor(ctx: AdminCtx, route: AdminRoute, settings: HTMLElement): HTMLElement {
  switch (route.name) {
    case 'roster':
      return rosterPage(ctx);
    case 'khatmas':
      return khatmasPage(ctx);
    case 'khatma':
      return khatmaPage(ctx, route.id);
    case 'settings':
      return settingsPage(ctx, settings);
    case 'home':
    default:
      return homePage(ctx);
  }
}

function header(): HTMLElement {
  return el('header', { class: 'text-center' }, [
    el('h1', { class: 'text-xl font-bold text-primary' }, [strings.admin.heading]),
  ]);
}

/**
 * Subscribe to assignments for every ACTIVE khatma (Home/Khatmas need them)
 * plus the khatma currently open on a per-khatma page (it may be completed).
 */
function reconcileAssignmentSubs(
  state: AdminState,
  route: AdminRoute,
  subs: Map<string, () => void>,
  rerender: () => void,
): void {
  const wanted = new Set(
    state.khatmas.filter((k: Khatma) => k.status === 'active').map((k) => k.id),
  );
  if (route.name === 'khatma' && state.khatmas.some((k) => k.id === route.id)) {
    wanted.add(route.id);
  }
  for (const id of wanted) {
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
    if (wanted.has(id)) continue;
    subs.get(id)?.();
    subs.delete(id);
    state.assignments.delete(id);
  }
}

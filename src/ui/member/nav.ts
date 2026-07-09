/**
 * Primary navigation chrome for the member app: a bottom tab bar on phones that
 * promotes to a right-side vertical rail on large screens (RTL). Built from a
 * data-driven tab list so tabs can be added later without touching layout code.
 *
 * Tabs are plain hash `<a>` links — native, keyboard-accessible, and they drive
 * the router for free (a hash change re-renders the app).
 */
import { icon, type IconName } from '@/ui/shared/icons';
import { hash, type Route } from '@/ui/shared/router';
import { strings } from '@/content/strings.ar';
import { el } from '@/ui/shared/dom';

interface Tab {
  iconName: IconName;
  label: string;
  href: string;
  /** Whether this tab owns the given route (a tab can own nested routes). */
  isActive: (route: Route) => boolean;
}

const TABS: Tab[] = [
  {
    iconName: 'khatmas',
    label: strings.nav.khatmas,
    href: hash.khatmas(),
    isActive: (r) => r.name === 'khatmas' || r.name === 'khatma' || r.name === 'khatmaRead',
  },
  {
    iconName: 'quran',
    label: strings.nav.quran,
    href: hash.quran(),
    isActive: (r) => r.name === 'quran',
  },
  {
    iconName: 'personal',
    label: strings.nav.personal,
    href: hash.personal(),
    isActive: (r) => r.name === 'personal',
  },
  {
    iconName: 'settings',
    label: strings.nav.settings,
    href: hash.settings(),
    isActive: (r) => r.name === 'settings',
  },
];

/** Build the nav chrome for the current route (cheap; rebuilt on route change). */
export function renderNav(route: Route): HTMLElement {
  return el(
    'nav',
    {
      'aria-label': strings.common.appName,
      class:
        'tab-bar fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface ' +
        'lg:inset-x-auto lg:top-0 lg:right-0 lg:h-full lg:w-24 lg:border-t-0 lg:border-l',
    },
    [
      el(
        'ul',
        {
          class:
            'mx-auto flex max-w-xl items-stretch justify-around ' +
            'lg:h-full lg:max-w-none lg:flex-col lg:justify-start lg:gap-1 lg:pt-6',
        },
        TABS.map((tab) => tabItem(tab, tab.isActive(route))),
      ),
    ],
  );
}

function tabItem(tab: Tab, active: boolean): HTMLElement {
  const color = active ? 'text-primary' : 'text-muted';
  const link = el(
    'a',
    {
      href: tab.href,
      ...(active ? { 'aria-current': 'page' } : {}),
      class: `flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-semibold ${color}`,
    },
    [icon(tab.iconName), el('span', {}, [tab.label])],
  );
  return el('li', { class: 'flex-1 lg:flex-none' }, [link]);
}

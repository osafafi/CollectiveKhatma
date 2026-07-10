/**
 * Member app tab list, rendered by the shared tab bar
 * (`src/ui/shared/nav.ts`). Data-driven so tabs can be added later without
 * touching layout code.
 */
import { renderTabBar, type Tab } from '@/ui/shared/nav';
import { hash, type Route } from '@/ui/shared/router';
import { strings } from '@/content/strings.ar';

const TABS: Array<Tab<Route>> = [
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

/** Build the member nav chrome for the current route. */
export function renderNav(route: Route): HTMLElement {
  return renderTabBar(TABS, route, strings.common.appName);
}

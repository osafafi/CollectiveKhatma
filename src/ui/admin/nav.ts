/**
 * Admin app tab list (REQUIREMENTS §8): Home / Roster / Khatmas / Settings,
 * rendered by the shared tab bar (`src/ui/shared/nav.ts`).
 */
import { renderTabBar, type Tab } from '@/ui/shared/nav';
import { adminHash, type AdminRoute } from '@/ui/admin/routes';
import { strings } from '@/content/strings.ar';

const TABS: Array<Tab<AdminRoute>> = [
  {
    iconName: 'home',
    label: strings.admin.navHome,
    href: adminHash.home(),
    isActive: (r) => r.name === 'home',
  },
  {
    iconName: 'personal',
    label: strings.admin.navRoster,
    href: adminHash.roster(),
    isActive: (r) => r.name === 'roster',
  },
  {
    iconName: 'khatmas',
    label: strings.admin.navKhatmas,
    href: adminHash.khatmas(),
    isActive: (r) => r.name === 'khatmas' || r.name === 'khatma',
  },
  {
    iconName: 'settings',
    label: strings.admin.navSettings,
    href: adminHash.settings(),
    isActive: (r) => r.name === 'settings',
  },
];

/** Build the admin nav chrome for the current route. */
export function renderAdminNav(route: AdminRoute): HTMLElement {
  return renderTabBar(TABS, route, strings.admin.heading);
}

import type { ReactNode } from 'react';
import { AppShell, HeroHeader, type ShellTab } from '@/components/navigation';
import { adminRoutePath, type AdminRoute } from '@/app/routing/routes';
import { useAdminRoute } from '@/app/routing/hooks';
import { selectKhatmaById, useAppSelector } from '@/app/store';
import { strings } from '@/content/strings.ar';
import { isWird } from '@/domain/wird';
import { AdminFeedbackInbox } from './AdminFeedbackInbox';

/**
 * Admin tab list (REQUIREMENTS §8: Home / Roster / Khatmas / Settings). The
 * khatmas tab owns the khatma detail sub-route.
 */
const ADMIN_TABS: ReadonlyArray<ShellTab<AdminRoute>> = [
  {
    iconName: 'home',
    label: strings.admin.navHome,
    to: { name: 'home' },
    isActive: (r) => r.name === 'home',
  },
  {
    iconName: 'personal',
    label: strings.admin.navRoster,
    to: { name: 'roster' },
    isActive: (r) => r.name === 'roster',
  },
  {
    iconName: 'khatmas',
    label: strings.admin.navKhatmas,
    to: { name: 'khatmas' },
    isActive: (r) => r.name === 'khatmas' || r.name === 'khatma',
  },
  {
    iconName: 'settings',
    label: strings.admin.navSettings,
    to: { name: 'settings' },
    isActive: (r) => r.name === 'settings',
  },
];

/** Legacy content column: `max-w-2xl lg:max-w-4xl` (672/896). */
const ADMIN_CONTENT_MAX_WIDTH = { xs: 672, lg: 896 };

/** Responsive admin shell: frames route content with the admin navigation. */
export function AdminShell({ children }: { children: ReactNode }) {
  const route = useAdminRoute();
  const wirdDetail = useAppSelector((state) => {
    if (route.name !== 'khatma') return false;
    const series = selectKhatmaById(state, route.id);
    return series ? isWird(series) : false;
  });
  return (
    <AppShell
      tabs={ADMIN_TABS}
      route={route}
      toPath={adminRoutePath}
      navLabel={strings.admin.heading}
      contentMaxWidth={ADMIN_CONTENT_MAX_WIDTH}
    >
      {/*
        Shell-owned hero (mock 5a): the admin eyebrow + the route title as the
        page h1 (routes dropped their own heading Typography). The khatma
        detail keeps its series-name h1 inside the page, so its hero title
        stays a plain div. The feedback bell + listener stay mounted HERE so
        navigation never restarts the subscription (retention contract).
      */}
      <HeroHeader
        eyebrow={strings.admin.heading}
        title={wirdDetail ? strings.admin.wirdDetailTitle : adminRouteTitle(route)}
        titleComponent={route.name === 'khatma' ? 'div' : 'h1'}
        action={<AdminFeedbackInbox />}
        sx={{ mb: 4 }}
      />
      {children}
    </AppShell>
  );
}

function adminRouteTitle(route: AdminRoute): string {
  switch (route.name) {
    case 'home':
      return strings.admin.homeHeading;
    case 'roster':
      return strings.admin.rosterHeading;
    case 'khatmas':
      return strings.admin.khatmasHeading;
    case 'khatma':
      return strings.admin.khatmaDetailTitle;
    default:
      return strings.admin.navSettings;
  }
}

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { AppShell, type ShellTab } from '@/components/navigation';
import { adminRoutePath, type AdminRoute } from '@/app/routing/routes';
import { useAdminRoute } from '@/app/routing/hooks';
import { strings } from '@/content/strings.ar';

/**
 * Admin tab list (REQUIREMENTS §8: Home / Roster / Khatmas / Settings) — the
 * React twin of the legacy [`src/ui/admin/nav.ts`](../../ui/admin/nav.ts). The
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
  return (
    <AppShell
      tabs={ADMIN_TABS}
      route={route}
      toPath={adminRoutePath}
      navLabel={strings.admin.heading}
      contentMaxWidth={ADMIN_CONTENT_MAX_WIDTH}
    >
      <AdminHeader />
      {children}
    </AppShell>
  );
}

/**
 * The persistent admin title shown on every admin page (inventory §3), mirroring
 * the legacy `header()` in [`src/ui/admin/render.ts`](../../ui/admin/render.ts).
 * Rendered as a non-heading label so each route keeps a single `h1` (its own page
 * heading) rather than duplicating the legacy's two-`h1` structure.
 */
function AdminHeader() {
  return (
    <Box component="header" sx={{ textAlign: 'center', mb: 4 }}>
      <Typography color="primary.main" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
        {strings.admin.heading}
      </Typography>
    </Box>
  );
}

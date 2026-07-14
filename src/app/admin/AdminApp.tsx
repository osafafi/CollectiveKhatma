import { Stack, Typography } from '@mui/material';
import { AppProviders } from '@/app/providers/AppProviders';
import { AdminAssignmentsSubscriptions } from '@/app/admin/AdminAssignmentsSubscriptions';
import { AdminShell } from '@/app/admin/AdminShell';
import { AdminHomePage } from '@/app/admin/pages/HomePage';
import { SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { useAdminRoute } from '@/app/routing/hooks';
import type { AdminRoute } from '@/app/routing/routes';

/** Admin React entry: the shared provider stack around the admin experience. */
export function AdminApp() {
  return (
    <AppProviders>
      <AdminExperience />
    </AppProviders>
  );
}

/**
 * The persistent admin experience: the route-aware assignment subscriptions
 * (active ∪ open detail, P9) live alongside the shell so navigation never
 * restarts them, and the shell frames whichever route content is active.
 */
export function AdminExperience() {
  return (
    <>
      <AdminAssignmentsSubscriptions />
      <AdminShell>
        <AdminRouteContent />
      </AdminShell>
    </>
  );
}

function AdminRouteContent() {
  const route = useAdminRoute();
  if (route.name === 'home') return <AdminHomePage />;
  // Roster (RM-510), Khatmas list/create (RM-520), Khatma detail (RM-530), and
  // Settings (RM-540) land in later Phase 5 tasks; the shell stays navigable and
  // the tabs resolve to a clear placeholder until each page is migrated.
  return <AdminRoutePlaceholder route={route} />;
}

const PENDING_ROUTE_HEADING: Record<Exclude<AdminRoute['name'], 'home'>, string> = {
  roster: strings.admin.rosterHeading,
  khatmas: strings.admin.khatmasHeading,
  khatma: strings.admin.khatmasHeading,
  settings: strings.admin.navSettings,
};

function AdminRoutePlaceholder({ route }: { route: Exclude<AdminRoute, { name: 'home' }> }) {
  return (
    <Stack
      component="section"
      spacing={4}
      data-react-surface="admin"
      data-route={route.name}
    >
      <Typography component="h1" variant="h2" color="primary.main">
        {PENDING_ROUTE_HEADING[route.name]}
      </Typography>
      <SurfaceCard>
        <Typography color="text.secondary" role="status">
          {strings.preview.notProduction}
        </Typography>
      </SurfaceCard>
    </Stack>
  );
}

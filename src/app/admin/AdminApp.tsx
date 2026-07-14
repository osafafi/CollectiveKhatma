import { Stack, Typography } from '@mui/material';
import { AppProviders } from '@/app/providers/AppProviders';
import { AdminAssignmentsSubscriptions } from '@/app/admin/AdminAssignmentsSubscriptions';
import { AdminShell } from '@/app/admin/AdminShell';
import { CreateKhatmaPrefillProvider } from '@/app/admin/CreateKhatmaPrefill';
import { AdminHomePage } from '@/app/admin/pages/HomePage';
import { AdminRosterPage } from '@/app/admin/pages/RosterPage';
import { AdminKhatmasPage } from '@/app/admin/pages/KhatmasPage';
import { AdminKhatmaPage } from '@/app/admin/pages/KhatmaPage';
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
    <CreateKhatmaPrefillProvider>
      <AdminAssignmentsSubscriptions />
      <AdminShell>
        <AdminRouteContent />
      </AdminShell>
    </CreateKhatmaPrefillProvider>
  );
}

function AdminRouteContent() {
  const route = useAdminRoute();
  if (route.name === 'home') return <AdminHomePage />;
  if (route.name === 'roster') return <AdminRosterPage />;
  if (route.name === 'khatmas') return <AdminKhatmasPage />;
  if (route.name === 'khatma') return <AdminKhatmaPage id={route.id} />;
  // Settings (RM-540) lands in a later Phase 5 task; the shell stays navigable and
  // that tab resolves to a clear placeholder until the page is migrated.
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

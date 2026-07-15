import { useState } from 'react';
import { AppProviders } from '@/app/providers/AppProviders';
import { useReadingScale } from '@/app/persistence';
import { AdminAssignmentsSubscriptions } from '@/app/admin/AdminAssignmentsSubscriptions';
import { AdminShell } from '@/app/admin/AdminShell';
import { CreateKhatmaPrefillProvider } from '@/app/admin/CreateKhatmaPrefill';
import { AdminHomePage } from '@/app/admin/pages/HomePage';
import { AdminRosterPage } from '@/app/admin/pages/RosterPage';
import { AdminKhatmasPage } from '@/app/admin/pages/KhatmasPage';
import { AdminKhatmaPage } from '@/app/admin/pages/KhatmaPage';
import { AdminSettingsPage } from '@/app/admin/pages/SettingsPage';
import { useAdminRoute } from '@/app/routing/hooks';

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
  // Lifted here (like the member app) so the reading-scale disclosure state and
  // the applied scale persist across route navigation without remounting.
  const [readingScale, setReadingScale] = useReadingScale();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (route.name === 'home') return <AdminHomePage />;
  if (route.name === 'roster') return <AdminRosterPage />;
  if (route.name === 'khatmas') return <AdminKhatmasPage />;
  if (route.name === 'khatma') return <AdminKhatmaPage id={route.id} />;
  // Every admin route is migrated; `settings` is the remaining case.
  return (
    <AdminSettingsPage
      readingScale={readingScale}
      onReadingScaleChange={setReadingScale}
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
    />
  );
}

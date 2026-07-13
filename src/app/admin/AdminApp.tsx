import { strings } from '@/content/strings.ar';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';
import { useAdminRoute } from '@/app/routing/hooks';

export function AdminApp() {
  return (
    <AppProviders>
      <AdminPreview />
    </AppProviders>
  );
}

function AdminPreview() {
  const route = useAdminRoute();

  return (
    <>
      <PreviewShell
        surface="admin"
        routeName={route.name}
        heading={strings.preview.adminHeading}
        description={strings.admin.heading}
      />
      <ThemeProbe />
    </>
  );
}

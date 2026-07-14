import { strings } from '@/content/strings.ar';
import { ChartsPreview } from '@/app/ChartsPreview';
import { PrimitivesPreview } from '@/app/PrimitivesPreview';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { AdminShell } from '@/app/admin/AdminShell';
import { useAdminRoute } from '@/app/routing/hooks';

export function AdminApp() {
  return (
    <AppProviders>
      <AdminShell>
        <AdminPreview />
      </AdminShell>
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
      <PrimitivesPreview />
      <ChartsPreview />
    </>
  );
}

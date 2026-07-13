import { strings } from '@/content/strings.ar';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import { useAdminRoute } from '@/app/routing/hooks';

export function AdminApp() {
  return (
    <AppThemeProvider>
      <AppHashRouter>
        <AdminPreview />
      </AppHashRouter>
    </AppThemeProvider>
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

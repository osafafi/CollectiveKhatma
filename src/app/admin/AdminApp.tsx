import { strings } from '@/content/strings.ar';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';

export function AdminApp() {
  return (
    <AppThemeProvider>
      <PreviewShell
        surface="admin"
        heading={strings.preview.adminHeading}
        description={strings.admin.heading}
      />
      <ThemeProbe />
    </AppThemeProvider>
  );
}

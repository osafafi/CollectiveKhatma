import { strings } from '@/content/strings.ar';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';

export function MemberApp() {
  return (
    <AppThemeProvider>
      <PreviewShell
        surface="member"
        heading={strings.preview.memberHeading}
        description={strings.member.tagline}
      />
      <ThemeProbe />
    </AppThemeProvider>
  );
}

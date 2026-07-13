import { strings } from '@/content/strings.ar';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';
import { AppHashRouter } from '@/app/routing/AppHashRouter';
import { useMemberRoute } from '@/app/routing/hooks';

export function MemberApp() {
  return (
    <AppThemeProvider>
      <AppHashRouter>
        <MemberPreview />
      </AppHashRouter>
    </AppThemeProvider>
  );
}

function MemberPreview() {
  const route = useMemberRoute();

  return (
    <>
      <PreviewShell
        surface="member"
        routeName={route.name}
        heading={strings.preview.memberHeading}
        description={strings.member.tagline}
      />
      <ThemeProbe />
    </>
  );
}

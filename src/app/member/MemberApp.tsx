import { strings } from '@/content/strings.ar';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { ThemeProbe } from '@/app/ThemeProbe';
import { useMemberRoute } from '@/app/routing/hooks';

export function MemberApp() {
  return (
    <AppProviders>
      <MemberPreview />
    </AppProviders>
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

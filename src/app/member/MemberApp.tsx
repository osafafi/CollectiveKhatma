import { strings } from '@/content/strings.ar';
import { ChartsPreview } from '@/app/ChartsPreview';
import { PrimitivesPreview } from '@/app/PrimitivesPreview';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberIdentitySummary } from '@/app/member/MemberIdentitySummary';
import { MemberShell } from '@/app/member/MemberShell';
import { useMemberRoute } from '@/app/routing/hooks';

export function MemberApp() {
  return (
    <AppProviders>
      <MemberIdentityBoundary>
        <MemberShell>
          <MemberPreview />
        </MemberShell>
      </MemberIdentityBoundary>
    </AppProviders>
  );
}

function MemberPreview() {
  const route = useMemberRoute();

  if (route.name === 'personal') return <MemberIdentitySummary />;

  return (
    <>
      <PreviewShell
        surface="member"
        routeName={route.name}
        heading={strings.preview.memberHeading}
        description={strings.member.tagline}
      />
      <PrimitivesPreview />
      <ChartsPreview />
    </>
  );
}

import { strings } from '@/content/strings.ar';
import { ChartsPreview } from '@/app/ChartsPreview';
import { PrimitivesPreview } from '@/app/PrimitivesPreview';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberIdentitySummary } from '@/app/member/MemberIdentitySummary';
import { MemberShell } from '@/app/member/MemberShell';
import { useMemberRoute } from '@/app/routing/hooks';
import { KhatmaLandingPage } from './KhatmaLandingPage';
import { KhatmasListPage } from './KhatmasListPage';
import { MemberAssignmentsSubscriptions } from './MemberAssignmentsSubscriptions';

export function MemberApp() {
  return (
    <AppProviders>
      <MemberIdentityBoundary>
        <MemberExperience />
      </MemberIdentityBoundary>
    </AppProviders>
  );
}

export function MemberExperience() {
  return (
    <>
      <MemberAssignmentsSubscriptions />
      <MemberShell>
        <MemberRouteContent />
      </MemberShell>
    </>
  );
}

export function MemberRouteContent() {
  const route = useMemberRoute();

  if (route.name === 'khatmas') return <KhatmasListPage />;
  if (route.name === 'khatma') return <KhatmaLandingPage khatmaId={route.id} />;
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

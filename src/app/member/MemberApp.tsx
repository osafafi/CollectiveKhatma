import { useState } from 'react';
import { strings } from '@/content/strings.ar';
import { ChartsPreview } from '@/app/ChartsPreview';
import { PrimitivesPreview } from '@/app/PrimitivesPreview';
import { AppProviders } from '@/app/providers/AppProviders';
import { PreviewShell } from '@/app/PreviewShell';
import { useReadingScale } from '@/app/persistence';
import { MemberCompletionInterrupt } from '@/app/member/MemberCompletionInterrupt';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberShell } from '@/app/member/MemberShell';
import { useMemberRoute } from '@/app/routing/hooks';
import { KhatmaLandingPage } from './KhatmaLandingPage';
import { KhatmasListPage } from './KhatmasListPage';
import { MemberAssignmentsSubscriptions } from './MemberAssignmentsSubscriptions';
import { PersonalPage } from './PersonalPage';
import { SettingsPage } from './SettingsPage';

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
      <MemberCompletionInterrupt>
        <MemberShell>
          <MemberRouteContent />
        </MemberShell>
      </MemberCompletionInterrupt>
    </>
  );
}

export function MemberRouteContent() {
  const route = useMemberRoute();
  const [readingScale, setReadingScale] = useReadingScale();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (route.name === 'khatmas') return <KhatmasListPage />;
  if (route.name === 'khatma') return <KhatmaLandingPage khatmaId={route.id} />;
  if (route.name === 'personal') return <PersonalPage />;
  if (route.name === 'settings') {
    return (
      <SettingsPage
        readingScale={readingScale}
        onReadingScaleChange={setReadingScale}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    );
  }

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

import { lazy, Suspense, useState } from 'react';
import { AppProviders } from '@/app/providers/AppProviders';
import { useReadingScale } from '@/app/persistence';
import { MemberCompletionInterrupt } from '@/app/member/MemberCompletionInterrupt';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberShell } from '@/app/member/MemberShell';
import { useMemberRoute } from '@/app/routing/hooks';
import { KhatmaLandingPage } from './KhatmaLandingPage';
import { KhatmasListPage } from './KhatmasListPage';
import { MemberAssignmentsSubscriptions } from './MemberAssignmentsSubscriptions';
import { PersonalPage } from './PersonalPage';
import { AssignedReaderPage, BrowseReaderPage } from './reader';

const SettingsPage = lazy(() =>
  import('./SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (route.name === 'khatmas') return <KhatmasListPage />;
  if (route.name === 'khatma') return <KhatmaLandingPage khatmaId={route.id} />;
  if (route.name === 'khatmaRead') return <AssignedReaderPage khatmaId={route.id} />;
  if (route.name === 'quran') return <BrowseReaderPage page={route.page} />;
  if (route.name === 'personal') return <PersonalPage />;
  if (route.name === 'settings') {
    return (
      <Suspense fallback={null}>
        <SettingsPage
          readingScale={readingScale}
          onReadingScaleChange={setReadingScale}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          feedbackOpen={feedbackOpen}
          onFeedbackOpenChange={setFeedbackOpen}
        />
      </Suspense>
    );
  }

  // Every member route is migrated; fall back to the default landing route.
  return <KhatmasListPage />;
}

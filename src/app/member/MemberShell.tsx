import type { ReactNode } from 'react';
import { AppShell, type ShellTab } from '@/components/navigation';
import { memberRoutePath, type MemberRoute } from '@/app/routing/routes';
import { useMemberRoute } from '@/app/routing/hooks';
import { strings } from '@/content/strings.ar';

/**
 * Member tab list — the React twin of the legacy [`src/ui/member/nav.ts`](../../ui/member/nav.ts).
 * The khatmas tab owns the khatma landing and reader sub-routes.
 */
const MEMBER_TABS: ReadonlyArray<ShellTab<MemberRoute>> = [
  {
    iconName: 'khatmas',
    label: strings.nav.khatmas,
    to: { name: 'khatmas' },
    isActive: (r) =>
      r.name === 'khatmas' || r.name === 'khatma' || r.name === 'khatmaRead',
  },
  {
    iconName: 'quran',
    label: strings.nav.quran,
    to: { name: 'quran' },
    isActive: (r) => r.name === 'quran',
  },
  {
    iconName: 'personal',
    label: strings.nav.personal,
    to: { name: 'personal' },
    isActive: (r) => r.name === 'personal',
  },
  {
    iconName: 'settings',
    label: strings.nav.settings,
    to: { name: 'settings' },
    isActive: (r) => r.name === 'settings',
  },
];

/** Legacy content column: `max-w-xl md:max-w-2xl lg:max-w-3xl` (576/672/768). */
const MEMBER_CONTENT_MAX_WIDTH = { xs: 576, md: 672, lg: 768 };

/** Responsive member shell: frames route content with the member navigation. */
export function MemberShell({ children }: { children: ReactNode }) {
  const route = useMemberRoute();
  return (
    <AppShell
      tabs={MEMBER_TABS}
      route={route}
      toPath={memberRoutePath}
      navLabel={strings.common.appName}
      contentMaxWidth={MEMBER_CONTENT_MAX_WIDTH}
    >
      {children}
    </AppShell>
  );
}

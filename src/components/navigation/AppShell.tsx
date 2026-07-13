import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import type { Breakpoint } from '@mui/material/styles';
import type { ShellTab } from './types';
import { AppNav } from './AppNav';

/**
 * Responsive application shell (RM-310): a centered content column plus the
 * bottom-bar/right-rail {@link AppNav}. Mirrors the legacy layout in
 * [`src/ui/member/render.ts`](../../ui/member/render.ts) /
 * [`admin/render.ts`](../../ui/admin/render.ts): an outer wrapper reserves the
 * desktop rail (`lg:pr-24`) and an inner `<main>` centers the content with the
 * per-surface max-widths, page padding, and bottom-bar clearance (`pb-28`,
 * `lg:pb-8`).
 *
 * The shell is pure chrome — it frames whatever `children` a route renders and
 * never reaches into feature state (Phases 4–5 own route content). Generic over
 * the app's typed route union.
 */
interface AppShellProps<R> {
  readonly tabs: ReadonlyArray<ShellTab<R>>;
  readonly route: R;
  readonly toPath: (route: R) => string;
  readonly navLabel: string;
  /** Centered content column max-widths in px, keyed by breakpoint. */
  readonly contentMaxWidth: Partial<Record<Breakpoint, number>>;
  readonly children: ReactNode;
}

export function AppShell<R>({
  tabs,
  route,
  toPath,
  navLabel,
  contentMaxWidth,
  children,
}: AppShellProps<R>) {
  return (
    <>
      {/*
        Reserve the 96px desktop rail on the physical right (RTL inline-start);
        no effect on mobile, where the nav is a bottom bar. Kept on its own
        wrapper (like the legacy `lg:pr-24` div) so it never collides with the
        column's own horizontal padding.
      */}
      <Box sx={{ paddingInlineStart: { lg: '96px' } }}>
        <Box
          component="main"
          sx={{
            mx: 'auto',
            width: '100%',
            maxWidth: contentMaxWidth,
            px: 4,
            pt: 4,
            // Clear the fixed bottom bar on mobile; relax once it becomes a rail.
            pb: { xs: 28, lg: 8 },
          }}
        >
          {children}
        </Box>
      </Box>
      <AppNav tabs={tabs} route={route} toPath={toPath} label={navLabel} />
    </>
  );
}

import { Box, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { ShellTab } from './types';
import { NavIcon } from './NavIcon';

/**
 * Responsive primary navigation (RM-310) — the React twin of the legacy shared
 * tab bar ([`src/ui/shared/nav.ts`](../../ui/shared/nav.ts)).
 *
 * - **Mobile (`< lg`)**: a fixed full-width **bottom** bar with a top border. The
 *   `.tab-bar` retained global style adds the iOS home-indicator safe-area inset.
 * - **Desktop (`>= lg`)**: promotes to a **right-anchored vertical rail**. In RTL
 *   the physical right edge is the inline **start**, so the rail is pinned with
 *   `insetInlineStart: 0` and its inner separator is `borderInlineEnd`; the same
 *   global style drops the (now moot) safe-area inset at 1024px.
 *
 * Tabs are real `<a href="#/…">` links (via React Router `Link`), so they are
 * keyboard-accessible and drive the hash router for free; the active tab carries
 * `aria-current="page"` and the primary color, inactive tabs the muted color.
 *
 * Generic over the app's route union so member and admin share one layout.
 */
interface AppNavProps<R> {
  readonly tabs: ReadonlyArray<ShellTab<R>>;
  readonly route: R;
  readonly toPath: (route: R) => string;
  /** Accessible name for the nav landmark (Arabic app/section name). */
  readonly label: string;
}

export function AppNav<R>({ tabs, route, toPath, label }: AppNavProps<R>) {
  return (
    <Box
      component="nav"
      className="tab-bar"
      aria-label={label}
      sx={{
        position: 'fixed',
        zIndex: 'appBar',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        borderStyle: 'solid',
        borderWidth: 0,
        // Mobile bottom bar (full width, top border) → desktop right rail.
        insetInline: { xs: 0, lg: 'auto' },
        bottom: { xs: 0, lg: 'auto' },
        borderTopWidth: { xs: '1px', lg: 0 },
        insetInlineStart: { lg: 0 },
        top: { lg: 0 },
        height: { lg: '100%' },
        width: { lg: 96 },
        borderInlineEndWidth: { lg: '1px' },
      }}
    >
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          alignItems: 'stretch',
          // Mobile: centered evenly-spaced row → desktop: top-aligned column.
          maxWidth: { xs: 576, lg: 'none' },
          mx: { xs: 'auto', lg: 0 },
          flexDirection: { xs: 'row', lg: 'column' },
          justifyContent: { xs: 'space-around', lg: 'flex-start' },
          height: { lg: '100%' },
          gap: { lg: 1 },
          pt: { lg: 6 },
        }}
      >
        {tabs.map((tab) => {
          const active = tab.isActive(route);
          return (
            <Box component="li" key={tab.iconName} sx={{ flex: { xs: 1, lg: 'none' } }}>
              <Link
                component={RouterLink}
                to={toPath(tab.to)}
                aria-current={active ? 'page' : undefined}
                underline="none"
                color="inherit"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  px: 2,
                  py: 2,
                  minHeight: '3.5rem',
                  fontSize: '0.75rem', // text-xs
                  fontWeight: 600,
                  color: active ? 'primary.main' : 'text.secondary',
                }}
              >
                <NavIcon name={tab.iconName} />
                <Box component="span">{tab.label}</Box>
              </Link>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

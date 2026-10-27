/** Responsive nav values shared by the implementation and layout tests. */
export const appNavLayout = {
  mobile: {
    insetInline: 0,
    // Avoid iOS 26 WebKit's intermittent `position: fixed; bottom: 0`
    // viewport bug. Anchor the bar's top to the dynamic viewport edge, then
    // lift it by its own (safe-area-aware) height instead.
    top: '100dvh',
    transform: 'translateY(-100%)',
    borderTopWidth: '1px',
    maxListWidth: 576,
    flexDirection: 'row',
    minTargetHeight: '3.5rem',
    // Pinned (its natural height) so the recitation dock can stack above it.
    barBlockSize: '4.5rem',
  },
  desktop: {
    insetInlineStart: 0,
    top: 0,
    height: '100%',
    railWidth: 96,
    flexDirection: 'column',
  },
} as const;

/**
 * The floating recitation dock: above the mobile tab bar (same dynamic-viewport
 * anchor, never `bottom: 0`), at the bottom of the content column beside the
 * desktop rail. `clearance` is the in-flow space readers keep free beneath it.
 */
export const recitationDockLayout = {
  mobile: {
    insetInline: 0,
    top: '100dvh',
    transform: `translateY(calc(-100% - ${appNavLayout.mobile.barBlockSize} - ${appNavLayout.mobile.borderTopWidth} - env(safe-area-inset-bottom) - 12px))`,
  },
  desktop: {
    insetInlineStart: appNavLayout.desktop.railWidth,
    insetInlineEnd: 0,
    transform: 'translateY(calc(-100% - 24px))',
  },
  maxWidth: appNavLayout.mobile.maxListWidth,
  clearance: { xs: '5rem', lg: '6rem' },
} as const;

/** Responsive shell contracts shared by the implementation and layout tests. */
export const appShellFrameSx = {
  paddingInlineStart: { lg: '96px' },
} as const;

export const appShellContentSx = {
  mx: 'auto',
  width: '100%',
  px: 4,
  pt: 4,
  // Clear the fixed bottom bar on mobile; relax once it becomes a rail.
  pb: { xs: 28, lg: 8 },
} as const;

/**
 * Cancels {@link appShellContentSx}'s padding so a hero header bleeds
 * edge-to-edge at the top of a routed page (mirror of `px`/`pt` above).
 */
export const heroBleedSx = {
  mx: -4,
  mt: -4,
  mb: 0,
} as const;

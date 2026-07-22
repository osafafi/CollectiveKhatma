/** Responsive nav values shared by the implementation and layout tests. */
export const appNavLayout = {
  mobile: {
    insetInline: 0,
    bottom: 0,
    borderTopWidth: '1px',
    maxListWidth: 576,
    flexDirection: 'row',
    minTargetHeight: '3.5rem',
  },
  desktop: {
    insetInlineStart: 0,
    top: 0,
    height: '100%',
    railWidth: 96,
    flexDirection: 'column',
  },
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

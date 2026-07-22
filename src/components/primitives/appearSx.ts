import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Staggered fadeUp entry used by cards and collapsibles (design §4): list
 * position × 0.06s, capped at the design's 0.16s so long lists do not crawl.
 * Pass `undefined` for no entry motion.
 */
export function appearSx(appear: number | undefined): SxProps<Theme> {
  if (appear === undefined) return {};
  return (theme) => ({
    animation: `fadeUp ${theme.custom.motion.base} ${theme.custom.motion.easing} both`,
    animationDelay: `${Math.min(appear * 0.06, 0.16)}s`,
  });
}

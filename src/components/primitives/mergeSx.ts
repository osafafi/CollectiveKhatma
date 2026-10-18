import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Compose a primitive's required styles with caller-provided MUI `sx`.
 * Always returns one flat array: MUI applies only top-level array entries, so
 * a nested array (from chained merges) would silently drop its styles.
 */
export function mergeSx(base: SxProps<Theme>, custom?: SxProps<Theme>): SxProps<Theme> {
  if (!custom) return base;
  return [...asArray(base), ...asArray(custom)] as SxProps<Theme>;
}

function asArray(sx: SxProps<Theme>): readonly unknown[] {
  return Array.isArray(sx) ? sx : [sx];
}

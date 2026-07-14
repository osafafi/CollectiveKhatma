import type { SxProps, Theme } from '@mui/material/styles';

/** Compose a primitive's required styles with caller-provided MUI `sx`. */
export function mergeSx(base: SxProps<Theme>, custom?: SxProps<Theme>): SxProps<Theme> {
  if (!custom) return base;
  return (Array.isArray(custom) ? [base, ...custom] : [base, custom]) as SxProps<Theme>;
}

import { Box, Chip, type ChipProps } from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { mergeSx } from './mergeSx';

export type StatusTone =
  'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export interface StatusChipProps extends Omit<ChipProps, 'color' | 'variant'> {
  tone?: StatusTone;
}

/** Text-labelled neutral/status/warning chip; color is never the sole signal. */
export function StatusChip({ tone = 'neutral', sx, ...props }: StatusChipProps) {
  return <Chip {...props} sx={mergeSx(statusSx(tone), sx)} />;
}

export interface NoticeBannerProps {
  children: ReactNode;
  tone?: StatusTone;
  role?: 'status' | 'alert' | 'note';
  sx?: SxProps<Theme>;
}

/** Tinted paused/awaiting/done/warning banner matching the legacy surfaces. */
export function NoticeBanner({
  children,
  tone = 'primary',
  role,
  sx,
}: NoticeBannerProps) {
  const resolvedRole =
    role ?? (tone === 'warning' || tone === 'danger' ? 'alert' : 'status');
  return (
    <Box
      role={resolvedRole}
      sx={mergeSx((theme) => {
        const color = toneColor(theme, tone);
        return {
          borderRadius: 3,
          bgcolor: alpha(color, 0.1),
          color,
          px: 4,
          py: 3,
        };
      }, sx)}
    >
      {children}
    </Box>
  );
}

function statusSx(tone: StatusTone): SxProps<Theme> {
  return (theme) => {
    const color = toneColor(theme, tone);
    return {
      // The design's "completed" chip sits on the solid gold-soft surface;
      // other tones keep their translucent tint over the ambient background.
      bgcolor:
        tone === 'neutral'
          ? theme.palette.background.default
          : tone === 'accent'
            ? theme.custom.goldSoft
            : alpha(color, 0.1),
      color,
      fontWeight: tone === 'warning' || tone === 'danger' ? 600 : 400,
    };
  };
}

function toneColor(theme: Theme, tone: StatusTone): string {
  switch (tone) {
    case 'primary':
      return theme.palette.primary.main;
    case 'accent':
      return theme.custom.goldInk;
    case 'success':
      return theme.palette.success.dark;
    case 'warning':
      return theme.palette.warning.dark;
    case 'danger':
      return theme.palette.error.main;
    default:
      return theme.palette.text.secondary;
  }
}

import { Box, Stack, useTheme, type Theme } from '@mui/material';
import { toArabicDigits } from '@/content/quran/symbols';

/**
 * Semantic segment colors resolved through the MUI palette. `accent` is the
 * chart's pending color and `neutral` is the border/track tone.
 */
export type BarSegmentColor = 'primary' | 'accent' | 'neutral';

export interface BarSegment {
  value: number;
  color: BarSegmentColor;
  label: string;
}

export interface SegmentBarProps {
  segments: ReadonlyArray<BarSegment>;
}

function segmentColor(theme: Theme, color: BarSegmentColor): string {
  switch (color) {
    case 'primary':
      return theme.palette.primary.main;
    case 'accent':
      return theme.palette.secondary.main;
    case 'neutral':
      return theme.palette.divider;
  }
}

/**
 * A single horizontal breakdown bar (e.g. read / being-read / remaining pages)
 * with 2px surface gaps between fills and a text legend below. Counts are
 * written out in the legend, so color is reinforcement, not the only signal;
 * the bar itself is decorative for assistive tech.
 */
export function SegmentBar({ segments }: SegmentBarProps) {
  const theme = useTheme();
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <Stack spacing={1}>
      <Box
        aria-hidden="true"
        sx={{
          display: 'flex',
          height: 12, // legacy h-3
          width: '100%',
          gap: '2px',
          overflow: 'hidden',
          borderRadius: 1, // theme.shape — the legacy `rounded-button` 12px
        }}
      >
        {visible.length === 0 ? (
          <Box
            sx={{ height: '100%', width: '100%', bgcolor: 'divider', borderRadius: 1 }}
          />
        ) : (
          visible.map((segment, index) => (
            <Box
              key={index}
              sx={{
                height: '100%',
                flexBasis: 0,
                flexGrow: segment.value,
                bgcolor: segmentColor(theme, segment.color),
              }}
            />
          ))
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 4, // legacy gap-x-4 (16px)
          rowGap: 1, // legacy gap-y-1 (4px)
          fontSize: '0.75rem', // text-xs
          color: 'text.secondary',
        }}
      >
        {segments.map((segment, index) => (
          <Box
            key={index}
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                display: 'inline-block',
                width: 8, // legacy h-2 w-2
                height: 8,
                borderRadius: '50%',
                bgcolor: segmentColor(theme, segment.color),
              }}
            />
            {`${segment.label}: ${toArabicDigits(segment.value)}`}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

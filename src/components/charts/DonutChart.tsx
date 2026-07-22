import { Box, useTheme } from '@mui/material';
import { clampPercent, formatPercent } from '@/components/primitives';

export interface DonutChartProps {
  /** Completion percentage; clamped to the determinate 0–100 range. */
  percent: number;
  /** Rendered square edge in px (legacy default 112; admin metrics rows use 88). */
  size?: number;
  /** Optional short caption rendered beneath the percentage inside the ring. */
  caption?: string;
}

/**
 * A donut showing one completion percentage, with the value as a hero number in
 * the middle. The single source of identity is the accompanying title, so no
 * legend is needed. Track and fill colors come from the MUI theme.
 */
export function DonutChart({ percent, size = 112, caption }: DonutChartProps) {
  const theme = useTheme();
  const clamped = clampPercent(percent);
  const label = formatPercent(clamped);

  const stroke = 10;
  const r = 48 - stroke / 2 - 2; // viewBox is 96x96; keep the ring inside
  const circumference = 2 * Math.PI * r;

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-block',
        animation: `ringIn ${theme.custom.motion.slow} ${theme.custom.motion.easing} both`,
      }}
    >
      <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={label}>
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={theme.custom.cellRem}
          strokeWidth={stroke}
        />
        {clamped > 0 ? (
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
            // Start at 12 o'clock and grow clockwise (SVG circles start at 3 o'clock).
            transform="rotate(-90 48 48)"
          />
        ) : null}
      </svg>
      <Box
        component="span"
        // The SVG's aria-label is the accessible value; hide the visual twin.
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            color: 'primary.main',
            fontSize: caption ? '1.375rem' : '1.125rem',
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Box>
        {caption ? (
          <Box
            component="span"
            sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.3 }}
          >
            {caption}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

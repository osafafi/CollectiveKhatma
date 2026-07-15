import {
  LinearProgress,
  Stack,
  Typography,
  type LinearProgressProps,
} from '@mui/material';
import { clampPercent, formatPercent } from './progress';

export interface ProgressBarProps extends Omit<LinearProgressProps, 'value' | 'variant'> {
  value: number;
  label: string;
  valueText?: string;
}

/** Accessible determinate bar with clamped legacy 0–100 behavior. */
export function ProgressBar({ value, label, valueText, ...props }: ProgressBarProps) {
  const clamped = clampPercent(value);
  return (
    <LinearProgress
      {...props}
      variant="determinate"
      value={clamped}
      aria-label={label}
      aria-valuetext={valueText ?? formatPercent(clamped)}
    />
  );
}

export interface ProgressViewProps {
  value: number;
  label: string;
  valueText?: string;
}

/** Label + visible percentage + bar, so progress is never communicated by color alone. */
export function ProgressView({ value, label, valueText }: ProgressViewProps) {
  const text = valueText ?? formatPercent(value);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Typography component="span">{label}</Typography>
        <Typography
          component="span"
          sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {text}
        </Typography>
      </Stack>
      <ProgressBar value={value} label={label} valueText={text} />
    </Stack>
  );
}

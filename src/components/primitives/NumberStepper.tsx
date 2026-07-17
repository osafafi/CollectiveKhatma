import { IconButton, Stack, Typography } from '@mui/material';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';

export interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  incrementLabel?: string;
  decrementLabel?: string;
}

/** Accessible Arabic-digit increment/decrement control for small numeric drafts. */
export function NumberStepper({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step = 1,
  disabled = false,
  incrementLabel = strings.common.increase,
  decrementLabel = strings.common.decrease,
}: NumberStepperProps) {
  const canDecrement = !disabled && (min === undefined || value - step >= min);
  const canIncrement = !disabled && (max === undefined || value + step <= max);

  return (
    <Stack
      direction="row"
      spacing={0}
      role="group"
      aria-label={label}
      sx={{ alignItems: 'center' }}
    >
      <IconButton
        size="small"
        aria-label={`${decrementLabel}: ${label}`}
        disabled={!canDecrement}
        onClick={() => onChange(value - step)}
        sx={stepperButtonSx}
      >
        <span aria-hidden="true">−</span>
      </IconButton>
      <Typography
        component="span"
        aria-live="polite"
        sx={{ minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
      >
        {toArabicDigits(value)}
      </Typography>
      <IconButton
        size="small"
        aria-label={`${incrementLabel}: ${label}`}
        disabled={!canIncrement}
        onClick={() => onChange(value + step)}
        sx={stepperButtonSx}
      >
        <span aria-hidden="true">+</span>
      </IconButton>
      {suffix ? (
        <Typography variant="caption" color="text.secondary">
          {suffix}
        </Typography>
      ) : null}
    </Stack>
  );
}

const stepperButtonSx = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  bgcolor: 'background.default',
  color: 'primary.main',
  fontSize: '1.125rem',
  fontWeight: 700,
} as const;

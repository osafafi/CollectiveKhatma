import { useId, type ReactNode } from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  type SliderProps,
  type TextFieldProps,
} from '@mui/material';
import { mergeSx } from './mergeSx';

export type AppTextFieldProps = TextFieldProps & {
  /** Fixed legacy widths such as 64/80/96px; omitted means full width. */
  fieldWidth?: number | string;
};

/**
 * Controlled MUI text-field base for text, search, number, date, and multiline
 * inputs. Callers retain draft ownership; stable mounting preserves focus.
 */
export function AppTextField({ fieldWidth, fullWidth, sx, ...props }: AppTextFieldProps) {
  return (
    <TextField
      {...props}
      fullWidth={fullWidth ?? fieldWidth === undefined}
      sx={mergeSx(
        {
          ...(fieldWidth === undefined ? undefined : { width: fieldWidth }),
          '& input[type="number"]': { fontVariantNumeric: 'tabular-nums' },
        },
        sx,
      )}
    />
  );
}

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface AppSelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  fullWidth?: boolean;
  fieldWidth?: number | string;
}

/** Labelled controlled select whose menu remains RTL when portalled to `body`. */
export function AppSelectField({
  label,
  value,
  options,
  onChange,
  id,
  name,
  disabled,
  required,
  error,
  helperText,
  fullWidth = true,
  fieldWidth,
}: AppSelectFieldProps) {
  const generatedId = useId().replace(/:/g, '');
  const inputId = id ?? `app-select-${generatedId}`;
  const labelId = `${inputId}-label`;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <FormControl
      fullWidth={fullWidth && fieldWidth === undefined}
      disabled={disabled}
      required={required}
      error={error}
      sx={fieldWidth === undefined ? undefined : { width: fieldWidth }}
    >
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        id={inputId}
        labelId={labelId}
        label={label}
        name={name}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        inputProps={{ 'aria-describedby': helperId }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText id={helperId}>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export interface AppCheckboxFieldProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  disabled?: boolean;
  helperText?: ReactNode;
}

/** Controlled checkbox used by member and surah pickers. */
export function AppCheckboxField({
  label,
  checked,
  onChange,
  name,
  disabled,
  helperText,
}: AppCheckboxFieldProps) {
  return (
    <FormControl disabled={disabled}>
      <FormControlLabel
        control={
          <Checkbox
            name={name}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
        }
        label={label}
      />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export interface AppSliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  marks?: SliderProps['marks'];
  valueLabelDisplay?: SliderProps['valueLabelDisplay'];
  getAriaValueText?: SliderProps['getAriaValueText'];
}

/** Labelled controlled slider used by the shared five-level reading scale. */
export function AppSliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  marks,
  valueLabelDisplay = 'auto',
  getAriaValueText,
}: AppSliderFieldProps) {
  const labelId = `app-slider-${useId().replace(/:/g, '')}`;
  return (
    <FormControl fullWidth disabled={disabled}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <Slider
        aria-labelledby={labelId}
        value={value}
        onChange={(_event, next) => {
          if (typeof next === 'number') onChange(next);
        }}
        min={min}
        max={max}
        step={step}
        marks={marks}
        valueLabelDisplay={valueLabelDisplay}
        getAriaValueText={getAriaValueText}
        disabled={disabled}
        sx={{ mt: 2 }}
      />
    </FormControl>
  );
}

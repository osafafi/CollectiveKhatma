import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
} from '@mui/material';
import { strings } from '@/content/strings.ar';

export interface QariOption {
  id: string;
  name: string;
}

export interface QariPickerProps {
  options: readonly QariOption[];
  value: string;
  onChange: (id: string) => void;
  /** The option whose preview is loading or playing, if any. */
  previewId?: string;
  /** True while that preview is still connecting. */
  previewLoading?: boolean;
  onPreview: (id: string) => void;
}

/**
 * Radio list of recitation voices; picking one is the save. Each row's preview
 * button sits beside its label rather than inside it, so the two controls are
 * never nested and a preview tap never changes the choice.
 */
export function QariPicker({
  options,
  value,
  onChange,
  previewId,
  previewLoading = false,
  onPreview,
}: QariPickerProps) {
  return (
    <RadioGroup
      aria-label={strings.recitation.pickerLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ gap: 2 }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        const previewing = option.id === previewId;
        const label = (
          previewing ? strings.recitation.stopPreview : strings.recitation.preview
        ).replace('{name}', option.name);
        return (
          <Box
            key={option.id}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 1,
              borderRadius: `${theme.custom.radii.button}px`,
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? 'action.selected' : 'transparent',
            })}
          >
            <FormControlLabel
              value={option.id}
              control={<Radio />}
              label={option.name}
              sx={{ flex: 1, minWidth: 0, minHeight: 48, m: 0 }}
            />
            <IconButton
              aria-label={label}
              aria-pressed={previewing}
              onClick={() => onPreview(option.id)}
              color={previewing ? 'primary' : 'default'}
            >
              {previewing && previewLoading ? (
                <CircularProgress size={20} color="inherit" aria-hidden="true" />
              ) : previewing ? (
                <StopRoundedIcon />
              ) : (
                <PlayArrowRoundedIcon />
              )}
            </IconButton>
          </Box>
        );
      })}
    </RadioGroup>
  );
}

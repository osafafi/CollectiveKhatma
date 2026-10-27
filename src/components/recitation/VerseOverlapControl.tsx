import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { AppButton, AppSliderField } from '@/components/primitives';
import { VERSE_OVERLAP_MS } from '@/content/quran/recitation';
import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';

export interface VerseOverlapControlProps {
  /** The voice being tuned. */
  qariName: string;
  valueMs: number;
  onChange: (ms: number) => void;
  onReset: () => void;
  /** The transition test is loading or playing. */
  testing: boolean;
  testLoading?: boolean;
  onTest: () => void;
}

const formatMs = (ms: number): string =>
  strings.recitation.overlapValue.replace('{ms}', toWesternDigits(ms));

/**
 * Advanced, collapsed-by-default tuning of how much consecutive ayat overlap
 * for one voice, with a short test that crosses three ayah boundaries so the
 * member hears the change before keeping it.
 */
export function VerseOverlapControl({
  qariName,
  valueMs,
  onChange,
  onReset,
  testing,
  testLoading = false,
  onTest,
}: VerseOverlapControlProps) {
  return (
    <Box
      component="details"
      sx={(theme) => ({
        borderTop: '1px solid',
        borderColor: 'divider',
        pt: 2,
        '& > summary': {
          cursor: 'pointer',
          color: 'text.secondary',
          fontWeight: 600,
          py: 1,
          borderRadius: `${theme.custom.radii.pill}px`,
        },
      })}
    >
      <Box component="summary">{strings.recitation.advancedTitle}</Box>
      <Stack spacing={2} sx={{ pt: 2 }}>
        <AppSliderField
          label={strings.recitation.overlapLabel}
          value={valueMs}
          onChange={onChange}
          min={VERSE_OVERLAP_MS.min}
          max={VERSE_OVERLAP_MS.max}
          step={VERSE_OVERLAP_MS.step}
          valueLabelDisplay="off"
          getAriaValueText={formatMs}
        />
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatMs(valueMs)}
          <Typography component="span" color="text.secondary" sx={{ fontWeight: 400 }}>
            {' · '}
            {strings.recitation.overlapFor.replace('{name}', qariName)}
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {strings.recitation.overlapHelp}
        </Typography>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AppButton
            variant="outlined"
            onClick={onTest}
            aria-pressed={testing}
            startIcon={
              testing && testLoading ? (
                <CircularProgress size={18} color="inherit" aria-hidden="true" />
              ) : testing ? (
                <StopRoundedIcon />
              ) : (
                <PlayArrowRoundedIcon />
              )
            }
          >
            {testing
              ? strings.recitation.stopTransition
              : strings.recitation.testTransition}
          </AppButton>
          <AppButton
            variant="text"
            color="inherit"
            onClick={onReset}
            disabled={valueMs === VERSE_OVERLAP_MS.default}
          >
            {strings.recitation.resetOverlap}
          </AppButton>
        </Stack>
      </Stack>
    </Box>
  );
}

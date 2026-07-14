import { Box, Paper, Stack, Typography } from '@mui/material';
import { AppSliderField } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { ReadingScale } from '@/theme/reading';

interface SettingsPageProps {
  readingScale: ReadingScale;
  onReadingScaleChange: (scale: ReadingScale) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Member reading-scale settings with route-stable disclosure state. */
export function SettingsPage({
  readingScale,
  onReadingScaleChange,
  open,
  onOpenChange,
}: SettingsPageProps) {
  return (
    <Stack spacing={4}>
      <Typography component="h1" variant="h2" color="primary.main">
        {strings.nav.settings}
      </Typography>
      <Paper
        component="details"
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
        variant="outlined"
        sx={{ overflow: 'hidden', borderRadius: 3 }}
      >
        <Box
          component="summary"
          sx={{
            cursor: 'pointer',
            px: 4,
            py: 3,
            color: 'primary.main',
            fontSize: '1.125rem',
            fontWeight: 700,
            userSelect: 'none',
          }}
        >
          {strings.settings.title}
        </Box>
        <Stack spacing={3} sx={{ borderTop: 1, borderColor: 'divider', p: 4 }}>
          <AppSliderField
            label={strings.settings.fontSize}
            value={readingScale}
            onChange={(value) => onReadingScaleChange(value as ReadingScale)}
            min={1}
            max={5}
            step={1}
            marks
          />
          <Box component="p" className="quran-text" sx={{ m: 0, textAlign: 'center' }}>
            {strings.settings.sample}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}

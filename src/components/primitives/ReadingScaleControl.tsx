import { Box, Paper, Stack } from '@mui/material';
import { AppSliderField } from './Fields';
import { strings } from '@/content/strings.ar';
import type { ReadingScale } from '@/theme/reading';

export interface ReadingScaleControlProps {
  readingScale: ReadingScale;
  onReadingScaleChange: (scale: ReadingScale) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The shared 1–5 reading-scale disclosure: one
 * localStorage-backed control reused verbatim by the member ([`SettingsPage`](../../app/member/SettingsPage.tsx))
 * and admin ([`AdminSettingsPage`](../../app/admin/pages/SettingsPage.tsx)) Settings
 * pages, not a fork per app.
 *
 * A native `<details>` popover whose open/close state is lifted to the caller so
 * it survives the route-change re-renders that keep the route content mounted;
 * the slider live-applies + persists the scale through `useReadingScale`.
 */
export function ReadingScaleControl({
  readingScale,
  onReadingScaleChange,
  open,
  onOpenChange,
}: ReadingScaleControlProps) {
  return (
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
  );
}

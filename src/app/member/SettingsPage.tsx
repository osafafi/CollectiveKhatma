import { Stack, Typography } from '@mui/material';
import { ReadingScaleControl } from '@/components/primitives';
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
      <ReadingScaleControl
        readingScale={readingScale}
        onReadingScaleChange={onReadingScaleChange}
        open={open}
        onOpenChange={onOpenChange}
      />
    </Stack>
  );
}

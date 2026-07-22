import { Box, Stack } from '@mui/material';
import { AppSliderField } from './Fields';
import { CollapsibleCard } from './CollapsibleCard';
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
 * A native `<details>` collapsible (via {@link CollapsibleCard}) whose
 * open/close state is lifted to the caller so it survives the route-change
 * re-renders that keep the route content mounted; the slider live-applies +
 * persists the scale through `useReadingScale`.
 */
export function ReadingScaleControl({
  readingScale,
  onReadingScaleChange,
  open,
  onOpenChange,
}: ReadingScaleControlProps) {
  return (
    <CollapsibleCard
      title={strings.settings.fontSize}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Stack spacing={3}>
        <AppSliderField
          label={strings.settings.fontSize}
          value={readingScale}
          onChange={(value) => onReadingScaleChange(value as ReadingScale)}
          min={1}
          max={5}
          step={1}
          marks
        />
        <Box
          component="p"
          className="quran-text"
          sx={(theme) => ({
            m: 0,
            textAlign: 'center',
            p: 3,
            borderRadius: `${theme.custom.radii.button}px`,
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
          })}
        >
          {strings.settings.sample}
        </Box>
      </Stack>
    </CollapsibleCard>
  );
}

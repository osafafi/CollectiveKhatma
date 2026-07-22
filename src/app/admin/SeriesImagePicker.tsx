import { useState } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { AppButton, KhatmaSeriesArtwork } from '@/components/primitives';
import { availableSeriesImages } from '@/content/seriesImages';
import { strings } from '@/content/strings.ar';

export interface SeriesImagePickerProps {
  value: string;
  disabled?: boolean;
  onChange: (imageName: string) => void;
}

/** Optional public-folder image picker shared by create and edit flows. */
export function SeriesImagePicker({ value, disabled, onChange }: SeriesImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const openPicker = () => {
    setDraft(value);
    setOpen(true);
  };

  const closePicker = () => setOpen(false);

  return (
    <Stack spacing={1}>
      <Typography component="span" color="text.secondary">
        {strings.admin.seriesImageLabel}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <KhatmaSeriesArtwork
          variant="avatar"
          imageName={value}
          alt={strings.admin.seriesImageAlt}
          size={72}
        />
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <AppButton variant="outlined" disabled={disabled} onClick={openPicker}>
            {strings.admin.chooseSeriesImage}
          </AppButton>
          <Typography variant="body2" color="text.secondary">
            {value
              ? `${strings.admin.selectedSeriesImage}: ${value}`
              : strings.admin.seriesImageOptional}
          </Typography>
        </Stack>
      </Box>

      <Dialog
        open={open}
        onClose={closePicker}
        fullWidth
        maxWidth="md"
        aria-labelledby="series-image-picker-title"
      >
        <DialogTitle id="series-image-picker-title">
          {strings.admin.seriesImageGalleryHeading}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 2,
              pt: 1,
            }}
          >
            <ImageChoice
              imageName=""
              label={strings.admin.useSeriesPlaceholder}
              selected={draft === ''}
              onSelect={setDraft}
            />
            {availableSeriesImages.map((imageName) => (
              <ImageChoice
                key={imageName}
                imageName={imageName}
                label={imageName}
                selected={draft === imageName}
                onSelect={setDraft}
              />
            ))}
          </Box>
          {availableSeriesImages.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              {strings.admin.noSeriesImages}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppButton variant="text" color="inherit" onClick={closePicker}>
            {strings.common.cancel}
          </AppButton>
          <AppButton
            onClick={() => {
              onChange(draft);
              closePicker();
            }}
          >
            {strings.common.confirm}
          </AppButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function ImageChoice({
  imageName,
  label,
  selected,
  onSelect,
}: {
  imageName: string;
  label: string;
  selected: boolean;
  onSelect: (imageName: string) => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(imageName)}
      sx={{
        appearance: 'none',
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: (theme) => `${theme.custom.radii.cardSm}px`,
        overflow: 'hidden',
        p: 0,
        bgcolor: 'background.paper',
        color: 'text.primary',
        cursor: 'pointer',
        textAlign: 'start',
      }}
    >
      <KhatmaSeriesArtwork variant="media" imageName={imageName} alt="" />
      <Typography component="span" variant="body2" sx={{ display: 'block', p: 1.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

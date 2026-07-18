import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { SeriesImagePicker } from '@/app/admin/SeriesImagePicker';
import { AppButton, AppTextField, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Khatma } from '@/domain/types';
import { dateToEpoch, dateToInput } from './formatting';

/** Edit series-wide identity plus this khatma's number and creation date. */
export function KhatmaMetadataEditor({ khatma }: { khatma: Khatma }) {
  // Seed once so live snapshots never overwrite an edit in progress.
  const [name, setName] = useState(khatma.seriesName);
  const [number, setNumber] = useState(String(khatma.seriesNumber));
  const [date, setDate] = useState(dateToInput(khatma.createdAt));
  const [imageName, setImageName] = useState(khatma.imageName ?? '');
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const renameSeries = useWriteOperation('renameSeries');
  const updateKhatma = useWriteOperation('updateKhatma');
  const setSeriesImage = useWriteOperation('setSeriesImage');

  const onSave = async () => {
    setStatus(null);
    const trimmed = name.trim();
    if (trimmed && trimmed !== khatma.seriesName) {
      const result = await renameSeries.execute(khatma.seriesId, trimmed);
      if (result.status === 'failure') {
        setStatus({ tone: 'error', text: strings.admin.saveError });
        return;
      }
    }
    const changes: Partial<Pick<Khatma, 'seriesNumber' | 'createdAt'>> = {};
    const parsedNumber = parseInt(number, 10);
    if (
      Number.isInteger(parsedNumber) &&
      parsedNumber > 0 &&
      parsedNumber !== khatma.seriesNumber
    ) {
      changes.seriesNumber = parsedNumber;
    }
    const ms = dateToEpoch(date);
    if (ms !== undefined && ms !== khatma.createdAt) changes.createdAt = ms;
    if (Object.keys(changes).length > 0) {
      const result = await updateKhatma.execute(khatma.id, changes);
      if (result.status === 'failure') {
        setStatus({ tone: 'error', text: strings.admin.saveError });
        return;
      }
    }
    if (imageName !== (khatma.imageName ?? '')) {
      const result = await setSeriesImage.execute(khatma.seriesId, imageName);
      if (result.status === 'failure') {
        setStatus({ tone: 'error', text: strings.admin.saveError });
        return;
      }
    }
    setStatus({ tone: 'success', text: strings.admin.saved });
  };

  return (
    <SurfaceCard title={strings.admin.editKhatmaHeading}>
      <Stack spacing={3}>
        <AppTextField
          label={strings.admin.seriesNamePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <SeriesImagePicker
          value={imageName}
          disabled={setSeriesImage.isPending}
          onChange={setImageName}
        />
        <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AppTextField
            type="number"
            label={strings.admin.khatmaNumberLabel}
            value={number}
            fieldWidth={120}
            onChange={(event) => setNumber(event.target.value)}
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
          <AppTextField
            type="date"
            label={strings.admin.createdDateLabel}
            value={date}
            fieldWidth={200}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppButton
            disabled={
              renameSeries.isPending || updateKhatma.isPending || setSeriesImage.isPending
            }
            onClick={() => void onSave()}
          >
            {strings.admin.saveKhatma}
          </AppButton>
          {status ? (
            <Typography
              role={status.tone === 'error' ? 'alert' : 'status'}
              color={status.tone === 'error' ? 'error.main' : 'success.main'}
            >
              {status.text}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

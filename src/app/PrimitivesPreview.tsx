import { useState } from 'react';
import { Stack } from '@mui/material';
import { useConfirmation } from '@/app/providers/useConfirmation';
import {
  AppButton,
  AppSelectField,
  AppTextField,
  NumberStepper,
  ProgressView,
  StatusChip,
  SurfaceCard,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';

/** Preview-only composition proving the RM-320 public primitives in both roots. */
export function PrimitivesPreview() {
  const [name, setName] = useState('');
  const [scope, setScope] = useState('full');
  const [pages, setPages] = useState(2);
  const { confirm } = useConfirmation();

  return (
    <SurfaceCard title={strings.preview.primitivesHeading} sx={{ mt: 4, maxWidth: 520 }}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <AppButton>{strings.admin.createButton}</AppButton>
        <AppButton variant="outlined">{strings.admin.cancel}</AppButton>
        <StatusChip tone="success" label={strings.admin.statusCompleted} />
        <StatusChip tone="warning" label={strings.admin.chunkPending} />
      </Stack>

      <AppTextField
        label={strings.admin.namePlaceholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <AppSelectField
        label={strings.admin.scopeLabel}
        value={scope}
        onChange={setScope}
        options={[
          { value: 'full', label: strings.admin.scopeFull },
          { value: 'range', label: strings.admin.scopeRange },
          { value: 'surahs', label: strings.admin.scopeSurahs },
        ]}
      />
      <NumberStepper
        label={strings.admin.pagesPerDayLabel}
        value={pages}
        min={1}
        onChange={setPages}
        suffix={strings.admin.pagesPerDayLabel}
      />
      <ProgressView value={38} label={strings.member.groupProgress} />
      <AppButton
        variant="text"
        color="error"
        quiet
        onClick={() => {
          void confirm({
            message: strings.admin.confirmRemove,
            confirmLabel: strings.admin.remove,
            tone: 'danger',
          });
        }}
      >
        {strings.admin.remove}
      </AppButton>
    </SurfaceCard>
  );
}

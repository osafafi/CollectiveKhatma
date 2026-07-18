import { Stack } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { useConfirmation } from '@/app/providers';
import { useAdminNavigate } from '@/app/routing/hooks';
import { useCreateKhatmaPrefill } from '@/app/admin/createKhatmaPrefillContext';
import {
  AppButton,
  AppSelectField,
  SurfaceCard,
  type SelectOption,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Khatma, Person } from '@/domain/types';

/** Reciter, lifecycle, and destructive controls for an active khatma. */
export function ActiveKhatmaControls({
  khatma,
  roster,
}: {
  khatma: Khatma;
  roster: readonly Person[];
}) {
  const members = roster.filter((person) => khatma.memberIds.includes(person.id));
  const updateKhatma = useWriteOperation('updateKhatma');
  const completeKhatma = useWriteOperation('completeKhatma');
  const deleteKhatma = useWriteOperation('deleteKhatma');
  const { confirm } = useConfirmation();

  const onComplete = async () => {
    const confirmed = await confirm(strings.admin.confirmComplete);
    if (confirmed) void completeKhatma.execute(khatma.id);
  };
  const onDelete = async () => {
    const confirmed = await confirm({
      message: strings.admin.confirmRemoveKhatma,
      tone: 'danger',
    });
    if (confirmed) void deleteKhatma.execute(khatma.id);
  };

  const reciterOptions: SelectOption[] = members.map((person) => ({
    value: person.id,
    label: person.name,
  }));

  return (
    <SurfaceCard>
      <Stack spacing={3}>
        {members.length > 0 ? (
          <AppSelectField
            label={strings.admin.reciterIs}
            value={khatma.duaReciterId ?? ''}
            options={reciterOptions}
            fieldWidth={240}
            onChange={(value) =>
              void updateKhatma.execute(khatma.id, { duaReciterId: value })
            }
          />
        ) : null}
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <StartNextKhatmaButton khatma={khatma} />
          <AppButton onClick={() => void onComplete()}>
            {strings.admin.markComplete}
          </AppButton>
          <AppButton variant="text" quiet color="error" onClick={() => void onDelete()}>
            {strings.admin.remove}
          </AppButton>
        </Stack>
      </Stack>
    </SurfaceCard>
  );
}

/** Completed khatmas expose only the start-next action. */
export function CompletedKhatmaControls({ khatma }: { khatma: Khatma }) {
  return (
    <SurfaceCard>
      <StartNextKhatmaButton khatma={khatma} />
    </SurfaceCard>
  );
}

/** Prefill the create form for the next khatma in this series and navigate to it. */
function StartNextKhatmaButton({ khatma }: { khatma: Khatma }) {
  const { requestPrefill } = useCreateKhatmaPrefill();
  const navigate = useAdminNavigate();

  const onStartNext = () => {
    requestPrefill({
      seriesName: khatma.seriesName,
      scope: khatma.scope,
      memberIds: [...khatma.memberIds],
      memberCaps: Object.fromEntries(
        Object.entries(khatma.capacities).map(([memberId, capacity]) => [
          memberId,
          { ...capacity },
        ]),
      ),
      reciterId: khatma.duaReciterId,
    });
    navigate({ name: 'khatmas' });
  };

  return (
    <AppButton variant="outlined" onClick={onStartNext}>
      {strings.admin.startNext}
    </AppButton>
  );
}

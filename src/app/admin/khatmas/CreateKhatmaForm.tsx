import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { selectRoster, useAppSelector } from '@/app/store';
import {
  useCreateKhatmaPrefill,
  type CreateKhatmaPrefill,
} from '@/app/admin/createKhatmaPrefillContext';
import { useQuranScopeMaps } from '@/app/admin/useQuranScopeMaps';
import { useSurahs } from '@/app/admin/useSurahs';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { resolvePageScope } from '@/domain/assignment';
import { pickDuaReciter } from '@/domain/rotation';
import { findSeriesByName, nextSeriesNumber } from '@/domain/series';
import type { Khatma } from '@/domain/types';
import { CreateKhatmaFields } from './CreateKhatmaFields';
import {
  buildKhatmaCapacities,
  buildKhatmaScope,
  createKhatmaDraftFromPrefill,
  dateToEpoch,
  emptyCreateKhatmaDraft,
  safeUUID,
  type CreateKhatmaDraft,
} from './createKhatmaDraft';

/** Route-scoped create controller. Its draft survives every live snapshot. */
export function CreateKhatmaForm({ khatmas }: { khatmas: readonly Khatma[] }) {
  const roster = useAppSelector(selectRoster);
  const scopeMaps = useQuranScopeMaps();
  const surahs = useSurahs();
  const createKhatma = useWriteOperation('createKhatma');
  const setSeriesImage = useWriteOperation('setSeriesImage');
  const { peekPrefill, clearPrefill } = useCreateKhatmaPrefill();

  // Read start-next prefill synchronously, then consume it after the first render.
  const [initialPrefill] = useState<CreateKhatmaPrefill | null>(peekPrefill);
  useEffect(() => clearPrefill(), [clearPrefill]);

  const [showCreateForm, setShowCreateForm] = useState(initialPrefill !== null);
  const [draft, setDraft] = useState<CreateKhatmaDraft>(() =>
    initialPrefill
      ? createKhatmaDraftFromPrefill(initialPrefill)
      : emptyCreateKhatmaDraft(),
  );
  const [error, setError] = useState('');

  if (!showCreateForm) {
    return (
      <Box>
        <AppButton onClick={() => setShowCreateForm(true)}>
          {strings.admin.createNewButton}
        </AppButton>
      </Box>
    );
  }

  const onCreate = async () => {
    setError('');
    const name = draft.seriesName.trim();
    if (!name) {
      setError(strings.admin.seriesNameRequired);
      return;
    }
    const ids = [...draft.memberIds];
    if (ids.length === 0) {
      setError(strings.admin.selectMembers);
      return;
    }
    const scope = buildKhatmaScope(draft);
    let pool: number[];
    try {
      if (!scope) throw new Error('invalid');
      pool = resolvePageScope(scope, scopeMaps?.surahToPages);
    } catch (cause) {
      console.error('onCreate: scope resolution failed', cause);
      setError(strings.admin.createError);
      return;
    }

    const existing = findSeriesByName(khatmas, name);
    const seriesId = existing?.seriesId ?? safeUUID();
    const autoNumber = existing ? nextSeriesNumber(khatmas, seriesId) : 1;
    const override = parseInt(draft.seriesNumberOverride, 10);
    const seriesNumber =
      Number.isInteger(override) && override > 0 ? override : autoNumber;
    const reciter = draft.memberIds.has(draft.reciterId)
      ? draft.reciterId
      : pickDuaReciter(ids, khatmas);
    const capacities = buildKhatmaCapacities(draft, ids);
    const createdAt = dateToEpoch(draft.createdDate);
    const inheritedImageName = khatmas.find(
      (candidate) => candidate.seriesId === seriesId && candidate.imageName,
    )?.imageName;
    const imageName = draft.imageName ?? inheritedImageName;

    // An explicit continuation-series image updates the series before creation.
    if (existing && draft.imageName !== null) {
      const imageResult = await setSeriesImage.execute(seriesId, draft.imageName);
      if (imageResult.status === 'failure') {
        setError(strings.admin.createError);
        return;
      }
    }

    const result = await createKhatma.execute({
      seriesId,
      seriesName: existing?.seriesName ?? name,
      seriesNumber,
      totalPages: pool.length,
      scope,
      memberIds: ids,
      remainingPages: pool,
      duaReciterId: reciter,
      capacities,
      ...(imageName ? { imageName } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
    });

    if (result.status === 'success') {
      setDraft(emptyCreateKhatmaDraft());
      setShowCreateForm(false);
      setError('');
    } else {
      console.error('onCreate: createKhatma failed', result.error);
      setError(strings.admin.createError);
    }
  };

  return (
    <CreateKhatmaFields
      draft={draft}
      setDraft={setDraft}
      khatmas={khatmas}
      roster={roster}
      surahs={surahs}
      busy={createKhatma.isPending || setSeriesImage.isPending}
      error={error}
      onCreate={() => void onCreate()}
      onCancel={() => setShowCreateForm(false)}
    />
  );
}

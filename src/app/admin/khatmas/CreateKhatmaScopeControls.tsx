import type { Dispatch, SetStateAction } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  AppCheckboxField,
  AppSelectField,
  AppTextField,
  type SelectOption,
} from '@/components/primitives';
import { toArabicDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import type { PageScope } from '@/domain/types';
import type { CreateKhatmaDraft } from './createKhatmaDraft';

interface CreateKhatmaScopeControlsProps {
  draft: CreateKhatmaDraft;
  setDraft: Dispatch<SetStateAction<CreateKhatmaDraft>>;
  surahs: readonly Surah[] | null;
}

/** Select the full Quran, a page range, or a set of surahs. */
export function CreateKhatmaScopeControls({
  draft,
  setDraft,
  surahs,
}: CreateKhatmaScopeControlsProps) {
  const scopeOptions: SelectOption[] = [
    { value: 'full', label: strings.admin.scopeFull },
    { value: 'range', label: strings.admin.scopeRange },
    { value: 'surahs', label: strings.admin.scopeSurahs },
  ];
  return (
    <Stack spacing={2}>
      <AppSelectField
        label={strings.admin.scopeLabel}
        value={draft.scopeKind}
        options={scopeOptions}
        onChange={(value) =>
          setDraft((current) => ({ ...current, scopeKind: value as PageScope['kind'] }))
        }
      />
      {draft.scopeKind === 'range' ? (
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <AppTextField
            type="number"
            label={strings.admin.fromPage}
            value={draft.rangeFrom}
            fieldWidth={110}
            onChange={(event) =>
              setDraft((current) => ({ ...current, rangeFrom: event.target.value }))
            }
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
          <AppTextField
            type="number"
            label={strings.admin.toPage}
            value={draft.rangeTo}
            fieldWidth={110}
            onChange={(event) =>
              setDraft((current) => ({ ...current, rangeTo: event.target.value }))
            }
            slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
          />
        </Stack>
      ) : null}
      {draft.scopeKind === 'surahs' ? (
        surahs === null ? (
          <Typography color="text.secondary">{strings.common.loading}</Typography>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              maxHeight: 224,
              overflowY: 'auto',
              borderRadius: (theme) => `${theme.custom.radii.cardSm}px`,
              bgcolor: 'background.default',
              p: 2,
            }}
          >
            {surahs.map((surah) => (
              <AppCheckboxField
                key={surah.id}
                checked={draft.surahIds.has(surah.id)}
                onChange={(checked) =>
                  setDraft((current) => {
                    const surahIds = new Set(current.surahIds);
                    if (checked) surahIds.add(surah.id);
                    else surahIds.delete(surah.id);
                    return { ...current, surahIds };
                  })
                }
                label={`${toArabicDigits(surah.id)}. ${surah.name}`}
              />
            ))}
          </Box>
        )
      ) : null}
    </Stack>
  );
}

import { Box, Stack } from '@mui/material';
import {
  AppCheckboxField,
  AppSelectField,
  AppTextField,
  type SelectOption,
} from '@/components/primitives';
import type { Surah } from '@/content/quran/types';
import { toWesternDigits } from '@/content/quran/symbols';
import { strings } from '@/content/strings.ar';
import type { WirdContentDraft, WirdMode } from './wirdContentDraft';

const JUZ_NUMBERS = Array.from({ length: 30 }, (_, index) => index + 1);

/** Mutually exclusive Wird content picker shared by the create and edit forms. */
export function WirdContentFields({
  draft,
  surahs,
  onChange,
}: {
  draft: WirdContentDraft;
  surahs: readonly Surah[] | null;
  onChange: (draft: WirdContentDraft) => void;
}) {
  const modeOptions: SelectOption[] = [
    { value: 'surahs', label: strings.admin.wirdSurahs },
    { value: 'juz', label: strings.admin.wirdJuz },
    { value: 'dua', label: strings.admin.wirdCustomDua },
  ];
  const toggle = (key: 'surahIds' | 'juzIds', id: number, checked: boolean) => {
    const next = new Set(draft[key]);
    if (checked) next.add(id);
    else next.delete(id);
    onChange({ ...draft, [key]: next });
  };

  return (
    <Stack spacing={2}>
      <AppSelectField
        label={strings.admin.wirdContentType}
        value={draft.mode}
        options={modeOptions}
        onChange={(value) => onChange({ ...draft, mode: value as WirdMode })}
      />
      {draft.mode === 'surahs' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {(surahs ?? []).map((surah) => (
            <AppCheckboxField
              key={surah.id}
              checked={draft.surahIds.has(surah.id)}
              onChange={(checked) => toggle('surahIds', surah.id, checked)}
              label={`${toWesternDigits(surah.id)}. ${surah.name}`}
            />
          ))}
        </Box>
      ) : draft.mode === 'juz' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {JUZ_NUMBERS.map((juz) => (
            <AppCheckboxField
              key={juz}
              checked={draft.juzIds.has(juz)}
              onChange={(checked) => toggle('juzIds', juz, checked)}
              label={`${strings.reader.juz} ${toWesternDigits(juz)}`}
            />
          ))}
        </Box>
      ) : (
        <AppTextField
          label={strings.admin.wirdDuaLabel}
          value={draft.duaText}
          multiline
          minRows={8}
          onChange={(event) => onChange({ ...draft, duaText: event.target.value })}
        />
      )}
    </Stack>
  );
}

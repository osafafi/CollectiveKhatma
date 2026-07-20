import { Box, Typography } from '@mui/material';
import { JuzCapacitySelect } from '@/app/admin/JuzCapacitySelect';
import { SurahCapacitySelect } from '@/app/admin/SurahCapacitySelect';
import { AppTextField } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import type { MemberCapacity, Person } from '@/domain/types';
import { toCount } from './createKhatmaDraft';

interface CreateKhatmaCapacityRowProps {
  person: Person;
  capacity: MemberCapacity;
  surahs: readonly Surah[] | null;
  onChange: (patch: Partial<MemberCapacity>) => void;
}

/** Loose pages, one selected Surah, and one selected Juz for a member. */
export function CreateKhatmaCapacityRow({
  person,
  capacity,
  surahs,
  onChange,
}: CreateKhatmaCapacityRowProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
      <Typography component="span" sx={{ width: 112, flexShrink: 0, fontWeight: 600 }}>
        {person.emoji || ''} {person.name}
      </Typography>
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={String(capacity.pages)}
        fieldWidth={96}
        onChange={(event) => onChange({ pages: toCount(event.target.value) })}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect
        surahs={surahs}
        value={capacity.surahs}
        onChange={(surahId) => onChange({ surahs: surahId })}
      />
      <JuzCapacitySelect
        value={capacity.juz}
        onChange={(juzNumber) => onChange({ juz: juzNumber })}
      />
    </Box>
  );
}

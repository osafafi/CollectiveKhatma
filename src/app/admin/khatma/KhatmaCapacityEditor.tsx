import { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { JuzCapacitySelect } from '@/app/admin/JuzCapacitySelect';
import { useWriteOperation } from '@/app/operations';
import { SurahCapacitySelect } from '@/app/admin/SurahCapacitySelect';
import { AppTextField } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import { requiredCapacity } from '@/domain/assignment';
import type { Khatma, MemberCapacity, Person } from '@/domain/types';
import { toCount } from './formatting';

interface KhatmaCapacityEditorProps {
  khatma: Khatma;
  person: Person;
  surahs: readonly Surah[] | null;
}

/** Save one member's per-khatma capacity only when the save button is pressed. */
export function KhatmaCapacityEditor({
  khatma,
  person,
  surahs,
}: KhatmaCapacityEditorProps) {
  const start = requiredCapacity(khatma, person.id);
  const [pages, setPages] = useState(String(start.pages));
  const [surah, setSurah] = useState(start.surahs);
  const [juz, setJuz] = useState(start.juz);
  const updateKhatma = useWriteOperation('updateKhatma');

  const onSave = () => {
    const capacity: MemberCapacity = {
      pages: toCount(pages),
      surahs: surah,
      juz,
    };
    void updateKhatma.execute(khatma.id, {
      capacities: { ...khatma.capacities, [person.id]: capacity },
    });
  };

  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 2, ps: 2 }}
    >
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={pages}
        fieldWidth={96}
        onChange={(event) => setPages(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect surahs={surahs} value={surah} onChange={setSurah} />
      <JuzCapacitySelect value={juz} onChange={setJuz} />
      <IconButton
        size="small"
        title={strings.admin.saveCapacity}
        aria-label={`${strings.admin.saveCapacity}: ${person.name}`}
        onClick={onSave}
      >
        <SaveOutlinedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

import { useState } from 'react';
import { Box } from '@mui/material';
import { useWriteOperation } from '@/app/operations';
import { SurahCapacitySelect } from '@/app/admin/SurahCapacitySelect';
import {
  AppButton,
  AppSelectField,
  AppTextField,
  type SelectOption,
} from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { Surah } from '@/content/quran/types';
import type { Khatma, MemberCapacity, Person } from '@/domain/types';
import { toCount } from './formatting';

interface AddKhatmaMemberFormProps {
  khatma: Khatma;
  roster: readonly Person[];
  surahs: readonly Surah[] | null;
}

/** Add an available roster member with the capacity shown in the form. */
export function AddKhatmaMemberForm({
  khatma,
  roster,
  surahs,
}: AddKhatmaMemberFormProps) {
  const candidates = roster.filter((person) => !khatma.memberIds.includes(person.id));
  const addMemberToKhatma = useWriteOperation('addMemberToKhatma');
  const [selectedId, setSelectedId] = useState('');
  const [pages, setPages] = useState('');
  const [surah, setSurah] = useState(0);
  const [juz, setJuz] = useState('0');

  if (candidates.length === 0) return null;

  const firstCandidate = candidates[0]!;
  // Keep the selection valid after an added member leaves the candidate list.
  const resolvedId = candidates.some((candidate) => candidate.id === selectedId)
    ? selectedId
    : firstCandidate.id;
  const pagesValue = pages === '' ? String(firstCandidate.pagesPerDay) : pages;

  const onAdd = () => {
    const capacity: MemberCapacity = {
      pages: toCount(pagesValue),
      surahs: surah,
      juz: toCount(juz),
    };
    void addMemberToKhatma.execute(khatma.id, resolvedId, capacity);
    setSelectedId('');
    setPages('');
    setSurah(0);
    setJuz('0');
  };

  const memberOptions: SelectOption[] = candidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.name,
  }));

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, pt: 2 }}>
      <AppSelectField
        label={strings.admin.addMember}
        value={resolvedId}
        options={memberOptions}
        fieldWidth={180}
        onChange={setSelectedId}
      />
      <AppTextField
        type="number"
        label={strings.admin.capacityPages}
        value={pagesValue}
        fieldWidth={96}
        onChange={(event) => setPages(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <SurahCapacitySelect surahs={surahs} value={surah} onChange={setSurah} />
      <AppTextField
        type="number"
        label={strings.admin.capacityJuz}
        value={juz}
        fieldWidth={96}
        onChange={(event) => setJuz(event.target.value)}
        slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
      />
      <AppButton variant="outlined" onClick={onAdd}>
        {strings.admin.addMember}
      </AppButton>
    </Box>
  );
}

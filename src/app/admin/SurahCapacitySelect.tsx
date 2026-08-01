import { AppSelectField, type SelectOption } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import type { Surah } from '@/content/quran/types';

export interface SurahCapacitySelectProps {
  /** Surahs (names) to offer, or `null` while they load. */
  surahs: readonly Surah[] | null;
  /** Selected surah id; `0` = none. */
  value: number;
  onChange: (surahId: number) => void;
}

/**
 * The per-member surah capacity as a name dropdown (first option = none `—`)
 * instead of a raw number — shared by the Khatmas create form and the
 * Khatma detail capacity editor and add-member row.
 */
export function SurahCapacitySelect({
  surahs,
  value,
  onChange,
}: SurahCapacitySelectProps) {
  const options: SelectOption[] = [
    { value: '', label: strings.admin.noSurah },
    ...(surahs ?? []).map((surah) => ({
      value: String(surah.id),
      label: `${toWesternDigits(surah.id)}. ${surah.name}`,
    })),
  ];
  const selectedValue = options.some((option) => option.value === String(value))
    ? String(value)
    : '';
  return (
    <AppSelectField
      label={strings.admin.capacitySurahs}
      value={selectedValue}
      options={options}
      fieldWidth={200}
      onChange={(next) => onChange(next ? parseInt(next, 10) : 0)}
    />
  );
}
